// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findLogContainer } from "../src/content/logSource";

describe("findLogContainer", () => {
  it("finds a log by its content even with unknown class names", () => {
    document.body.innerHTML = `
      <div class="chat"><div>Alice: hi</div><div>Bob: hello</div></div>
      <div class="x9f2"><div class="scroller">
        <div class="entry"><span>Alice</span> rolled <img src="dice_3.svg"><img src="dice_4.svg"></div>
        <div class="entry"><span>Bob</span> got <img src="card_grain.svg"></div>
      </div></div>`;
    expect(findLogContainer()?.className).toBe("scroller");
  });

  it("returns null when there is no log", () => {
    document.body.innerHTML = `<div><div>Lobby</div><div>Play</div></div>`;
    expect(findLogContainer()).toBeNull();
  });
});
