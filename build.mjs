import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });

const options = {
  entryPoints: { content: "src/content/main.ts" },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
