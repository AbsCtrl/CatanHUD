import { describe, expect, it } from "vitest";
import { type BoardState, bestSpots, cornerPoint, pips, playerPips, spots, tileCenter } from "../src/board/board";
import { BoardReader } from "../src/board/extract";
import { pipHistoryCsv, PipStats } from "../src/engine/pipStats";
import { emptyHand } from "../src/types";

/** The 19 tile coordinates of a standard board: cube distance <= 2 from the center. */
function standardCoords(): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (Math.abs(x + y) <= 2) out.push([x, y]);
  return out;
}

const NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

/** Colonist-shaped mapState: tile type 0 is the desert (center), 1-5 the resources. */
function mapState() {
  const tileHexStates: Record<string, object> = {};
  const tileCornerStates: Record<string, object> = {};
  let n = 0;
  standardCoords().forEach(([x, y], i) => {
    const desert = x === 0 && y === 0;
    tileHexStates[i] = { x, y, type: desert ? 0 : (i % 5) + 1, diceNumber: desert ? 0 : NUMBERS[n++] };
    tileCornerStates[2 * i] = { x, y, z: 0 };
    tileCornerStates[2 * i + 1] = { x, y, z: 1 };
  });
  return { tileHexStates, tileCornerStates };
}

function fullMessage() {
  return { id: "130", data: { type: 4, payload: { playerUserStates: [{ username: "Alice", selectedColor: 1 }, { username: "Bob", selectedColor: 2 }], gameState: { mapState: mapState() } } } };
}

function diff(corners: Record<string, object>) {
  return { id: "130", data: { type: 91, payload: { diff: { mapState: { tileCornerStates: corners } } } } };
}

function readBoard(...messages: unknown[]): BoardState {
  const r = new BoardReader();
  for (const m of messages) r.feed(m);
  return r.board()!;
}

describe("board geometry", () => {
  const board: BoardState = { tiles: standardCoords().map(([x, y]) => ({ x, y, resource: "grain", number: 6 })), buildings: [], names: {} };

  it("finds the 54 corners of a standard board, each with 2 or 3 neighbors", () => {
    const all = spots(board);
    expect(all).toHaveLength(54);
    for (const s of all) {
      const near = all.filter((o) => Math.abs(Math.hypot(o.px - s.px, o.py - s.py) - 1) < 0.01).length;
      expect([2, 3]).toContain(near);
    }
  });

  it("puts a z=0 corner on the top of its tile and z=1 on the bottom", () => {
    const [cx, cy] = tileCenter(0, 0);
    const top = cornerPoint({ x: 0, y: 0, z: 0 });
    const bottom = cornerPoint({ x: 0, y: 0, z: 1 });
    expect(top[0]).toBeCloseTo(cx);
    expect(top[1]).toBeCloseTo(cy - 1);
    expect(bottom[1]).toBeCloseTo(cy + 1);
  });

  it("counts pips like the dots on a number token", () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(pips)).toEqual([1, 2, 3, 4, 5, 0, 5, 4, 3, 2, 1]);
    expect(pips(null)).toBe(0);
  });
});

describe("BoardReader", () => {
  it("reads tiles, names and buildings from a full state and its diffs", () => {
    const b = readBoard(fullMessage(), diff({ "0": { owner: 1, buildingType: 1 } }));
    expect(b.tiles).toHaveLength(19);
    expect(b.tiles.filter((t) => t.resource === null)).toHaveLength(1);
    expect(b.names).toEqual({ 1: "Alice", 2: "Bob" });
    expect(b.buildings).toEqual([{ x: -2, y: 0, z: 0, owner: 1, city: false }]);
  });

  it("keeps the owner when a city upgrade only sends the building type", () => {
    const settled = readBoard(fullMessage(), diff({ "20": { owner: 1, buildingType: 1 } }));
    const city = readBoard(fullMessage(), diff({ "20": { owner: 1, buildingType: 1 } }), diff({ "20": { buildingType: 2 } }));
    expect(city.buildings[0]).toMatchObject({ owner: 1, city: true });
    const s = playerPips(settled).get(1)!;
    const c = playerPips(city).get(1)!;
    expect(Object.values(s).reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
    for (const r of Object.keys(s) as (keyof typeof s)[]) expect(c[r]).toBe(2 * s[r]);
  });

  it("starts over when a different board is dealt", () => {
    const r = new BoardReader();
    r.feed(fullMessage());
    r.feed(diff({ "0": { owner: 1, buildingType: 1 } }));
    expect(r.gameId).toBe(1);
    const next = fullMessage();
    const hexes = next.data.payload.gameState.mapState.tileHexStates as Record<string, { diceNumber: number }>;
    hexes["1"].diceNumber = 12;
    next.data.payload.gameState.mapState.tileCornerStates = {};
    r.feed(next);
    expect(r.gameId).toBe(2);
    expect(r.board()!.buildings).toEqual([]);
  });

  it("ignores everything except the board and names", () => {
    const r = new BoardReader();
    expect(r.feed({ data: { payload: { playerStates: [{ resourceCards: { cards: [1, 1, 4] } }] } } })).toBe(false);
    expect(r.board()).toBeNull();
  });
});

describe("best spots", () => {
  it("ranks open spots by pips and skips taken corners and their neighbors", () => {
    const b = readBoard(fullMessage());
    const before = bestSpots(b, 3);
    expect(before[0].pips).toBeGreaterThanOrEqual(before[1].pips);
    const top = before[0];
    // Claim the best spot (any corner sits at the top or bottom of some tile, on or off the board).
    let claim: { x: number; y: number; z: 0 | 1 } | null = null;
    for (let x = -4; x <= 4; x++)
      for (let y = -4; y <= 4; y++)
        for (const z of [0, 1] as const) {
          const p = cornerPoint({ x, y, z });
          if (Math.hypot(p[0] - top.px, p[1] - top.py) < 0.01) claim = { x, y, z };
        }
    expect(claim).not.toBeNull();
    const after = bestSpots(readBoard(fullMessage(), diff({ "999": { ...claim, owner: 2, buildingType: 1 } })), 54);
    expect(after.length).toBeGreaterThan(0);
    for (const s of after) expect(Math.hypot(s.px - top.px, s.py - top.py)).toBeGreaterThan(1.01);
  });
});

describe("PipStats", () => {
  it("averages each player's pips over the rolls and exports CSV", () => {
    const stats = new PipStats();
    const a = { ...emptyHand(), grain: 10, ore: 4 };
    stats.sample(new Map([["Alice", a]]));
    stats.sample(new Map([["Alice", { ...a, ore: 8 }]]));
    expect(stats.average("Alice")).toBe(16);
    const rec = stats.record("1v1", "Alice", new Date("2026-10-17T00:00:00Z"));
    expect(rec.players[0]).toMatchObject({ name: "Alice", rolls: 2, avgPips: 16, finalPips: 18 });
    expect(rec.players[0].avgByResource.ore).toBe(6);
    const csv = pipHistoryCsv([rec]).split("\n");
    expect(csv[0]).toMatch(/^ended_at,mode,player,won,rolls,avg_pips,avg_lumber/);
    expect(csv[1]).toBe("2026-10-17T00:00:00.000Z,1v1,Alice,1,2,16,0,0,0,10,6,18,0,0,0,10,8");
  });
});
