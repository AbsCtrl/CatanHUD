// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLine } from "../src/parser/parseLine";
import { iconName, tokenize } from "../src/parser/tokenize";

function el(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild!;
}

const img = (name: string) => `<img src="/dist/images/${name}.svg?v1" alt="${name}">`;

describe("iconName", () => {
  it("recognizes resource, dice and dev card icons", () => {
    expect(iconName("/images/card_lumber.svg", "")).toBe("lumber");
    expect(iconName("/images/card_ore.svg", "")).toBe("ore");
    expect(iconName("/images/dice_5.svg", "")).toBe("dice5");
    expect(iconName("/images/card_rescardback.svg", "")).toBe("resBack");
    expect(iconName("/images/card_roadbuilding.svg", "")).toBe("roadBuilding");
    expect(iconName("/images/road_red.svg", "")).toBe("road");
    expect(iconName("", "Grain")).toBe("grain");
  });

  it("does not mistake words containing 'ore' for ore", () => {
    expect(iconName("/images/score_icon.svg", "")).toBeNull();
  });
});

describe("tokenize", () => {
  it("turns icons into tokens and collapses whitespace", () => {
    const entry = el(`<div><span style="color:red">Alice</span> got ${img("card_lumber")}${img("card_ore")}</div>`);
    expect(tokenize(entry)).toBe("Alice got {lumber} {ore}");
  });
});

describe("parseLine", () => {
  it("parses rolls", () => {
    expect(parseLine("Alice rolled {dice3} {dice4}")).toEqual({ type: "roll", player: "Alice", dice: [3, 4] });
  });

  it("parses production and starting resources", () => {
    expect(parseLine("Bob got {grain} {grain} {ore}")).toMatchObject({
      type: "gain",
      player: "Bob",
      source: "production",
      cards: { grain: 2, ore: 1, lumber: 0 },
    });
    expect(parseLine("Bob received starting resources {wool} {brick}")).toMatchObject({ source: "starting" });
  });

  it("parses builds, distinguishing free setup placements", () => {
    expect(parseLine("Alice built a {city}")).toEqual({ type: "build", player: "Alice", piece: "city", free: false });
    expect(parseLine("Alice placed a {settlement}")).toMatchObject({ piece: "settlement", free: true });
  });

  it("parses known and unknown steals", () => {
    expect(parseLine("Alice stole {brick} from Bob")).toEqual({ type: "steal", thief: "Alice", victim: "Bob", resource: "brick" });
    expect(parseLine("Alice stole {resBack} from Bob")).toMatchObject({ resource: null });
    expect(parseLine("You stole {wool} from Carol")).toMatchObject({ thief: "You", victim: "Carol" });
  });

  it("parses monopoly results", () => {
    expect(parseLine("Alice stole 5 {wool}")).toEqual({ type: "monopoly", player: "Alice", resource: "wool", count: 5 });
  });

  it("parses trades and discards", () => {
    expect(parseLine("Alice gave bank {lumber} {lumber} {lumber} {lumber} and took {ore}")).toMatchObject({
      type: "bankTrade",
      gave: { lumber: 4 },
      took: { ore: 1 },
    });
    expect(parseLine("Alice traded {wool} for {brick} {brick} with Bob")).toMatchObject({
      type: "playerTrade",
      partner: "Bob",
      gave: { wool: 1 },
      got: { brick: 2 },
    });
    expect(parseLine("Bob discarded {grain} {grain} {ore} {ore}")).toMatchObject({ type: "discard", cards: { grain: 2, ore: 2 } });
  });

  it("parses dev card buys and plays", () => {
    expect(parseLine("Alice bought {devBack}")).toEqual({ type: "buyDev", player: "Alice" });
    expect(parseLine("Alice used {knight}")).toEqual({ type: "playDev", player: "Alice", card: "knight" });
    expect(parseLine("Alice used Year of Plenty")).toMatchObject({ card: "yearOfPlenty" });
    expect(parseLine("Alice took from bank {ore} {ore}")).toMatchObject({ type: "gain", source: "yearOfPlenty" });
  });

  it("ignores lines it doesn't understand", () => {
    expect(parseLine("Alice: gl hf")).toBeNull();
    expect(parseLine("Alice moved Robber {robber} to {prob5}")).toBeNull();
  });
});
