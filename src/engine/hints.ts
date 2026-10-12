import { COSTS, type Hand, type Piece, RESOURCES } from "../types";
import type { Game } from "./game";

const BUILD_LABEL: Record<Piece | "devCard", string> = {
  road: "Road",
  settlement: "Settlement",
  city: "City",
  devCard: "Dev card",
};

function missing(hand: Hand, cost: Hand): number {
  return RESOURCES.reduce((sum, r) => sum + Math.max(0, cost[r] - hand[r]), 0);
}

/** Short, plain-language suggestions shown under the tracker. */
export function hints(game: Game): string[] {
  const out: string[] = [];
  const me = game.selfName;

  if (me && game.stats.has(me)) {
    const hand = game.hands.range(me).min;
    const can: string[] = [];
    const close: string[] = [];
    for (const item of Object.keys(COSTS) as (Piece | "devCard")[]) {
      const gap = missing(hand, COSTS[item]);
      if (gap === 0) can.push(BUILD_LABEL[item]);
      else if (gap === 1) close.push(BUILD_LABEL[item]);
    }
    if (can.length) out.push(`You can build: ${can.join(", ")}.`);
    if (close.length) out.push(`One card away from: ${close.join(", ")}.`);
    const total = game.hands.range(me).total;
    if (total > 7) out.push(`You hold ${total} cards; a 7 would cost you ${Math.floor(total / 2)}.`);
  }

  const others = game.players.filter((p) => p !== me);
  const atRisk = others.filter((p) => game.hands.range(p).total > 7);
  if (atRisk.length) out.push(`Over 7 cards: ${atRisk.join(", ")}.`);

  const richest = others
    .map((p) => ({ p, total: game.hands.range(p).total }))
    .sort((a, b) => b.total - a.total)[0];
  if (richest && richest.total > 0) out.push(`Best steal target by hand size: ${richest.p} (${richest.total} cards).`);

  if (game.hands.desynced) out.push("Tracker missed part of the log, so counts may be off.");
  return out;
}
