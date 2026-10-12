import { Game } from "../engine/game";
import type { GameEvent } from "../types";
import { Hud } from "./hud";
import { type LogEntry, LogWatcher } from "./logSource";

const entries: LogEntry[] = [];
let game = new Game();

async function loadSelfName(): Promise<string> {
  try {
    const { selfName } = await chrome.storage.local.get("selfName");
    return typeof selfName === "string" ? selfName : "";
  } catch {
    return "";
  }
}

function rebuild(selfName: string): void {
  game = new Game(selfName || null);
  for (const e of entries) if (e.event) game.apply(e.event as GameEvent);
}

async function main(): Promise<void> {
  const selfName = await loadSelfName();
  game = new Game(selfName || null);

  const hud = new Hud(
    {
      onSelfName(name) {
        chrome.storage.local.set({ selfName: name }).catch(() => {});
        rebuild(name);
        hud.update(game);
      },
      onCopyLog() {
        const dump = JSON.stringify(entries.map(({ html, line }) => ({ html, line })), null, 1);
        navigator.clipboard.writeText(dump).then(
          () => hud.setStatus(`copied ${entries.length} entries`),
          () => hud.setStatus("copy failed"),
        );
      },
    },
    selfName,
  );
  hud.setStatus("looking for game log…");
  hud.update(game);

  const watcher = new LogWatcher((entry) => {
    entries.push(entry);
    if (entry.event) game.apply(entry.event);
    hud.setStatus(`${entries.length} log lines`);
    hud.update(game);
  });
  watcher.start();
}

main();
