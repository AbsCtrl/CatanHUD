import { type BoardState, playerName, playerPips } from "../board/board";
import { BOARD_MESSAGE, BOARD_REQUEST } from "../board/extract";
import { Game } from "../engine/game";
import { type GamePipRecord, pipHistoryCsv, PipStats } from "../engine/pipStats";
import type { GameEvent, Hand } from "../types";
import { Hud, type HudPrefs } from "./hud";
import { type LogEntry, LogWatcher } from "./logSource";

const entries: LogEntry[] = [];
let game = new Game();
let discardLimit: number | null = null;

let board: BoardState | null = null;
let boardGameId = 0;
let pipStats = new PipStats();
let pipSaved = false;
const MAX_SAVED_GAMES = 1000;

function pipsByName(b: BoardState): Map<string, Hand> {
  const out = new Map<string, Hand>();
  for (const [color, hand] of playerPips(b)) out.set(playerName(b, color), hand);
  return out;
}

/** Store this game's pips-per-roll summary for later analysis (once per game). */
function savePipGame(winner: string | null): void {
  if (pipSaved || pipStats.empty) return;
  pipSaved = true;
  const record = pipStats.record(game.mode, winner);
  (async () => {
    const { pipHistory } = await chrome.storage.local.get("pipHistory");
    const list: GamePipRecord[] = Array.isArray(pipHistory) ? pipHistory : [];
    list.push(record);
    await chrome.storage.local.set({ pipHistory: list.slice(-MAX_SAVED_GAMES) });
  })().catch(() => {
    // Storage unavailable (e.g. extension reloaded); nothing else to do.
  });
}

function isBoard(v: unknown): v is BoardState {
  const b = v as BoardState;
  return !!b && Array.isArray(b.tiles) && Array.isArray(b.buildings) && typeof b.names === "object" && b.names !== null;
}

async function loadSettings(): Promise<{ selfName: string; prefs: Partial<HudPrefs> }> {
  try {
    const { selfName, hudPrefs } = await chrome.storage.local.get(["selfName", "hudPrefs"]);
    return {
      selfName: typeof selfName === "string" ? selfName : "",
      prefs: hudPrefs && typeof hudPrefs === "object" ? hudPrefs : {},
    };
  } catch {
    return { selfName: "", prefs: {} };
  }
}

function rebuild(selfName: string): void {
  game = new Game(selfName || null, discardLimit);
  for (const e of entries) if (e.event) game.apply(e.event as GameEvent);
}

async function main(): Promise<void> {
  const { selfName, prefs } = await loadSettings();
  discardLimit = typeof prefs.discardLimit === "number" ? prefs.discardLimit : null;
  game = new Game(selfName || null, discardLimit);

  const hud = new Hud(
    {
      onSelfName(name) {
        chrome.storage.local.set({ selfName: name }).catch(() => {});
        rebuild(name);
        hud.update(game);
      },
      onPrefs(next) {
        chrome.storage.local.set({ hudPrefs: next }).catch(() => {});
        discardLimit = next.discardLimit;
        game.discardLimitOverride = discardLimit;
      },
      onCopyPipStats() {
        chrome.storage.local.get("pipHistory").then(
          ({ pipHistory }) => {
            const games: GamePipRecord[] = Array.isArray(pipHistory) ? pipHistory : [];
            if (games.length === 0) return hud.setStatus("no finished games saved yet");
            navigator.clipboard.writeText(pipHistoryCsv(games)).then(
              () => hud.setStatus(`copied ${games.length} games`),
              () => hud.setStatus("copy failed"),
            );
          },
          () => hud.setStatus("copy failed"),
        );
      },
      onCopyLog() {
        const dump = JSON.stringify({ board, entries: entries.map(({ html, line }) => ({ html, line })) }, null, 1);
        navigator.clipboard.writeText(dump).then(
          () => hud.setStatus(`copied ${entries.length} entries`),
          () => hud.setStatus("copy failed"),
        );
      },
    },
    selfName,
    prefs,
  );
  hud.setStatus("looking for game log…");
  hud.update(game);

  // Board updates from the page script (src/page/main.ts), which reads Colonist's websocket.
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== BOARD_MESSAGE || !isBoard(e.data.board)) return;
    if (e.data.gameId !== boardGameId) {
      // A new board was dealt: close out the previous game if it never logged a winner.
      savePipGame(null);
      boardGameId = e.data.gameId;
      pipStats = new PipStats();
      pipSaved = false;
    }
    board = e.data.board;
    hud.setBoard(board, pipStats);
  });
  // The board may have arrived before this script loaded; ask for it again.
  window.postMessage({ source: BOARD_REQUEST }, window.location.origin);

  const watcher = new LogWatcher((entry, live) => {
    entries.push(entry);
    hud.addColors(entry.colors);
    if (entry.event) game.apply(entry.event);
    // Only live rolls are sampled: on a reload the old log replays against today's board.
    if (live && board && entry.event?.type === "roll") pipStats.sample(pipsByName(board));
    if (live && entry.event?.type === "gameOver") savePipGame(game.winner);
    hud.setStatus(`${entries.length} log lines`);
    hud.update(game);
  });
  watcher.start();
}

main();
