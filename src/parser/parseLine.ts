import { DEV_CARDS, emptyHand, type DevCard, type GameEvent, type Hand, type Piece, type Resource, RESOURCES } from "../types";

/**
 * Parses one tokenized log line (see tokenize.ts) into a game event.
 * Returns null for lines we don't track (chat, system messages, robber moves...).
 *
 * The phrasing below is what the Colonist log uses for base-game actions.
 * Unrecognized lines are ignored rather than guessed at, so a wording change
 * shows up as missing data instead of wrong data.
 */

const RES_SET = new Set<string>(RESOURCES);
const DEV_SET = new Set<string>(DEV_CARDS);

function cardsIn(text: string): Hand {
  const hand = emptyHand();
  for (const m of text.matchAll(/(?:(\d+)\s*)?\{(\w+)\}/g)) {
    if (RES_SET.has(m[2])) hand[m[2] as Resource] += m[1] ? Number(m[1]) : 1;
  }
  return hand;
}

function firstResource(text: string): Resource | null {
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (RES_SET.has(m[1])) return m[1] as Resource;
  }
  return null;
}

function firstDevCard(text: string): DevCard | null {
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (DEV_SET.has(m[1])) return m[1] as DevCard;
  }
  // Some log variants name the card in text instead of (or as well as) an icon.
  const t = text.toLowerCase();
  if (t.includes("knight")) return "knight";
  if (t.includes("road building")) return "roadBuilding";
  if (t.includes("year of plenty")) return "yearOfPlenty";
  if (t.includes("monopoly")) return "monopoly";
  return null;
}

function piece(text: string): Piece | null {
  if (/\{city\}|\bcity\b/i.test(text)) return "city";
  if (/\{settlement\}|\bsettlement\b/i.test(text)) return "settlement";
  if (/\{road\}|\broad\b/i.test(text)) return "road";
  return null;
}

/** Player names: anything before the verb, trimmed. */
const NAME = "(.+?)";

type Rule = [RegExp, (m: RegExpMatchArray) => GameEvent | null];

const RULES: Rule[] = [
  [
    new RegExp(`^${NAME} rolled\\b(.*)$`),
    (m) => {
      const dice = [...m[2].matchAll(/\{dice(\d)\}/g)].map((d) => Number(d[1]));
      if (dice.length < 2) {
        const nums = [...m[2].matchAll(/\b([1-6])\b/g)].map((d) => Number(d[1]));
        dice.push(...nums);
      }
      return dice.length >= 2 ? { type: "roll", player: m[1], dice: [dice[0], dice[1]] } : null;
    },
  ],
  [
    new RegExp(`^${NAME} received starting resources\\b(.*)$`),
    (m) => ({ type: "gain", player: m[1], cards: cardsIn(m[2]), source: "starting" }),
  ],
  [
    new RegExp(`^${NAME} (?:got|received)\\b(.*)$`),
    (m) => ({ type: "gain", player: m[1], cards: cardsIn(m[2]), source: "production" }),
  ],
  [
    new RegExp(`^${NAME} took from bank\\b(.*)$`),
    (m) => ({ type: "gain", player: m[1], cards: cardsIn(m[2]), source: "yearOfPlenty" }),
  ],
  [
    new RegExp(`^${NAME} placed an? (.*)$`),
    (m) => {
      const p = piece(m[2]);
      return p ? { type: "build", player: m[1], piece: p, free: true } : null;
    },
  ],
  [
    new RegExp(`^${NAME} built an? (.*)$`),
    (m) => {
      const p = piece(m[2]);
      return p ? { type: "build", player: m[1], piece: p, free: false } : null;
    },
  ],
  [new RegExp(`^${NAME} bought\\b(.*)$`), (m) => ({ type: "buyDev", player: m[1] })],
  [
    new RegExp(`^${NAME} used\\b(.*)$`),
    (m) => {
      const card = firstDevCard(m[2]);
      return card ? { type: "playDev", player: m[1], card } : null;
    },
  ],
  [
    new RegExp(`^${NAME} stole (.*?) from:? (.+)$`),
    (m) => ({ type: "steal", thief: m[1], victim: m[3], resource: firstResource(m[2]) }),
  ],
  [
    // Monopoly result: "Alice stole 5 {wool}" (no victim).
    new RegExp(`^${NAME} stole (\\d+)\\s*\\{(\\w+)\\}$`),
    (m) => (RES_SET.has(m[3]) ? { type: "monopoly", player: m[1], resource: m[3] as Resource, count: Number(m[2]) } : null),
  ],
  [
    new RegExp(`^${NAME} discarded\\b(.*)$`),
    (m) => ({ type: "discard", player: m[1], cards: cardsIn(m[2]) }),
  ],
  [
    new RegExp(`^${NAME} gave bank (.*?) and took (.*)$`),
    (m) => ({ type: "bankTrade", player: m[1], gave: cardsIn(m[2]), took: cardsIn(m[3]) }),
  ],
  [
    new RegExp(`^${NAME} traded (.*?) for (.*?) with:? (.+)$`),
    (m) => ({ type: "playerTrade", player: m[1], partner: m[4].trim(), gave: cardsIn(m[2]), got: cardsIn(m[3]) }),
  ],
  [new RegExp(`^${NAME} (?:won the game|is the winner|has won)`), (m) => ({ type: "gameOver", winner: m[1] })],
];

export function parseLine(line: string): GameEvent | null {
  // Strip a leading icon (avatars) and trailing punctuation.
  const text = line.replace(/^(\{\w+\}\s*)+/, "").replace(/[.!]+$/, "").trim();
  for (const [re, build] of RULES) {
    const m = text.match(re);
    if (m) {
      const ev = build(m);
      if (ev) return trimNames(ev);
    }
  }
  return null;
}

function trimNames(ev: GameEvent): GameEvent {
  const clean = (s: string) => s.replace(/\{\w+\}/g, "").trim();
  const out: Record<string, unknown> = { ...ev };
  for (const key of ["player", "thief", "victim", "partner", "winner"]) {
    if (typeof out[key] === "string") out[key] = clean(out[key] as string);
  }
  return out as GameEvent;
}
