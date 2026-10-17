import { emptyHand, type Hand, handTotal, RESOURCES } from "../types";

/**
 * Pips each player holds, sampled at every dice roll, so a finished game can
 * say "Alice averaged 24 pips per roll". Saved games feed later analysis of
 * what pip count tends to win.
 */

export interface PlayerPipRecord {
  name: string;
  /** Rolls this player was sampled on (rolls after their first building). */
  rolls: number;
  avgPips: number;
  avgByResource: Hand;
  finalPips: number;
  finalByResource: Hand;
}

export interface GamePipRecord {
  endedAt: string;
  mode: string;
  winner: string | null;
  players: PlayerPipRecord[];
}

interface Sums {
  rolls: number;
  by: Hand;
}

export class PipStats {
  private sums = new Map<string, Sums>();
  private latest = new Map<string, Hand>();

  /** Record one roll: each player's pips per resource at that moment. */
  sample(pips: Map<string, Hand>): void {
    for (const [name, hand] of pips) {
      let s = this.sums.get(name);
      if (!s) this.sums.set(name, (s = { rolls: 0, by: emptyHand() }));
      s.rolls += 1;
      for (const r of RESOURCES) s.by[r] += hand[r];
      this.latest.set(name, { ...hand });
    }
  }

  get empty(): boolean {
    return this.sums.size === 0;
  }

  /** Average total pips per roll so far, or null if never sampled. */
  average(name: string): number | null {
    const s = this.sums.get(name);
    return s && s.rolls > 0 ? handTotal(s.by) / s.rolls : null;
  }

  record(mode: string, winner: string | null, now = new Date()): GamePipRecord {
    const players = [...this.sums].map(([name, s]) => {
      const avgByResource = emptyHand();
      for (const r of RESOURCES) avgByResource[r] = round(s.by[r] / s.rolls);
      const finalByResource = this.latest.get(name) ?? emptyHand();
      return {
        name,
        rolls: s.rolls,
        avgPips: round(handTotal(s.by) / s.rolls),
        avgByResource,
        finalPips: handTotal(finalByResource),
        finalByResource,
      };
    });
    return { endedAt: now.toISOString(), mode, winner, players };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One row per player per game, ready to paste into a spreadsheet. */
export function pipHistoryCsv(games: GamePipRecord[]): string {
  const header = `ended_at,mode,player,won,rolls,avg_pips,${RESOURCES.map((r) => `avg_${r}`).join(",")},final_pips,${RESOURCES.map((r) => `final_${r}`).join(",")}`;
  const rows = games.flatMap((g) =>
    g.players.map((p) =>
      [
        g.endedAt,
        csv(g.mode),
        csv(p.name),
        g.winner === null ? "" : g.winner === p.name ? 1 : 0,
        p.rolls,
        p.avgPips,
        ...RESOURCES.map((r) => p.avgByResource[r]),
        p.finalPips,
        ...RESOURCES.map((r) => p.finalByResource[r]),
      ].join(","),
    ),
  );
  return [header, ...rows].join("\n");
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
