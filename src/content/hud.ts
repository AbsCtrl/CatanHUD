import { type BoardState, bestSpots, PLAYER_COLORS, playerName, playerPips, spots, tileCenter, tileCorners } from "../board/board";
import type { Game } from "../engine/game";
import type { PipStats } from "../engine/pipStats";
import { DEV_CARDS, type DevCard, handTotal, RESOURCES, type Resource } from "../types";

/** Card colors close to Colonist's own, labeled with the names players actually use. */
const RES_STYLE: Record<Resource, { bg: string; fg: string; name: string }> = {
  lumber: { bg: "#2f7d3a", fg: "#fff", name: "Wood" },
  brick: { bg: "#c4522f", fg: "#fff", name: "Brick" },
  wool: { bg: "#8fd16a", fg: "#10200a", name: "Sheep" },
  grain: { bg: "#f2c230", fg: "#2a2000", name: "Wheat" },
  ore: { bg: "#8a93a6", fg: "#10131a", name: "Steel" },
};
const DEV_CHIP = { bg: "#7b5fd6", fg: "#fff" };
const DESERT = "#d8c58f";

const DEV_LABEL: Record<DevCard, { short: string; long: string }> = {
  knight: { short: "Knight", long: "Knight" },
  victoryPoint: { short: "VP", long: "Victory point" },
  roadBuilding: { short: "Road", long: "Road building" },
  yearOfPlenty: { short: "Plenty", long: "Year of plenty" },
  monopoly: { short: "Mono", long: "Monopoly" },
};

type Section = "resources" | "board" | "dice" | "dev" | "settings";

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
.dev { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: #a9b2c3; }
.dev b { color: #f5f7fa; font-variant-numeric: tabular-nums; }
.dev .zero b { color: #4f5768; }
select { font: inherit; background: #0e1117; color: inherit; border: 1px solid #333c4e; border-radius: 5px; padding: 2px 4px; }
ul { margin: 0; padding-left: 18px; }
li { margin: 2px 0; }
.board { display: flex; gap: 12px; align-items: flex-start; }
.board svg { flex: none; width: 220px; height: auto; }
.board svg text { font: 700 0.5px system-ui, sans-serif; text-anchor: middle; dominant-baseline: central; }
.spots { flex: 1; font-size: 12px; color: #a9b2c3; }
.spots ol { margin: 2px 0 0; padding-left: 18px; }
.spots li { margin: 3px 0; }
.spots li b { color: #f5f7fa; font-size: 14px; margin-right: 4px; }
.mini { display: inline-block; min-width: 16px; padding: 0 3px; margin-right: 2px; border-radius: 4px; font-size: 11px; font-weight: 700; text-align: center; }
table.pips { margin-top: 6px; font-size: 13px; }
table.pips td { padding: 2px; }
table.pips td.name { font-size: 13px; }
table.pips .dot { width: 9px; height: 9px; margin-right: 5px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0; }
input { font: inherit; width: 130px; background: #0e1117; color: inherit; border: 1px solid #333c4e; border-radius: 5px; padding: 2px 6px; }
`;

export interface HudCallbacks {
  onSelfName(name: string): void;
  onCopyLog(): void;
  onPrefs(prefs: HudPrefs): void;
  onCopyPipStats(): void;
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
  private board: BoardState | null = null;
  private pipStats: PipStats | null = null;

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
      } else if (target.closest("[data-act=copypips]")) {
        this.cb.onCopyPipStats();
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

  /** Latest board from the page script, and the running pips-per-roll averages. */
  setBoard(board: BoardState | null, stats: PipStats): void {
    this.board = board;
    this.pipStats = stats;
    if (this.lastGame) this.update(this.lastGame);
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
      this.section("dev", `Dev deck · ${game.devDeckRemaining()} left`, this.dev(game)),
      this.section("board", "Board pips", this.boardView()),
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

  /** One compact line of unseen cards by type, then your own cards (opponents' are in the Dev column). */
  private dev(game: Game): string {
    const unseen = game.devUnseen();
    const counts = DEV_CARDS.map(
      (c) => `<span class="${unseen[c] === 0 ? "zero" : ""}" title="${DEV_LABEL[c].long}: ${unseen[c]} not seen yet">${DEV_LABEL[c].short} <b>${unseen[c]}</b></span>`,
    ).join("");

    const lines: string[] = [];
    const me = game.selfName;
    if (me) {
      const held = game.devHeldKnown(me);
      const mine = DEV_CARDS.filter((c) => held[c] > 0).map((c) => `${DEV_LABEL[c].long} ${held[c]}`);
      if (mine.length) lines.push(`You hold: ${mine.join(", ")}`);
    }
    return `<div class="dev" title="Not seen yet: in the deck or in someone's hand">${counts}</div>${
      lines.length ? `<div class="note">${lines.join(" · ")}</div>` : ""
    }`;
  }

  /** Mini-map with the best open spots numbered, then pips per player. */
  private boardView(): string {
    const board = this.board;
    if (!board) return `<div class="note">Waiting for the board. It's read when a game starts, so reload the game tab if this stays empty.</div>`;

    const best = bestSpots(board, 5);
    const pts = board.tiles.flatMap((t) => tileCorners(t));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const pad = 0.3;
    const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
    const f = (n: number) => n.toFixed(2);

    const hexes = board.tiles
      .map((t) => {
        const fill = t.resource ? RES_STYLE[t.resource].bg : DESERT;
        const poly = tileCorners(t).map((p) => `${f(p[0])},${f(p[1])}`).join(" ");
        const [cx, cy] = tileCenter(t.x, t.y);
        const hot = t.number === 6 || t.number === 8;
        const token = t.number
          ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="0.36" fill="#f3e9cf"/><text x="${f(cx)}" y="${f(cy)}" fill="${hot ? "#c0282d" : "#222"}">${t.number}</text>`
          : "";
        return `<polygon points="${poly}" fill="${fill}" stroke="#151922" stroke-width="0.08"/>${token}`;
      })
      .join("");
    const pieces = spots(board)
      .filter((s) => s.building)
      .map((s) => {
        const color = PLAYER_COLORS[s.building!.owner]?.hex ?? "#fff";
        return s.building!.city
          ? `<rect x="${f(s.px - 0.24)}" y="${f(s.py - 0.24)}" width="0.48" height="0.48" fill="${color}" stroke="#000" stroke-width="0.06"/>`
          : `<circle cx="${f(s.px)}" cy="${f(s.py)}" r="0.2" fill="${color}" stroke="#000" stroke-width="0.06"/>`;
      })
      .join("");
    const marks = best
      .map(
        (s, i) =>
          `<circle cx="${f(s.px)}" cy="${f(s.py)}" r="0.34" fill="#ffd76a" stroke="#151922" stroke-width="0.08"/><text x="${f(s.px)}" y="${f(s.py)}" fill="#111">${i + 1}</text>`,
      )
      .join("");
    const svg = `<svg viewBox="${box.map(f).join(" ")}" xmlns="http://www.w3.org/2000/svg">${hexes}${pieces}${marks}</svg>`;

    const spotList = best.length
      ? `Best open spots<ol>${best
          .map((s) => {
            const yields = s.tiles
              .filter((t) => t.resource && t.number)
              .map((t) => `<span class="mini" style="background:${RES_STYLE[t.resource!].bg};color:${RES_STYLE[t.resource!].fg}" title="${RES_STYLE[t.resource!].name} ${t.number}">${t.number}</span>`)
              .join("");
            return `<li><b>${s.pips}</b>${yields}</li>`;
          })
          .join("")}</ol>`
      : "No open spots left.";

    const owned = playerPips(board);
    const rows = [...owned]
      .map(([color, hand]) => {
        const name = playerName(board, color);
        const avg = this.pipStats?.average(name);
        const cells = RESOURCES.map((r) => `<td class="${hand[r] === 0 ? "zero" : ""}">${hand[r]}</td>`).join("");
        const dot = this.colors.get(name) ?? PLAYER_COLORS[color]?.hex ?? "#6b7385";
        return (
          `<tr class="player"><td class="name" title="${esc(name)}"><span class="dot" style="background:${esc(dot)}"></span>${esc(name)}</td>` +
          `${cells}<td><b>${handTotal(hand)}</b></td><td title="Average pips per roll this game">${avg == null ? "–" : avg.toFixed(1)}</td></tr>`
        );
      })
      .join("");
    const head = RESOURCES.map((r) => `<th><span class="mini" style="background:${RES_STYLE[r].bg};color:${RES_STYLE[r].fg}">${RES_STYLE[r].name}</span></th>`).join("");
    const table = rows
      ? `<table class="pips"><tr><th class="name"></th>${head}<th title="Total pips; cities count double">Pips</th><th title="Average pips per roll this game">Avg</th></tr>${rows}</table>`
      : "";

    return `<div class="board">${svg}<div class="spots">${spotList}</div></div>${table}`;
  }

  private settings(game: Game): string {
    const auto = `Auto (${game.isOneVsOne ? "1v1: 9" : "7"})`;
    const options = [`<option value="auto">${auto}</option>`]
      .concat([7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}"${this.prefs.discardLimit === n ? " selected" : ""}>${n}</option>`))
      .join("");
    return `
      <div class="row"><span>Your Colonist name</span><input name="self" value="${esc(this.selfName)}" placeholder="username"></div>
      <div class="row"><span>Discard when over</span><select name="discard">${options}</select></div>
      <div class="row"><span>Pips per roll, all saved games</span><button data-act="copypips" title="Copy a CSV of average pips per roll for every finished game">Copy CSV</button></div>
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
