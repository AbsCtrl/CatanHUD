/**
 * Turns one game log entry (a DOM element) into a flat string where every
 * icon is replaced by a `{name}` token, e.g. "Alice got {lumber} {lumber} {ore}".
 *
 * Colonist renders resources, pieces, dev cards and dice as <img> elements, so
 * we identify each icon from its src file name and alt text. Matching on
 * keywords rather than exact paths keeps this working across asset renames.
 */

const ICON_PATTERNS: [string, RegExp][] = [
  ["dice", /dice[_-]?(\d)/],
  ["lumber", /lumber|wood/],
  ["brick", /brick/],
  ["wool", /wool|sheep/],
  ["grain", /grain|wheat/],
  ["ore", /(^|[^a-z])ore([^a-z]|$)/],
  ["resBack", /rescardback|res[_-]?back|card[_-]?back|unknown/],
  ["knight", /knight/],
  ["roadBuilding", /road[_-]?building/],
  ["yearOfPlenty", /year[_-]?of[_-]?plenty|plenty/],
  ["monopoly", /monopoly/],
  ["victoryPoint", /victory|vp[_-]?card|card[_-]?vp/],
  ["devBack", /devcard|dev[_-]?back|development/],
  ["settlement", /settlement/],
  ["city", /city/],
  ["road", /road/],
  ["robber", /robber/],
];

export function iconName(src: string, alt: string): string | null {
  const file = (src.split("/").pop() ?? "").split("?")[0].toLowerCase();
  const haystacks = [file, alt.toLowerCase()];
  for (const hay of haystacks) {
    if (!hay) continue;
    for (const [name, re] of ICON_PATTERNS) {
      const m = re.exec(hay);
      if (m) return name === "dice" ? `dice${m[1]}` : name;
    }
  }
  return null;
}

export function tokenize(entry: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
    } else if (node.nodeType === 1) {
      const el = node as Element;
      if (el.tagName === "IMG") {
        const name = iconName(el.getAttribute("src") ?? "", el.getAttribute("alt") ?? "");
        if (name) parts.push(` {${name}} `);
        return;
      }
      el.childNodes.forEach(walk);
    }
  };
  walk(entry);
  return parts.join("").replace(/\s+/g, " ").trim();
}
