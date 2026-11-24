import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTRACT, acceptContract } from "../mods/ank/lib/version.js";

test("accepts contract 1", () => {
  assert.equal(CONTRACT, 1);
  assert.deepEqual(acceptContract('{"contract":1,"branch":"main"}'), { contract: 1, branch: "main" });
});

test("refuses another contract, non-objects and bad JSON", () => {
  assert.equal(acceptContract('{"contract":2}'), null);
  assert.equal(acceptContract('{"branch":"main"}'), null);
  assert.equal(acceptContract("null"), null);
  assert.equal(acceptContract("1"), null);
  assert.equal(acceptContract("not json"), null);
});
