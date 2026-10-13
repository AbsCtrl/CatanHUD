# CatanHUD

A heads-up display for [Colonist.io](https://colonist.io) that tracks what every player is holding, how the dice are rolling, and what's left in the dev card deck. It only reads the public game log, so it shows nothing a careful player at the table couldn't track by hand.

Post-game statistics (luck, dice distribution across games) are planned next.

## Install (development)

```sh
npm install
npm run build
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist/` folder. Open a game on colonist.io and the panel appears on the right. Drag it by its header, use **A−/A+** to resize the text, and click a section title to fold it away. The panel remembers its position, size and folded sections.

Open **Settings** in the panel and type your Colonist username so lines that say "you" are credited to you.

## What it shows

- **Cards:** each player's cards by type and total, plus what's left in the bank. Names are shown in each player's game color. When someone steals a card you couldn't see, the affected counts turn amber with a `?` and show the most likely value; hover for the full range. They firm up as later builds and trades rule options out.
- **Game mode and discard limit:** the header shows the mode (1v1 or the player count) and the discard limit: 9 in 1v1, 7 otherwise. A total over the limit turns red. You can fix the limit in **Settings** if a lobby uses a different rule.
- **Dev cards:** cards left in the deck, and how many of each type haven't been seen yet (still in the deck or in someone's hand). Your own purchases are counted from the card face the log shows you, and each opponent's unplayed count is listed.
- **Dice:** a histogram of rolls against the expected 2d6 curve (folded by default).

## If counts look wrong

Colonist changes its page from time to time. Click **Copy log** under the panel's **Settings** and paste the result into an issue; it contains the raw log entries, which become test fixtures.

## Development

```sh
npm test          # unit tests (parser, tracker, log finder)
npm run typecheck
npm run watch     # rebuild on change, then hit reload in chrome://extensions
```

Layout:

- `src/parser/` turns a log entry into a typed event (`tokenize.ts` maps icons to `{lumber}`-style tokens, `parseLine.ts` matches the phrasing).
- `src/engine/` is pure state: `hands.ts` tracks possible hands across unknown steals, `game.ts` applies events and derives counts..
- `src/content/` is the browser side: `logSource.ts` finds and watches the game log, `hud.ts` draws the panel in a Shadow DOM.
