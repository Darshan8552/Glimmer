import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "chat-title.ts"), "utf8");

function optimisticTitle(text, firstFileName) {
  return text.slice(0, 60) || firstFileName || "Untitled";
}

test("source keeps the canonical contract", () => {
  assert.match(source, /text\.slice\(0, 60\) \|\| firstFileName \|\| "Untitled"/);
});

test("uses text slice", () => {
  assert.equal(optimisticTitle("hello", "f.csv"), "hello");
});

test("falls back to file name", () => {
  assert.equal(optimisticTitle("", "f.csv"), "f.csv");
});

test("falls back to Untitled", () => {
  assert.equal(optimisticTitle("", undefined), "Untitled");
});

test("truncates at 60", () => {
  assert.equal(optimisticTitle("x".repeat(100)), "x".repeat(60));
});
