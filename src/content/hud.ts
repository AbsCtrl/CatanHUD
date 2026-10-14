import type { Game } from "../engine/game";
import { DEV_CARDS, type DevCard, RESOURCES, type Resource } from "../types";

/** Card colors close to Colonist's own, labeled with the names players actually use. */
const RES_STYLE: Record<Resource, { bg: string; fg: string; name: string }> = {
  lumber: { bg: "#2f7d3a", fg: "#fff", name: "Wood" },
  brick: { bg: "#c4522f", fg: "#fff", name: "Brick" },
  wool: { bg: "#8fd16a", fg: "#10200a", name: "Sheep" },
  grain: { bg: "#f2c230", fg: "#2a2000", name: "Wheat" },
  ore: { bg: "#8a93a6", fg: "#10131a", name: "Steel" },
};
const DEV_CHIP = { bg: "#7b5fd6", fg: "#fff" };

const DEV_LABEL: Record<DevCard, { short: string; long: string }> = {
  knight: { short: "Knight", long: "Knight" },
  victoryPoint: { short: "VP", long: "Victory point" },
  roadBuilding: { short: "Road", long: "Road building" },
  yearOfPlenty: { short: "Plenty", long: "Year of plenty" },
  monopoly: { short: "Mono", long: "Monopoly" },
};

type Section = "resources" | "dice" | "dev" | "settings";

export interface HudPrefs {
  scale: number;
  collapsed: Section[];
  minimized: boolean;
  left: number | null;
  top: number | null;
  /** Fixed discard limit, or null to pick it from the game mode. */
  discardLimit: number | null;
}

const DEFAULT_PREFS: HudPrefs = {
  scale: 1,
  collapsed: ["dice", "settings"],
  minimized: false,
  left: null,
  top: null,
  discardLimit: null,
};

const STYLE = `
:host { all: initial; }
.panel {
  position: fixed; top: 80px; right: 16px; z-index: 2147483647;
  width: 490px; max-height: 90vh; overflow: auto;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #f5f7fa;
  background: #151922; border: 1px solid #2c3342; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
}
.head { position: sticky; top: 0; display: flex; align-items: center; gap: 6px; padding: 8px 10px; cursor: move;
  background: #222937; border-radius: 10px 10px 0 0; user-select: none; }
.head b { font-size: 15px; }
.status { flex: 1; font-size: 12px; color: #a9b2c3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button { font: inherit; font-size: 13px; color: inherit; background: #333c4e; border: 0; border-radius: 5px; padding: 2px 8px; cursor: pointer; }
button:hover { background: #445069; }
.minimized .body { display: none; }
.body { padding: 4px 12px 12px; }
.sec { border-top: 1px solid #262d3b; padding-top: 8px; margin-top: 8px; }
.sec:first-child { border-top: 0; margin-top: 0; }
.sec > h3 { display: flex; justify-content: space-between; margin: 0 0 6px; cursor: pointer; user-select: none;
  font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #a9b2c3; }
.sec > h3::after { content: "▾"; }
.sec.closed > h3::after { content: "▸"; }
.sec.closed > h3 { margin-bottom: 0; }
.sec.closed > .content { display: none; }
table { width: 100%; border-collapse: separate; border-spacing: 0 3px; color: inherit; font: inherit; }
th, td { padding: 3px 2px; text-align: center; font-variant-numeric: tabular-nums; }
th.name, td.name { text-align: left; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; }
.chip { display: inline-block; min-width: 44px; padding: 5px 2px; border-radius: 7px; font-size: 13px; font-weight: 800; }
td.devcol { color: #c7b6ff; }
.devsep { padding-left: 12px !important; border-left: 2px solid #2c3342; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 7px; vertical-align: 0; }
tr.player td { background: #1c212c; }
tr.player td:first-child { border-radius: 6px 0 0 6px; padding-left: 6px; }
tr.player td:last-child { border-radius: 0 6px 6px 0; }
tr.me td { background: #262c1d; }
tr.me td.name { font-weight: 700; }
tr.player td { padding: 6px 2px; }
td.n { font-size: 28px; font-weight: 700; line-height: 1.1; }
td.zero { color: #4f5768; font-weight: 400; }
td.unsure { color: #ffbf5e; }
td.unsure sup { font-size: 14px; margin-left: 1px; }
td.total { font-size: 22px; font-weight: 800; }
.badge { display: inline-block; min-width: 36px; padding: 2px 6px; border-radius: 18px; background: #333c4e; }
.badge.over { background: #b8382f; }
tr.bank td { color: #a9b2c3; font-size: 14px; }
.note { font-size: 12px; color: #a9b2c3; margin-top: 4px; }
.note .u { color: #ffbf5e; }
.dice { display: flex; align-items: flex-end; gap: 3px; height: 96px; padding-top: 14px; }
.col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; position: relative; }
.bar { width: 100%; background: #5b8def; border-radius: 3px 3px 0 0; }
.col.seven .bar { background: #d9534f; }
.cnt { position: absolute; left: 0; right: 0; text-align: center; font-size: 11px; color: #dfe5ee; }
.exp { position: absolute; left: -1px; right: -1px; height: 0; border-top: 2px solid #ffd76a; }
.axis { display: flex; gap: 3px; margin-top: 3px; }
.axis span { flex: 1; text-align: center; font-size: 12px; color: #c7cfdc; }
.axis span.hot { color: #fff; font-weight: 700; }
.key { display: inline-block; width: 12px; vertical-align: middle; margin-right: 4px; }
.dev { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; text-align: center; }
.dev div { background: #1c212c; border-radius: 6px; padding: 4px 0; }
.dev b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.dev em { display: block; font-style: normal; font-size: 11px; color: #c7b6ff; }
.dev span { font-size: 12px; color: #a9b2c3; }
.dev .zero b { color: #4f5768; }
select { font: inherit; background: #0e1117; color: inherit; border: 1px solid #333c4e; border-radius: 5px; padding: 2px 4px; }
ul { margin: 0; padding-left: 18px; }
li { margin: 2px 0; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0; }
input { font: inherit; width: 130px; background: #0e1117; color: inherit; border: 1px solid #333c4e; border-radius: 5px; padding: 2px 6px; }
`;

export interface HudCallbacks {
  onSelfName(name: string): void;
  onCopyLog(): void;
  onPrefs(prefs: HudPrefs): void;
}

export class Hud {
  private root: ShadowRoot;
  private panel: HTMLDivElement;
  private body: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private pending = false;
  private selfName: string;
  private prefs: HudPrefs;
  private colors = new Map<string, string>();
  private lastGame: Game | null = null;

  constructor(private cb: HudCallbacks, selfName: string, prefs: Partial<HudPrefs> = {}) {
    this.selfName = selfName;
    this.prefs = { ...DEFAULT_PREFS, ...prefs };

    const host = document.createElement("div");
    host.id = "catanhud-root";
    document.documentElement.appendChild(host);
    this.root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.panel = document.createElement("div");
    this.panel.className = "panel";
    this.panel.innerHTML = `
      <div class="head"><b>CatanHUD</b><span class="status"></span>
        <button data-act="smaller" title="Smaller text">A−</button>
        <button data-act="bigger" title="Bigger text">A+</button>
        <button data-act="toggle" title="Minimize">–</button></div>
      <div class="body"></div>`;
    this.root.append(style, this.panel);
    this.body = this.panel.querySelector(".body")!;
    this.statusEl = this.panel.querySelector(".status")!;

    const on = (act: string, fn: () => void) =>
      this.panel.querySelector(`[data-act=${act}]`)!.addEventListener("click", fn);
    on("toggle", () => this.setPrefs({ minimized: !this.prefs.minimized }));
    on("smaller", () => this.setPrefs({ scale: Math.max(0.8, round(this.prefs.scale - 0.1)) }));
    on("bigger", () => this.setPrefs({ scale: Math.min(1.6, round(this.prefs.scale + 0.1)) }));

    // Delegated handlers survive re-renders of the body.
    this.body.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const h3 = target.closest("h3[data-sec]");
      if (h3) {
        const sec = h3.getAttribute("data-sec") as Section;
        const collapsed = this.prefs.collapsed.includes(sec)
          ? this.prefs.collapsed.filter((s) => s !== sec)
          : [...this.prefs.collapsed, sec];
        this.setPrefs({ collapsed });
      } else if (target.closest("[data-act=copy]")) {
        this.cb.onCopyLog();
      }
    });
    this.body.addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      if (input.name === "self") {
        this.selfName = input.value.trim();
        this.cb.onSelfName(this.selfName);
      } else if (input.name === "discard") {
        this.setPrefs({ discardLimit: input.value === "auto" ? null : Number(input.value) });
      }
    });

    this.makeDraggable(this.panel.querySelector(".head")!);
    this.applyPrefs();
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /** Remember each player's color from the log so names match the board. */
  addColors(colors: Record<string, string>): void {
    for (const [name, color] of Object.entries(colors)) this.colors.set(name, color);
  }

  /** Re-render on the next frame; cheap to call on every event. */
  update(game: Game): void {
    this.lastGame = game;
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render(game);
    });
  }

  private setPrefs(change: Partial<HudPrefs>): void {
    this.prefs = { ...this.prefs, ...change };
    this.applyPrefs();
    this.cb.onPrefs(this.prefs);
    if (this.lastGame) this.render(this.lastGame);
  }

  private applyPrefs(): void {
    const { scale, minimized, left, top } = this.prefs;
    this.panel.style.zoom = String(scale);
    this.panel.classList.toggle("minimized", minimized);
    if (left !== null && top !== null) {
      // Keep the panel on screen if the window shrank since it was placed.
      this.panel.style.left = `${Math.min(Math.max(0, left), window.innerWidth - 80)}px`;
      this.panel.style.top = `${Math.min(Math.max(0, top), window.innerHeight - 40)}px`;
      this.panel.style.right = "auto";
    }
  }

  private section(id: Section, title: string, content: string): string {
    const closed = this.prefs.collapsed.includes(id) ? " closed" : "";
    return `<div class="sec${closed}"><h3 data-sec="${id}"><span>${title}</span></h3><div class="content">${content}</div></div>`;
  }

  private render(game: Game): void {
    const input = this.body.querySelector("input");
    if (input && this.root.activeElement === input) return; // don't clobber the name field while typing

    const mode = game.mode ? `${game.mode} · ` : "";
    this.body.innerHTML = [
      this.section("resources", `Cards · ${mode}discard over ${game.discardLimit}`, this.resources(game)),
      this.section("dev", `Dev cards · ${game.devDeckRemaining()} in deck`, this.dev(game)),
      this.section("dice", `Dice · ${game.rolls} rolls`, this.dice(game)),
      this.section("settings", "Settings", this.settings(game)),
    ].join("");
  }

  private resources(game: Game): string {
    const header = RESOURCES.map((r) => {
      const s = RES_STYLE[r];
      return `<th><span class="chip" style="background:${s.bg};color:${s.fg}">${s.name}</span></th>`;
    }).join("");
    const devHeader = `<th class="devsep" title="Unplayed development cards"><span class="chip" style="background:${DEV_CHIP.bg};color:${DEV_CHIP.fg}">Dev</span></th>`;

    let anyUnsure = false;
    const rows = game.players
      .map((p) => {
        const range = game.hands.range(p);
        const cells = RESOURCES.map((r) => {
          const lo = range.min[r];
          const hi = range.max[r];
          if (lo === hi) return `<td class="n${lo === 0 ? " zero" : ""}">${lo}</td>`;
          anyUnsure = true;
          // Show the most likely count; the exact range is in the tooltip.
          const likely = Math.round(range.expected[r]);
          const tip = `${RES_STYLE[r].name}: ${lo} to ${hi}, about ${range.expected[r].toFixed(1)} expected`;
          return `<td class="n unsure" title="${tip}">${likely}<sup>?</sup></td>`;
        }).join("");
        const me = p === game.selfName;
        const color = this.colors.get(p) ?? (me ? "#ffd76a" : "#6b7385");
        const over = range.total > game.discardLimit;
        const dev = game.devInHand(p);
        const devCell = `<td class="n devcol devsep${dev === 0 ? " zero" : ""}" title="${dev} unplayed dev card${dev === 1 ? "" : "s"}">${dev}</td>`;
        const totalTip = over ? `${range.total} cards: loses ${Math.floor(range.total / 2)} on a 7` : `${range.total} cards`;
        return (
          `<tr class="player${me ? " me" : ""}">` +
          `<td class="name" title="${esc(p)}"><span class="dot" style="background:${esc(color)}"></span>${esc(p)}</td>` +
          `${cells}<td class="total" title="${totalTip}"><span class="badge${over ? " over" : ""}">${range.total}</span></td>${devCell}</tr>`
        );
      })
      .join("");

    const bank = game.hands.bank();
    const bankRow = `<tr class="bank"><td class="name">Bank</td>${RESOURCES.map((r) => `<td>${bank[r]}</td>`).join("")}<td></td><td class="devsep" title="Dev cards left in the deck">${game.devDeckRemaining()}</td></tr>`;
    const note = anyUnsure
      ? `<div class="note"><span class="u">Amber ?</span> means a card was stolen out of sight. Hover for the range.</div>`
      : "";

    return `
      <table>
        <tr><th class="name"></th>${header}<th title="Total resource cards (what counts for discards)">Total</th>${devHeader}</tr>
        ${rows || `<tr><td class="name" colspan="8">Waiting for the game log…</td></tr>`}
        ${bankRow}
      </table>${note}`;
  }

  private dice(game: Game): string {
    const expected = game.expectedDice();
    const maxCount = Math.max(1, ...game.dice, ...expected);
    const cols: string[] = [];
    const axis: string[] = [];
    for (let t = 2; t <= 12; t++) {
      const n = game.dice[t];
      const h = (n / maxCount) * 100;
      const e = (expected[t] / maxCount) * 100;
      cols.push(
        `<div class="col${t === 7 ? " seven" : ""}" title="${t}: rolled ${n}, expected ${expected[t].toFixed(1)}">` +
          (n > 0 ? `<div class="cnt" style="bottom:calc(${h}% + 2px)">${n}</div>` : "") +
          `<div class="exp" style="bottom:${e}%"></div><div class="bar" style="height:${h}%"></div></div>`,
      );
      axis.push(`<span class="${t === 6 || t === 8 ? "hot" : ""}">${t}</span>`);
    }
    return `
      <div class="dice">${cols.join("")}</div>
      <div class="axis">${axis.join("")}</div>
      <div class="note"><span class="key" style="border-top:2px solid #ffd76a"></span>expected for ${game.rolls} rolls</div>`;
  }

  private dev(game: Game): string {
    const unseen = game.devUnseen();
    const held = game.selfName ? game.devHeldKnown(game.selfName) : null;
    const grid = DEV_CARDS.map((c) => {
      const mine = held?.[c] ?? 0;
      const tip = `${DEV_LABEL[c].long}: ${unseen[c]} not seen yet${mine ? `, plus ${mine} in your hand` : ""}`;
      return (
        `<div class="${unseen[c] === 0 ? "zero" : ""}" title="${tip}">` +
        `<b>${unseen[c]}</b><span>${DEV_LABEL[c].short}</span>${mine ? `<em>+${mine} yours</em>` : ""}</div>`
      );
    }).join("");
    return `<div class="dev">${grid}</div>
      <div class="note">Cards you haven't seen: still in the deck or in an opponent's hand. Played cards and your own are not counted.</div>`;
  }

  private settings(game: Game): string {
    const auto = `Auto (${game.isOneVsOne ? "1v1: 9" : "7"})`;
    const options = [`<option value="auto">${auto}</option>`]
      .concat([7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}"${this.prefs.discardLimit === n ? " selected" : ""}>${n}</option>`))
      .join("");
    return `
      <div class="row"><span>Your Colonist name</span><input name="self" value="${esc(this.selfName)}" placeholder="username"></div>
      <div class="row"><span>Discard when over</span><select name="discard">${options}</select></div>
      <div class="row"><span>Counts look wrong?</span><button data-act="copy" title="Copy raw log entries to paste into a bug report">Copy log</button></div>`;
  }

  private makeDraggable(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    // Pointer coordinates are in page pixels; the panel's left/top are scaled by zoom.
    const z = () => this.prefs.scale;
    const move = (e: PointerEvent) => {
      this.panel.style.left = `${startLeft + (e.clientX - startX) / z()}px`;
      this.panel.style.top = `${startTop + (e.clientY - startY) / z()}px`;
      this.panel.style.right = "auto";
    };
    handle.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      const rect = this.panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left / z(); startTop = rect.top / z();
      window.addEventListener("pointermove", move);
      window.addEventListener(
        "pointerup",
        () => {
          window.removeEventListener("pointermove", move);
          this.setPrefs({ left: parseFloat(this.panel.style.left), top: parseFloat(this.panel.style.top) });
        },
        { once: true },
      );
    });
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
