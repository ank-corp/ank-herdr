// Fixtures in tests/fixtures/ are real ank 0.9.5 --json output: empty/ from a
// freshly initialised corpus, full/ from a throwaway corpus holding a done task,
// a task claimed by fixture:b, a task blocked by it, an open task and a proposed
// ADR; constraints/ is `ank context mods/ank/lib --json` in this repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IncompatibleContract,
  statusView,
  openTasksView,
  reviewView,
  graphView,
  contextView,
} from "../mods/ank/lib/adapters.js";

const fixture = (path) => readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

test("status: empty corpus", () => {
  assert.deepEqual(statusView(fixture("empty/status.json")), {
    branch: "main",
    defaultBranch: "main",
    identity: "fixture:a",
    claim: null,
    elsewhere: [],
    constraints: 0,
    queue: 0,
    drift: 0,
    faults: 0,
    signals: 1,
  });
});

test("status: another agent's claim is listed elsewhere", () => {
  const view = statusView(fixture("full/status.json"));
  assert.equal(view.claim, null);
  assert.equal(view.queue, 1);
  assert.deepEqual(view.elsewhere, [
    { id: "TASK-96815ca5ecd3", title: "Claimed task", holder: "fixture:b", expires: "2026-11-24T14:58:52Z" },
  ]);
});

test("status: the agent's own claim", () => {
  const view = statusView(fixture("full/status-claimed.json"));
  assert.equal(view.identity, "fixture:b");
  assert.deepEqual(view.claim, { id: "TASK-96815ca5ecd3", expires: "2026-11-24T14:59:09Z", lapsed: false });
  assert.deepEqual(view.elsewhere, []);
});

test("find --status open: empty corpus", () => {
  assert.deepEqual(openTasksView(fixture("empty/find-open.json")), { total: 0, hidden: 0, items: [] });
});

test("find --status open: open and blocked tasks, not the claimed or the done one", () => {
  assert.deepEqual(openTasksView(fixture("full/find-open.json")), {
    total: 2,
    hidden: 0,
    items: [
      { id: "TASK-0cba7e9a10f6", kind: "task", title: "Open task", state: "open" },
      { id: "TASK-231f68753d8c", kind: "task", title: "Blocked task", state: "open" },
    ],
  });
});

test("review: empty corpus", () => {
  assert.deepEqual(reviewView(fixture("empty/review.json")), { proposed: [], dead: 0, faults: 0, signals: 1 });
});

test("review: the proposed ADR is in the queue", () => {
  assert.deepEqual(reviewView(fixture("full/review.json")), {
    proposed: [{ id: "ADR-4356697d1e82", title: "Sources stay in src" }],
    dead: 0,
    faults: 0,
    signals: 4,
  });
});

test("graph: empty corpus", () => {
  assert.deepEqual(graphView(fixture("empty/graph.json")), { roots: [] });
});

test("graph: the blocked task hangs under the task blocking it", () => {
  assert.deepEqual(graphView(fixture("full/graph.json")), {
    roots: [
      { id: "TASK-0cba7e9a10f6", short: "TASK-0cba", title: "Open task", status: "open", children: [] },
      {
        id: "TASK-96815ca5ecd3",
        short: "TASK-9681",
        title: "Claimed task",
        status: "in_progress",
        children: [
          { id: "TASK-231f68753d8c", short: "TASK-231f", title: "Blocked task", status: "open", children: [] },
        ],
      },
    ],
  });
});

test("graph: a cycle is cut instead of recursing forever", () => {
  const stdout = JSON.stringify({
    contract: 1,
    path: ".",
    tasks: [
      { id: "TASK-a", short: "TASK-a", status: "open", title: "A" },
      { id: "TASK-b", short: "TASK-b", status: "open", title: "B" },
    ],
    edges: [
      { task: "TASK-a", blocked_by: "TASK-b" },
      { task: "TASK-b", blocked_by: "TASK-a" },
    ],
  });
  const { roots } = graphView(stdout);
  assert.deepEqual(roots.map((n) => n.id), ["TASK-a", "TASK-b"]);
  assert.deepEqual(roots[0].children[0].children, []);
});

test("context: empty corpus", () => {
  assert.deepEqual(contextView(fixture("empty/context.json")), {
    mode: "orientation",
    head: null,
    criteria: null,
    method: null,
    constraints: [],
    proposed: [],
    tasks: [],
    ready: 0,
    blocked: 0,
    warnings: [],
  });
});

test("context: claimed, blocked, ready tasks and the proposed ADR", () => {
  const view = contextView(fixture("full/context.json"));
  assert.deepEqual(view.proposed, [{ id: "ADR-4356697d1e82", short: "ADR-4356", title: "Sources stay in src" }]);
  assert.deepEqual(view.tasks, [
    { id: "TASK-0cba7e9a10f6", short: "TASK-0cba", title: "Open task", phase: "ready", holder: null, unblocks: 0 },
    { id: "TASK-96815ca5ecd3", short: "TASK-9681", title: "Claimed task", phase: "claimed", holder: "fixture:b", unblocks: 1 },
    { id: "TASK-231f68753d8c", short: "TASK-231f", title: "Blocked task", phase: "blocked", holder: null, unblocks: 0 },
  ]);
  assert.equal(view.ready, 1);
  assert.equal(view.blocked, 1);
});

test("context: execution mode carries the head and its criterion", () => {
  const view = contextView(fixture("full/context-claimed.json"));
  assert.equal(view.mode, "execution");
  assert.equal(view.head, "TASK-96815ca5ecd3");
  assert.equal(view.criteria, "a.js says x");
});

test("context: binding constraints with their text", () => {
  const view = contextView(fixture("constraints/context.json"));
  assert.equal(view.constraints.length, 7);
  assert.deepEqual(view.constraints[3], {
    id: "ADR-98bdc6c7f510",
    short: "ADR-98bd",
    title: "Corpus read only through ank --json",
    text: "The ank mod reads the corpus only by running ank <verb> --json and accepting contract 1; it never parses .ank/ files or git refs itself.",
  });
});

const adapters = { statusView, openTasksView, reviewView, graphView, contextView };

for (const [name, adapt] of Object.entries(adapters)) {
  test(`${name}: another contract is a typed incompatibility`, () => {
    assert.throws(() => adapt('{"contract":2,"results":[]}'), (err) => {
      assert.ok(err instanceof IncompatibleContract);
      assert.equal(err.expected, 1);
      assert.equal(err.found, 2);
      return true;
    });
  });

  test(`${name}: no contract, or no JSON, is a typed incompatibility`, () => {
    for (const stdout of ['{"branch":"main"}', "null", "not json", ""]) {
      assert.throws(() => adapt(stdout), (err) => err instanceof IncompatibleContract && err.found === null);
    }
  });
}
