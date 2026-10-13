export const RESOURCES = ["lumber", "brick", "wool", "grain", "ore"] as const;
export type Resource = (typeof RESOURCES)[number];

export type Hand = Record<Resource, number>;

export const DEV_CARDS = ["knight", "victoryPoint", "roadBuilding", "yearOfPlenty", "monopoly"] as const;
export type DevCard = (typeof DEV_CARDS)[number];

export type Piece = "road" | "settlement" | "city";

export type GameEvent =
  | { type: "roll"; player: string; dice: [number, number] }
  | { type: "gain"; player: string; cards: Hand; source: "production" | "starting" | "yearOfPlenty" }
  | { type: "build"; player: string; piece: Piece; free: boolean }
  | { type: "buyDev"; player: string; card: DevCard | null }
  | { type: "playDev"; player: string; card: DevCard }
  | { type: "steal"; thief: string; victim: string; resource: Resource | null }
  | { type: "monopoly"; player: string; resource: Resource; count: number }
  | { type: "discard"; player: string; cards: Hand }
  | { type: "bankTrade"; player: string; gave: Hand; took: Hand }
  | { type: "playerTrade"; player: string; partner: string; gave: Hand; got: Hand }
  | { type: "gameOver"; winner: string };

export function emptyHand(): Hand {
  return { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
}

export function handTotal(hand: Hand): number {
  return RESOURCES.reduce((sum, r) => sum + hand[r], 0);
}

export const COSTS: Record<Piece | "devCard", Hand> = {
  road: { lumber: 1, brick: 1, wool: 0, grain: 0, ore: 0 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1, ore: 0 },
  city: { lumber: 0, brick: 0, wool: 0, grain: 2, ore: 3 },
  devCard: { lumber: 0, brick: 0, wool: 1, grain: 1, ore: 1 },
};
