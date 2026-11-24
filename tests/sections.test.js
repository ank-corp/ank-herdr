import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statusView, openTasksView, reviewView, graphView, contextView } from "../mods/ank/lib/adapters.js";
import { sections, tasksSection, queueSection, treeSection, constraintsSection, READS } from "../mods/ank/lib/sections.js";

const fixture = (path) => readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");
const views = (dir, extra = {}) => ({
  status: statusView(fixture(`${dir}/status.json`)),
  open: openTasksView(fixture(`${dir}/find-open.json`)),
  review: reviewView(fixture(`${dir}/review.json`)),
  graph: graphView(fixture(`${dir}/graph.json`)),
  context: contextView(fixture(`${dir}/context.json`)),
  ...extra,
});

test("sections: four, in order, each with an empty state", () => {
  const s = sections(views("empty"));
  assert.deepEqual(s.map((x) => x.key), ["tasks", "queue", "tree", "constraints"]);
  for (const x of s) {
    assert.deepEqual(x.rows, []);
    assert.ok(x.empty.length > 0);
  }
});

test("sections: nothing read yet draws every empty state", () => {
  for (const x of sections({})) assert.deepEqual(x.rows, []);
});

test("tasks: open ones and another agent's claim with its holder", () => {
  const { rows } = tasksSection(views("full"));
  assert.deepEqual(rows, [
    { id: "TASK-96815ca5ecd3", short: "TASK-9681", title: "Claimed task", status: "claimed", holder: "fixture:b" },
    { id: "TASK-0cba7e9a10f6", short: "TASK-0cba", title: "Open task", status: "open", holder: null },
    { id: "TASK-231f68753d8c", short: "TASK-231f", title: "Blocked task", status: "open", holder: null },
  ]);
});

test("tasks: the reader's own claim is held by its identity", () => {
  const { rows } = tasksSection({ status: statusView(fixture("full/status-claimed.json")), open: { items: [] } });
  assert.deepEqual(rows, [{ id: "TASK-96815ca5ecd3", short: "TASK-9681", title: null, status: "claimed", holder: "fixture:b" }]);
});

test("queue: proposed ADRs and specs", () => {
  assert.deepEqual(queueSection(views("full")).rows, [
    { id: "ADR-4356697d1e82", short: "ADR-4356", kind: "adr", title: "Sources stay in src" },
  ]);
  assert.equal(queueSection({ review: { proposed: [{ id: "SPEC-0123456789ab", title: "s" }] } }).rows[0].kind, "spec");
});

test("tree: blocked tasks indented under their blocker", () => {
  assert.deepEqual(
    treeSection(views("full")).rows.map((r) => [r.short, r.depth]),
    [["TASK-0cba", 0], ["TASK-9681", 0], ["TASK-231f", 1]],
  );
});

test("constraints: the ones binding the focused folder", () => {
  const { rows } = constraintsSection({ context: contextView(fixture("constraints/context.json")) });
  assert.ok(rows.length > 0);
  for (const r of rows) assert.match(r.short, /^ADR-[0-9a-f]{4}$/);
  assert.ok(rows.every((r) => r.title && r.text));
});

test("reads: only ank --json verbs, none of them writing (ADR-98bd, ADR-99bc)", () => {
  for (const r of READS) {
    assert.equal(r.args.at(-1), "--json");
    assert.ok(["find", "review", "graph", "context"].includes(r.args[0]));
  }
});
