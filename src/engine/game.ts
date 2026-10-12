import { COSTS, DEV_CARDS, type DevCard, emptyHand, type GameEvent, type Resource } from "../types";
import { HandTracker } from "./hands";

/** Base game development deck. */
export const DEV_DECK: Record<DevCard, number> = {
  knight: 14,
  victoryPoint: 5,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
};
const DEV_DECK_SIZE = Object.values(DEV_DECK).reduce((a, b) => a + b, 0);

export interface PlayerStats {
  devBought: number;
  devPlayed: Record<DevCard, number>;
  roads: number;
  settlements: number;
  cities: number;
  /** Cards received from production rolls (not starting resources). */
  produced: number;
  stolenFrom: number;
  discarded: number;
}

function emptyStats(): PlayerStats {
  const devPlayed = Object.fromEntries(DEV_CARDS.map((c) => [c, 0])) as Record<DevCard, number>;
  return { devBought: 0, devPlayed, roads: 0, settlements: 0, cities: 0, produced: 0, stolenFrom: 0, discarded: 0 };
}

/**
 * Consumes parsed log events and keeps the derived game state: hands, dice
 * counts, dev card deck, per-player stats. Pure (no DOM), so it can be unit
 * tested and replayed from a saved event list.
 */
export class Game {
  readonly hands = new HandTracker();
  readonly dice: number[] = new Array(13).fill(0);
  readonly stats = new Map<string, PlayerStats>();
  readonly events: GameEvent[] = [];
  winner: string | null = null;
  /** Roads still owed from a Road Building card, per player. */
  private freeRoads = new Map<string, number>();

  /** @param selfName your Colonist username, so "you" in the log maps to it. */
  constructor(public selfName: string | null = null) {}

  get players(): string[] {
    return [...this.stats.keys()];
  }

  get rolls(): number {
    return this.dice.reduce((a, b) => a + b, 0);
  }

  private name(raw: string): string {
    if (/^you$/i.test(raw)) return this.selfName ?? "You";
    return raw;
  }

  private player(raw: string): PlayerStats {
    const name = this.name(raw);
    let s = this.stats.get(name);
    if (!s) {
      s = emptyStats();
      this.stats.set(name, s);
      this.hands.ensurePlayer(name);
    }
    return s;
  }

  apply(ev: GameEvent): void {
    this.events.push(ev);
    switch (ev.type) {
      case "roll": {
        this.player(ev.player);
        this.dice[ev.dice[0] + ev.dice[1]] += 1;
        break;
      }
      case "gain": {
        const s = this.player(ev.player);
        if (ev.source === "production") s.produced += Object.values(ev.cards).reduce((a, b) => a + b, 0);
        this.hands.add(this.name(ev.player), ev.cards);
        break;
      }
      case "build": {
        const s = this.player(ev.player);
        const name = this.name(ev.player);
        if (ev.piece === "road") s.roads += 1;
        else if (ev.piece === "settlement") s.settlements += 1;
        else {
          s.cities += 1;
          s.settlements = Math.max(0, s.settlements - 1);
        }
        const owed = this.freeRoads.get(name) ?? 0;
        if (ev.piece === "road" && owed > 0) {
          this.freeRoads.set(name, owed - 1);
        } else if (!ev.free) {
          this.hands.remove(name, COSTS[ev.piece]);
        }
        break;
      }
      case "buyDev": {
        this.player(ev.player).devBought += 1;
        this.hands.remove(this.name(ev.player), COSTS.devCard);
        break;
      }
      case "playDev": {
        this.player(ev.player).devPlayed[ev.card] += 1;
        if (ev.card === "roadBuilding") this.freeRoads.set(this.name(ev.player), 2);
        break;
      }
      case "steal": {
        this.player(ev.thief);
        this.player(ev.victim).stolenFrom += 1;
        const thief = this.name(ev.thief);
        const victim = this.name(ev.victim);
        if (ev.resource) {
          const cards = emptyHand();
          cards[ev.resource] = 1;
          this.hands.transfer(victim, thief, cards);
        } else {
          this.hands.stealUnknown(thief, victim);
        }
        break;
      }
      case "monopoly": {
        this.player(ev.player);
        this.hands.monopoly(this.name(ev.player), ev.resource, ev.count);
        break;
      }
      case "discard": {
        const s = this.player(ev.player);
        s.discarded += Object.values(ev.cards).reduce((a, b) => a + b, 0);
        this.hands.remove(this.name(ev.player), ev.cards);
        break;
      }
      case "bankTrade": {
        this.player(ev.player);
        const name = this.name(ev.player);
        this.hands.remove(name, ev.gave);
        this.hands.add(name, ev.took);
        break;
      }
      case "playerTrade": {
        this.player(ev.player);
        this.player(ev.partner);
        const a = this.name(ev.player);
        const b = this.name(ev.partner);
        this.hands.transfer(a, b, ev.gave);
        this.hands.transfer(b, a, ev.got);
        break;
      }
      case "gameOver": {
        this.winner = this.name(ev.winner);
        break;
      }
    }
  }

  /** Dev cards not yet bought by anyone. */
  devDeckRemaining(): number {
    let bought = 0;
    for (const s of this.stats.values()) bought += s.devBought;
    return Math.max(0, DEV_DECK_SIZE - bought);
  }

  /**
   * Chance that the next dev card bought is each type. Cards bought but not yet
   * played are unknown to us, so by symmetry the next draw is distributed like
   * all cards that haven't been revealed by being played.
   */
  devOdds(): Record<DevCard, number> {
    const unseen = { ...DEV_DECK };
    let unseenTotal = DEV_DECK_SIZE;
    for (const s of this.stats.values()) {
      for (const c of DEV_CARDS) {
        unseen[c] -= s.devPlayed[c];
        unseenTotal -= s.devPlayed[c];
      }
    }
    const out = {} as Record<DevCard, number>;
    for (const c of DEV_CARDS) out[c] = unseenTotal > 0 ? Math.max(0, unseen[c]) / unseenTotal : 0;
    return out;
  }

  /** Expected count of each dice total for the rolls so far. */
  expectedDice(): number[] {
    const n = this.rolls;
    return this.dice.map((_, total) => (total < 2 ? 0 : (n * (6 - Math.abs(7 - total))) / 36));
  }

  resourceCount(player: string, r: Resource): { min: number; max: number } {
    const range = this.hands.range(player);
    return { min: range.min[r], max: range.max[r] };
  }
}
