# CatanHUD

A heads-up display for [Colonist.io](https://colonist.io) that tracks what every player is holding, how the dice are rolling, and what's left in the dev card deck. It only reads the public game log, so it shows nothing a careful player at the table couldn't track by hand.

Post-game statistics (luck, dice distribution across games) are planned next.

## Install (development)

```sh
npm install
npm run build
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist/` folder. Open a game on colonist.io and the panel appears on the right; drag it by its header.

Type your Colonist username into the panel's **Settings** box so lines that say "you" are credited to you.

## What it shows

- **Resources:** each player's cards by type and total, plus what's left in the bank. When someone steals a card you couldn't see, the count shows a range like `0–1` (hover for the expected value), and it narrows as later builds and trades rule options out.
- **Dice:** a histogram of rolls so far against the expected 2d6 curve.
- **Dev cards:** cards left in the deck, and the odds of each type on the next buy based on what has been played.
- **Hints:** what you can build now, what you're one card from, who is over 7 cards, and the best steal target by hand size.

## If counts look wrong

Colonist changes its page from time to time. Click **Copy log** in the panel header and paste the result into an issue; it contains the raw log entries, which become test fixtures.

## Development

```sh
npm test          # unit tests (parser, tracker, log finder)
npm run typecheck
npm run watch     # rebuild on change, then hit reload in chrome://extensions
```

Layout:

- `src/parser/` turns a log entry into a typed event (`tokenize.ts` maps icons to `{lumber}`-style tokens, `parseLine.ts` matches the phrasing).
- `src/engine/` is pure state: `hands.ts` tracks possible hands across unknown steals, `game.ts` applies events, `hints.ts` builds suggestions.
- `src/content/` is the browser side: `logSource.ts` finds and watches the game log, `hud.ts` draws the panel in a Shadow DOM.
