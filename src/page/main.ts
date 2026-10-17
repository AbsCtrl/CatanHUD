import { decode, decodeMulti } from "@msgpack/msgpack";
import { BOARD_MESSAGE, BOARD_REQUEST, BoardReader } from "../board/extract";

/**
 * Runs in the page's own context (not the extension's isolated world) so it
 * can see Colonist's websocket. It decodes each incoming frame, keeps the
 * board up to date, and posts only the board (tiles, buildings, names) to
 * the content script. See board/extract.ts for what is and isn't read.
 */

const reader = new BoardReader();

function decodeFrame(data: unknown): unknown {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
  if (!bytes || bytes.length === 0) return null;
  try {
    return decode(bytes);
  } catch {
    // Some frames may carry several values back to back.
    try {
      return [...decodeMulti(bytes)];
    } catch {
      return null;
    }
  }
}

function post(): void {
  const board = reader.board();
  if (board) window.postMessage({ source: BOARD_MESSAGE, gameId: reader.gameId, board }, window.location.origin);
}

function handle(data: unknown): void {
  const message = decodeFrame(data);
  if (message !== null && reader.feed(message)) post();
}

// Blob frames are read asynchronously; chain them so diffs apply in order.
let queue: Promise<void> = Promise.resolve();

function onMessage(event: MessageEvent): void {
  const data = event.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    queue = queue.then(() => data.arrayBuffer()).then(handle).catch(() => {});
  } else {
    queue = queue.then(() => handle(data)).catch(() => {});
  }
}

const Original = window.WebSocket;
class HookedWebSocket extends Original {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    this.addEventListener("message", onMessage);
  }
}
window.WebSocket = HookedWebSocket;


window.addEventListener("message", (e) => {
  if (e.source === window && e.data?.source === BOARD_REQUEST) post();
});
