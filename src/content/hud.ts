import type { Game } from "../engine/game";
import { hints } from "../engine/hints";
import { DEV_CARDS, type DevCard, RESOURCES, type Resource } from "../types";

const RES_LABEL: Record<Resource, string> = { lumber: "🌲", brick: "🧱", wool: "🐑", grain: "🌾", ore: "⛰️" };
const DEV_LABEL: Record<DevCard, string> = {
  knight: "Knight",
  victoryPoint: "Victory point",
  roadBuilding: "Road building",
  yearOfPlenty: "Year of plenty",
  monopoly: "Monopoly",
};

const STYLE = `
:host { all: initial; }
.panel {
  position: fixed; top: 80px; right: 16px; z-index: 2147483647;
  width: 320px; max-height: 80vh; overflow: auto;
  font: 12px/1.4 system-ui, sans-serif; color: #f2f2f2;
  background: rgba(20, 24, 32, 0.92); border: 1px solid #3a4150; border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.head { display: flex; align-items: center; gap: 6px; padding: 6px 8px; cursor: move;
  background: #2a3140; border-radius: 8px 8px 0 0; user-select: none; }
.head b { flex: 1; }
.status { font-size: 11px; color: #9aa4b5; }
button { font: inherit; color: inherit; background: #3a4150; border: 0; border-radius: 4px; padding: 2px 6px; cursor: pointer; }
button:hover { background: #4a5468; }
.body { padding: 8px; }
.collapsed .body { display: none; }
h3 { margin: 10px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #9aa4b5; }
h3:first-child { margin-top: 0; }
table { width: 100%; border-collapse: collapse; color: inherit; font: inherit; }
th, td { padding: 2px 3px; text-align: center; }
th:first-child, td:first-child { text-align: left; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
tr.me td:first-child { color: #ffd76a; }
td.unsure { color: #ffb36a; }
tr.bank td { color: #9aa4b5; border-top: 1px solid #3a4150; }
.dice { display: flex; align-items: flex-end; gap: 2px; height: 70px; }
.col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
.bar { width: 100%; background: #5b8def; border-radius: 2px 2px 0 0; }
.exp { position: absolute; left: 0; right: 0; border-top: 2px dashed #ffd76a; }
.lbl { font-size: 10px; color: #9aa4b5; }
.legend { font-size: 10px; color: #9aa4b5; margin-top: 2px; }
ul { margin: 0; padding-left: 16px; }
.row { display: flex; justify-content: space-between; }
input { font: inherit; width: 110px; background: #11141b; color: inherit; border: 1px solid #3a4150; border-radius: 4px; padding: 1px 4px; }
`;

export interface HudCallbacks {
  onSelfName(name: string): void;
  onCopyLog(): void;
}

export class Hud {
  private root: ShadowRoot;
  private panel: HTMLDivElement;
  private body: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private pending = false;
  private selfName: string;

  constructor(private cb: HudCallbacks, selfName: string) {
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
        <button data-act="copy" title="Copy raw log entries for debugging">Copy log</button>
        <button data-act="toggle" title="Collapse">–</button></div>
      <div class="body"></div>`;
    this.root.append(style, this.panel);
    this.body = this.panel.querySelector(".body")!;
    this.statusEl = this.panel.querySelector(".status")!;

    this.panel.querySelector("[data-act=toggle]")!.addEventListener("click", () => {
      this.panel.classList.toggle("collapsed");
    });
    this.panel.querySelector("[data-act=copy]")!.addEventListener("click", () => this.cb.onCopyLog());
    this.makeDraggable(this.panel.querySelector(".head")!);
    this.selfName = selfName;
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /** Re-render on the next frame; cheap to call on every event. */
  update(game: Game): void {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render(game);
    });
  }

  private render(game: Game): void {
    const input = this.body.querySelector("input");
    if (input && this.root.activeElement === input) return; // don't clobber the name field while typing

    const players = game.players;
    const rows = players
      .map((p) => {
        const range = game.hands.range(p);
        const cells = RESOURCES.map((r) => {
          const { min, max } = range;
          return min[r] === max[r]
            ? `<td>${min[r]}</td>`
            : `<td class="unsure" title="${range.expected[r].toFixed(1)} expected">${min[r]}–${max[r]}</td>`;
        }).join("");
        const cls = p === game.selfName ? "me" : "";
        return `<tr class="${cls}"><td title="${esc(p)}">${esc(p)}</td>${cells}<td><b>${range.total}</b></td></tr>`;
      })
      .join("");
    const bank = game.hands.bank();
    const bankRow = `<tr class="bank"><td>Bank</td>${RESOURCES.map((r) => `<td>${bank[r]}</td>`).join("")}<td></td></tr>`;

    const expected = game.expectedDice();
    const maxCount = Math.max(1, ...game.dice, ...expected);
    const diceCols = [];
    for (let t = 2; t <= 12; t++) {
      const h = (game.dice[t] / maxCount) * 100;
      const e = (expected[t] / maxCount) * 100;
      diceCols.push(
        `<div class="col" title="${t}: ${game.dice[t]} rolled, ${expected[t].toFixed(1)} expected">` +
          `<div class="exp" style="bottom:${e}%"></div><div class="bar" style="height:${h}%"></div>` +
          `<div class="lbl">${t}</div></div>`,
      );
    }

    const odds = game.devOdds();
    const devRows = DEV_CARDS.map(
      (c) => `<div class="row"><span>${DEV_LABEL[c]}</span><span>${Math.round(odds[c] * 100)}%</span></div>`,
    ).join("");

    const hintItems = hints(game)
      .map((h) => `<li>${esc(h)}</li>`)
      .join("");

    this.body.innerHTML = `
      <h3>Resources</h3>
      <table>
        <tr><th></th>${RESOURCES.map((r) => `<th title="${r}">${RES_LABEL[r]}</th>`).join("")}<th>Σ</th></tr>
        ${rows || `<tr><td colspan="7">Waiting for the game log…</td></tr>`}
        ${bankRow}
      </table>
      <h3>Dice (${game.rolls} rolls)</h3>
      <div class="dice">${diceCols.join("")}</div>
      <div class="legend">Bars are actual rolls, dashed line is expected.</div>
      <h3>Dev cards (${game.devDeckRemaining()} left in deck)</h3>
      ${devRows}
      <h3>Hints</h3>
      ${hintItems ? `<ul>${hintItems}</ul>` : `<div class="legend">Nothing yet.</div>`}
      <h3>Settings</h3>
      <div class="row"><span>Your Colonist name</span><input value="${esc(this.selfName)}" placeholder="username"></div>
    `;
    const nameInput = this.body.querySelector("input")!;
    nameInput.addEventListener("change", () => {
      this.selfName = nameInput.value.trim();
      this.cb.onSelfName(this.selfName);
    });
  }

  private makeDraggable(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const move = (e: PointerEvent) => {
      this.panel.style.left = `${startLeft + e.clientX - startX}px`;
      this.panel.style.top = `${startTop + e.clientY - startY}px`;
      this.panel.style.right = "auto";
    };
    handle.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      const rect = this.panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", () => window.removeEventListener("pointermove", move), { once: true });
    });
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
