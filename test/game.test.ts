import { describe, expect, it } from "vitest";
import { Game } from "../src/engine/game";
import { hints } from "../src/engine/hints";
import { parseLine } from "../src/parser/parseLine";

function play(lines: string[], self: string | null = null): Game {
  const g = new Game(self);
  for (const l of lines) {
    const ev = parseLine(l);
    if (!ev) throw new Error(`unparsed: ${l}`);
    g.apply(ev);
  }
  return g;
}

describe("Game", () => {
  it("tracks exact hands through gains, builds and trades", () => {
    const g = play([
      "Alice received starting resources {lumber} {brick} {wool}",
      "Bob received starting resources {grain} {ore} {ore}",
      "Alice rolled {dice2} {dice4}",
      "Alice got {lumber} {grain}",
      "Alice built a {road}",
      "Alice traded {wool} for {ore} with Bob",
      "Bob gave bank {grain} {grain} {grain} {grain} and took {brick}",
    ]);
    // Bob only had 1 grain, so the bank trade line is inconsistent: tracker flags it.
    expect(g.hands.desynced).toBe(true);
    const a = g.hands.range("Alice");
    expect(a.min).toEqual({ lumber: 1, brick: 0, wool: 0, grain: 1, ore: 1 });
    expect(a.total).toBe(3);
    expect(g.dice[6]).toBe(1);
  });

  it("forks on an unknown steal and resolves it when the thief builds", () => {
    const g = play([
      "Bob received starting resources {grain} {ore}",
      "Alice stole {resBack} from Bob",
    ]);
    let a = g.hands.range("Alice");
    expect(a.total).toBe(1);
    expect(a.min.grain).toBe(0);
    expect(a.max.grain).toBe(1);
    expect(a.expected.grain).toBeCloseTo(0.5);
    expect(g.hands.worldCount).toBe(2);

    // Alice can only pay for a city if the stolen card was ore.
    g.apply(parseLine("Alice got {grain} {grain} {ore} {ore}")!);
    g.apply(parseLine("Alice built a {city}")!);
    a = g.hands.range("Alice");
    expect(g.hands.worldCount).toBe(1);
    expect(a.total).toBe(0);
    expect(g.hands.range("Bob").min).toEqual({ lumber: 0, brick: 0, wool: 0, grain: 1, ore: 0 });
    expect(g.hands.desynced).toBe(false);
  });

  it("weights steal outcomes by the victim's hand", () => {
    const g = play(["Bob received starting resources {grain} {grain} {grain} {ore}", "Alice stole {resBack} from Bob"]);
    expect(g.hands.range("Alice").expected.grain).toBeCloseTo(0.75);
  });

  it("applies monopoly and uses the count to prune worlds", () => {
    const g = play([
      "Bob received starting resources {wool} {ore}",
      "Carol received starting resources {wool} {wool}",
      "Alice stole {resBack} from Bob",
      "Alice used {monopoly}",
      "Alice stole 2 {wool}",
    ]);
    // Only 2 wool left outside Alice means she stole Bob's wool.
    expect(g.hands.worldCount).toBe(1);
    expect(g.hands.range("Alice").min.wool).toBe(3);
    expect(g.hands.range("Bob").min).toMatchObject({ wool: 0, ore: 1 });
  });

  it("does not charge for Road Building roads or setup placements", () => {
    const g = play([
      "Alice placed a {settlement}",
      "Alice placed a {road}",
      "Alice used {roadBuilding}",
      "Alice built a {road}",
      "Alice built a {road}",
    ]);
    expect(g.hands.desynced).toBe(false);
    expect(g.stats.get("Alice")!.roads).toBe(3);
  });

  it("maps 'you' to the configured name", () => {
    const g = play(["Me received starting resources {brick}", "Bob stole {brick} from you"], "Me");
    expect(g.hands.range("Me").total).toBe(0);
    expect(g.hands.range("Bob").min.brick).toBe(1);
  });

  it("computes dev deck and odds from played cards", () => {
    const g = play([
      "Alice received starting resources {wool} {grain} {ore}",
      "Alice bought {devBack}",
      "Alice used {knight}",
    ]);
    expect(g.devDeckRemaining()).toBe(24);
    expect(g.devOdds().knight).toBeCloseTo(13 / 24);
    expect(g.devOdds().monopoly).toBeCloseTo(2 / 24);
  });

  it("computes bank counts and expected dice", () => {
    const g = play(["Alice received starting resources {ore} {ore}", "Alice rolled {dice1} {dice1}", "Bob rolled {dice3} {dice4}"]);
    expect(g.hands.bank().ore).toBe(17);
    expect(g.expectedDice()[7]).toBeCloseTo(2 / 6);
    expect(g.expectedDice()[2]).toBeCloseTo(2 / 36);
  });

  it("produces build hints for the player", () => {
    const g = play(["Me received starting resources {lumber} {brick} {wool} {grain} {grain} {ore} {ore}"], "Me");
    const h = hints(g);
    expect(h[0]).toBe("You can build: Road, Settlement, Dev card.");
    expect(h[1]).toBe("One card away from: City.");
  });
});
