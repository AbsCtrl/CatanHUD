import { parseLine } from "../parser/parseLine";
import { tokenize } from "../parser/tokenize";
import type { GameEvent } from "../types";

/**
 * Finds Colonist's game log in the page and reports each new entry.
 *
 * We try known selectors first, then fall back to looking for an element whose
 * children read like log lines ("X rolled ..."). Class names on Colonist are
 * not stable, so the fallback is what keeps this working after UI updates.
 */

const CANDIDATE_SELECTORS = [
  "#game-log-text",
  "[class*='gameLog'] [class*='scroll']",
  "[class*='game-log']",
  "[class*='gameLog']",
  "[class*='GameLog']",
];

export interface LogEntry {
  html: string;
  line: string;
  event: GameEvent | null;
  /** Player name -> text color, from names Colonist renders in their player color. */
  colors: Record<string, string>;
}

/** Colonist shows player names in colored spans; collect them so the HUD can match. */
export function nameColors(entry: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of Array.from(entry.querySelectorAll<HTMLElement>("[style*='color']"))) {
    const name = el.textContent?.trim();
    const color = el.style.color;
    if (name && color && name.length <= 40) out[name] = color;
  }
  return out;
}

function looksLikeLog(el: Element): boolean {
  let hits = 0;
  for (const child of Array.from(el.children).slice(-30)) {
    if (parseLine(tokenize(child))) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

export function findLogContainer(root: ParentNode = document): Element | null {
  for (const sel of CANDIDATE_SELECTORS) {
    for (const el of Array.from(root.querySelectorAll(sel))) {
      if (looksLikeLog(el)) return el;
    }
  }
  // Fallback: the deepest element whose children look like log lines.
  let best: Element | null = null;
  const all = root.querySelectorAll("div, ul, ol, section");
  for (const el of Array.from(all)) {
    if (el.children.length >= 2 && looksLikeLog(el)) best = el;
  }
  return best;
}

/** Stable identity for an entry, so re-rendered entries are not counted twice. */
function entryKey(el: Element): string | null {
  return el.getAttribute("data-index") ?? el.getAttribute("data-item-index");
}

export class LogWatcher {
  private container: Element | null = null;
  private observer: MutationObserver | null = null;
  private seenEls = new WeakSet<Element>();
  private seenKeys = new Set<string>();
  private pollTimer: number | undefined;

  /** `live` is false for entries already in the log when we found it (a reload or late join). */
  constructor(private onEntry: (entry: LogEntry, live: boolean) => void) {}

  start(): void {
    this.poll();
    this.pollTimer = window.setInterval(() => this.poll(), 2000);
  }

  get attached(): boolean {
    return this.container !== null && this.container.isConnected;
  }

  private poll(): void {
    if (this.attached) return;
    const found = findLogContainer();
    if (found) this.attach(found);
  }

  private attach(container: Element): void {
    this.observer?.disconnect();
    this.container = container;
    for (const child of Array.from(container.children)) this.handle(child, false);
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const entry = this.topLevel(node as Element);
          if (entry) this.handle(entry, true);
        });
      }
    });
    this.observer.observe(container, { childList: true, subtree: true });
  }

  /** The direct child of the container that contains `el`. */
  private topLevel(el: Element): Element | null {
    let cur: Element | null = el;
    while (cur && cur.parentElement !== this.container) cur = cur.parentElement;
    return cur;
  }

  private handle(el: Element, live: boolean): void {
    const key = entryKey(el);
    if (key !== null) {
      if (this.seenKeys.has(key)) return;
      this.seenKeys.add(key);
    } else {
      if (this.seenEls.has(el)) return;
      this.seenEls.add(el);
    }
    const line = tokenize(el);
    if (!line) return;
    this.onEntry({ html: el.outerHTML, line, event: parseLine(line), colors: nameColors(el) }, live);
  }

  stop(): void {
    this.observer?.disconnect();
    window.clearInterval(this.pollTimer);
  }
}
