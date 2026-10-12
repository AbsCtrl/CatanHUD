import { emptyHand, handTotal, type Hand, type Resource, RESOURCES } from "../types";

/**
 * Tracks every player's resource hand from public information.
 *
 * Most log events say exactly which cards moved. The exception is a steal you
 * didn't take part in: the log only says "a card" was stolen. To handle that we
 * keep a set of possible "worlds" (one hand per player each). An unknown steal
 * forks each world into one per resource the victim could have held; later
 * events that require cards (building, trading, discarding) prune the worlds
 * where the player couldn't have paid. Identical worlds are merged.
 *
 * If a log gap makes every world impossible, we fall back to clamping at zero
 * and flag the tracker as `desynced` so the HUD can say so.
 */

type World = { hands: Map<string, Hand>; weight: number };

const MAX_WORLDS = 4000;

export interface HandRange {
  min: Hand;
  max: Hand;
  /** Probability-weighted average count across the surviving worlds. */
  expected: Hand;
  total: number;
}

export class HandTracker {
  private worlds: World[] = [{ hands: new Map(), weight: 1 }];
  desynced = false;

  get players(): string[] {
    return [...this.worlds[0].hands.keys()];
  }

  get worldCount(): number {
    return this.worlds.length;
  }

  ensurePlayer(name: string): void {
    for (const w of this.worlds) if (!w.hands.has(name)) w.hands.set(name, emptyHand());
  }

  add(player: string, cards: Hand): void {
    this.ensurePlayer(player);
    for (const w of this.worlds) {
      const h = w.hands.get(player)!;
      for (const r of RESOURCES) h[r] += cards[r];
    }
  }

  /** Remove cards the player must have had. Prunes worlds where they couldn't. */
  remove(player: string, cards: Hand): void {
    this.ensurePlayer(player);
    const ok = this.worlds.filter((w) => {
      const h = w.hands.get(player)!;
      return RESOURCES.every((r) => h[r] >= cards[r]);
    });
    if (ok.length === 0) {
      this.desynced = true;
    } else {
      this.worlds = normalize(ok);
    }
    for (const w of this.worlds) {
      const h = w.hands.get(player)!;
      for (const r of RESOURCES) h[r] = Math.max(0, h[r] - cards[r]);
    }
  }

  transfer(from: string, to: string, cards: Hand): void {
    this.remove(from, cards);
    this.add(to, cards);
  }

  /** A steal where we don't know which resource moved. */
  stealUnknown(thief: string, victim: string): void {
    this.ensurePlayer(thief);
    this.ensurePlayer(victim);
    const next: World[] = [];
    for (const w of this.worlds) {
      const v = w.hands.get(victim)!;
      const total = handTotal(v);
      for (const r of RESOURCES) {
        if (v[r] === 0) continue;
        // A random card is stolen, so each resource is as likely as its share of the hand.
        const copy = cloneWorld(w, (w.weight * v[r]) / total);
        copy.hands.get(victim)![r] -= 1;
        copy.hands.get(thief)![r] += 1;
        next.push(copy);
      }
    }
    if (next.length === 0) {
      // Victim had no cards in any world: the log and our state disagree.
      this.desynced = true;
      return;
    }
    this.worlds = normalize(dedupe(next).sort((a, b) => b.weight - a.weight).slice(0, MAX_WORLDS));
  }

  /** Monopoly: `player` takes every `resource` from everyone else. */
  monopoly(player: string, resource: Resource, count: number): void {
    this.ensurePlayer(player);
    const consistent = this.worlds.filter((w) => {
      let sum = 0;
      for (const [name, h] of w.hands) if (name !== player) sum += h[resource];
      return sum === count;
    });
    if (consistent.length > 0) this.worlds = normalize(consistent);
    else this.desynced = true;
    for (const w of this.worlds) {
      for (const [name, h] of w.hands) if (name !== player) h[resource] = 0;
      w.hands.get(player)![resource] += count;
    }
    this.worlds = dedupe(this.worlds);
  }

  range(player: string): HandRange {
    this.ensurePlayer(player);
    const min = emptyHand();
    const max = emptyHand();
    const expected = emptyHand();
    for (const r of RESOURCES) min[r] = Infinity;
    for (const w of this.worlds) {
      const h = w.hands.get(player)!;
      for (const r of RESOURCES) {
        min[r] = Math.min(min[r], h[r]);
        max[r] = Math.max(max[r], h[r]);
        expected[r] += h[r] * w.weight;
      }
    }
    return { min, max, expected, total: handTotal(this.worlds[0].hands.get(player)!) };
  }

  /** Cards of each resource still in the bank (19 of each in the base game). */
  bank(): Hand {
    const bank: Hand = { lumber: 19, brick: 19, wool: 19, grain: 19, ore: 19 };
    for (const h of this.worlds[0].hands.values()) for (const r of RESOURCES) bank[r] -= h[r];
    return bank;
  }
}

function cloneWorld(w: World, weight = w.weight): World {
  const hands = new Map<string, Hand>();
  for (const [name, h] of w.hands) hands.set(name, { ...h });
  return { hands, weight };
}

function normalize(worlds: World[]): World[] {
  const sum = worlds.reduce((s, w) => s + w.weight, 0);
  for (const w of worlds) w.weight /= sum;
  return worlds;
}

function key(w: World): string {
  return [...w.hands.entries()].map(([n, h]) => n + ":" + RESOURCES.map((r) => h[r]).join(",")).join("|");
}

/** Merge identical worlds, summing their weights. */
function dedupe(worlds: World[]): World[] {
  const byKey = new Map<string, World>();
  for (const w of worlds) {
    const k = key(w);
    const existing = byKey.get(k);
    if (existing) existing.weight += w.weight;
    else byKey.set(k, w);
  }
  return [...byKey.values()];
}
