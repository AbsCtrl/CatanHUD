import { Game } from "../engine/game";
import type { GameEvent } from "../types";
import { Hud, type HudPrefs } from "./hud";
import { type LogEntry, LogWatcher } from "./logSource";

const entries: LogEntry[] = [];
let game = new Game();

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
  game = new Game(selfName || null);
  for (const e of entries) if (e.event) game.apply(e.event as GameEvent);
}

async function main(): Promise<void> {
  const { selfName, prefs } = await loadSettings();
  game = new Game(selfName || null);

  const hud = new Hud(
    {
      onSelfName(name) {
        chrome.storage.local.set({ selfName: name }).catch(() => {});
        rebuild(name);
        hud.update(game);
      },
      onPrefs(next) {
        chrome.storage.local.set({ hudPrefs: next }).catch(() => {});
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
    prefs,
  );
  hud.setStatus("looking for game log…");
  hud.update(game);

  const watcher = new LogWatcher((entry) => {
    entries.push(entry);
    hud.addColors(entry.colors);
    if (entry.event) game.apply(entry.event);
    hud.setStatus(`${entries.length} log lines`);
    hud.update(game);
  });
  watcher.start();
}

main();
