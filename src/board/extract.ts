import { RESOURCES } from "../types";
import type { BoardState, Building, Tile } from "./board";

/**
 * Pulls the board out of Colonist's decoded websocket messages.
 *
 * Colonist sends a full `mapState` when a game starts (or you rejoin), then
 * small diffs that only carry what changed, e.g. a city upgrade is
 * `{ tileCornerStates: { "12": { buildingType: 2 } } }`. So diffs are deep
 * merged into what we have. The exact envelope around `mapState` isn't
 * documented and may move, so we search each message for it rather than
 * hard-coding a path.
 *
 * Fair-play line: this reads tile types, number tokens, building positions
 * and player names/colors, all of which every player can see on screen.
 * Nothing else in the message (hands, dev cards) is read or forwarded.
 */

/** window.postMessage tag for board updates from the page script to the content script. */
export const BOARD_MESSAGE = "catanhud-board";
/** The content script asks the page script to re-send the current board. */
export const BOARD_REQUEST = "catanhud-board-request";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Colonist tile `type`: 0 desert, 1-5 the resources in the usual order. */
function tileResource(type: unknown): Tile["resource"] {
  const t = num(type);
  return t !== null && t >= 1 && t <= 5 ? RESOURCES[t - 1] : null;
}

function deepMerge(base: Obj, update: Obj): void {
  for (const [k, v] of Object.entries(update)) {
    const cur = base[k];
    if (isObj(v) && isObj(cur)) deepMerge(cur, v);
    else base[k] = isObj(v) ? structuredClone(v) : v;
  }
}

/** A mapState whose tiles describe a whole board, as opposed to a diff. */
function fullTileSet(hexes: unknown): hexes is Record<string, Obj> {
  if (!isObj(hexes)) return false;
  const list = Object.values(hexes);
  return list.length >= 7 && list.every((h) => isObj(h) && num(h.x) !== null && num(h.y) !== null && "type" in h);
}

function tileSignature(hexes: Record<string, Obj>): string {
  return Object.entries(hexes)
    .map(([k, h]) => `${k}:${h.x},${h.y},${h.type},${h.diceNumber}`)
    .sort()
    .join("|");
}

export class BoardReader {
  private map: { tileHexStates?: Obj; tileCornerStates?: Obj } = {};
  private signature = "";
  private names: Record<number, string> = {};
  /** Bumps when a different board is dealt, so callers can tell games apart. */
  gameId = 0;

  /** Feed one decoded message. Returns true if the board or names changed. */
  feed(message: unknown): boolean {
    return this.visit(message, 0);
  }

  private visit(v: unknown, depth: number): boolean {
    if (depth > 12 || typeof v !== "object" || v === null) return false;
    if (Array.isArray(v)) {
      let changed = false;
      for (const item of v) changed = this.visit(item, depth + 1) || changed;
      return changed;
    }
    const o = v as Obj;
    let changed = false;
    const username = o.username;
    const color = num(o.selectedColor) ?? num(o.color);
    if (typeof username === "string" && color !== null && this.names[color] !== username) {
      this.names[color] = username;
      changed = true;
    }
    for (const [k, child] of Object.entries(o)) {
      if (k === "mapState" && isObj(child)) changed = this.applyMap(child) || changed;
      else if (isObj(child) || Array.isArray(child)) changed = this.visit(child, depth + 1) || changed;
    }
    return changed;
  }

  private applyMap(m: Obj): boolean {
    const hexes = m.tileHexStates;
    const corners = m.tileCornerStates;
    if (!isObj(hexes) && !isObj(corners)) return false;
    if (fullTileSet(hexes)) {
      const sig = tileSignature(hexes);
      if (sig !== this.signature) {
        this.signature = sig;
        this.map = {};
        this.gameId += 1;
      }
    }
    const slice: Obj = {};
    if (isObj(hexes)) slice.tileHexStates = hexes;
    if (isObj(corners)) slice.tileCornerStates = corners;
    deepMerge(this.map as Obj, slice);
    return true;
  }

  board(): BoardState | null {
    const hexes = this.map.tileHexStates;
    if (!isObj(hexes)) return null;
    const tiles: Tile[] = [];
    for (const h of Object.values(hexes)) {
      if (!isObj(h)) continue;
      const x = num(h.x);
      const y = num(h.y);
      if (x === null || y === null) continue;
      const n = num(h.diceNumber);
      tiles.push({ x, y, resource: tileResource(h.type), number: n && n >= 2 && n <= 12 ? n : null });
    }
    if (tiles.length === 0) return null;

    const buildings: Building[] = [];
    for (const c of Object.values(this.map.tileCornerStates ?? {})) {
      if (!isObj(c)) continue;
      const x = num(c.x);
      const y = num(c.y);
      const z = num(c.z);
      const owner = num(c.owner);
      const type = num(c.buildingType);
      if (x === null || y === null || (z !== 0 && z !== 1) || !owner || !type) continue;
      buildings.push({ x, y, z, owner, city: type === 2 });
    }
    return { tiles, buildings, names: { ...this.names } };
  }
}
