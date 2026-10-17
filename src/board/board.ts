import { emptyHand, type Hand, type Resource } from "../types";

/**
 * The board as Colonist describes it, reduced to what's public: tiles with
 * their number tokens, and which corners hold whose settlement or city.
 *
 * Coordinates are Colonist's own. A tile is (x, y) on a cube-coordinate hex
 * grid; a corner is (x, y, z) where z = 0 is the top corner of tile (x, y)
 * and z = 1 its bottom corner. The geometry below puts them in pixel space
 * (hex circumradius 1) the way the board looks on screen: pointy-top hexes,
 * flat rows.
 */

export interface Tile {
  x: number;
  y: number;
  /** null for the desert (or any tile type we don't know). */
  resource: Resource | null;
  /** Number token, null when there is none. */
  number: number | null;
}

export interface Building {
  x: number;
  y: number;
  z: 0 | 1;
  /** Colonist's player color id. */
  owner: number;
  city: boolean;
}

export interface BoardState {
  tiles: Tile[];
  buildings: Building[];
  /** Player color id -> username, when the game told us. */
  names: Record<number, string>;
}

const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Dots under a number token: how many of the 36 dice outcomes roll it. */
export function pips(n: number | null): number {
  return n === null ? 0 : (PIPS[n] ?? 0);
}

const SQRT3 = Math.sqrt(3);
const ROT = (-30 * Math.PI) / 180;

function rotate(x: number, y: number): [number, number] {
  return [x * Math.cos(ROT) - y * Math.sin(ROT), x * Math.sin(ROT) + y * Math.cos(ROT)];
}

function polar(deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return rotate(Math.cos(r), Math.sin(r));
}

export function tileCenter(x: number, y: number): [number, number] {
  const z = -x - y;
  return rotate(x - 0.5 * y - 0.5 * z, (SQRT3 / 2) * (y - z));
}

/** Pixel corners of a tile, clockwise from the right-hand upper corner. */
export function tileCorners(t: { x: number; y: number }): [number, number][] {
  const [cx, cy] = tileCenter(t.x, t.y);
  return [0, 60, 120, 180, 240, 300].map((deg) => {
    const [dx, dy] = polar(deg);
    return [cx + dx, cy + dy];
  });
}

export function cornerPoint(c: { x: number; y: number; z: number }): [number, number] {
  const [cx, cy] = tileCenter(c.x, c.y);
  const [dx, dy] = polar(c.z === 0 ? 300 : 120);
  return [cx + dx, cy + dy];
}

function key([x, y]: [number, number]): string {
  return `${Math.round(x * 100)},${Math.round(y * 100)}`;
}

/** A place a settlement can go: one corner of the board and the tiles it touches. */
export interface Spot {
  key: string;
  px: number;
  py: number;
  tiles: Tile[];
  pips: number;
  building: Building | null;
  /** Taken, or next to a building (the distance rule). */
  blocked: boolean;
}

/** Every corner on the board with what it produces and whether it's still open. */
export function spots(board: BoardState): Spot[] {
  const byKey = new Map<string, Spot>();
  for (const t of board.tiles) {
    for (const p of tileCorners(t)) {
      const k = key(p);
      let s = byKey.get(k);
      if (!s) {
        s = { key: k, px: p[0], py: p[1], tiles: [], pips: 0, building: null, blocked: false };
        byKey.set(k, s);
      }
      s.tiles.push(t);
      if (t.resource) s.pips += pips(t.number);
    }
  }
  for (const b of board.buildings) {
    const s = byKey.get(key(cornerPoint(b)));
    if (s) s.building = b;
  }
  const all = [...byKey.values()];
  for (const s of all) {
    if (!s.building) continue;
    s.blocked = true;
    // Neighboring corners sit exactly one hex side (length 1) away.
    for (const o of all) if (Math.abs(Math.hypot(o.px - s.px, o.py - s.py) - 1) < 0.01) o.blocked = true;
  }
  return all;
}

/** Open spots, most pips first; ties go to the spot touching more resource types. */
export function bestSpots(board: BoardState, n = 5): Spot[] {
  const variety = (s: Spot) => new Set(s.tiles.filter((t) => t.resource && t.number).map((t) => t.resource)).size;
  return spots(board)
    .filter((s) => !s.blocked && s.pips > 0)
    .sort((a, b) => b.pips - a.pips || variety(b) - variety(a))
    .slice(0, n);
}

/** Pips per resource for each player's buildings; cities count double. Keyed by color id. */
export function playerPips(board: BoardState): Map<number, Hand> {
  const out = new Map<number, Hand>();
  for (const s of spots(board)) {
    const b = s.building;
    if (!b) continue;
    let hand = out.get(b.owner);
    if (!hand) out.set(b.owner, (hand = emptyHand()));
    for (const t of s.tiles) if (t.resource) hand[t.resource] += pips(t.number) * (b.city ? 2 : 1);
  }
  return out;
}

/** Colonist's player colors by id, used for the mini-map and as a fallback name. */
export const PLAYER_COLORS: Record<number, { name: string; hex: string }> = {
  1: { name: "Red", hex: "#e27174" },
  2: { name: "Blue", hex: "#4a64d8" },
  3: { name: "Orange", hex: "#e09742" },
  4: { name: "Green", hex: "#62b95d" },
  5: { name: "Black", hex: "#3e3e3e" },
  6: { name: "Bronze", hex: "#a86755" },
  7: { name: "Silver", hex: "#848484" },
  8: { name: "Gold", hex: "#c7ae61" },
  9: { name: "White", hex: "#e8e8e8" },
  10: { name: "Purple", hex: "#9d55af" },
};

export function playerName(board: BoardState, color: number): string {
  return board.names[color] ?? PLAYER_COLORS[color]?.name ?? `Player ${color}`;
}
