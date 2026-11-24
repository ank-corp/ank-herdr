import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contextView } from "../mods/ank/lib/adapters.js";
import { startMessage, installedAgents, startCommand, claimableIds, CLAIMABLE_READ } from "../mods/ank/lib/start.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("message: asks the agent to run ank claim <id> itself, then work the task", () => {
  assert.equal(
    startMessage("TASK-0cba7e9a10f6"),
    "Run `ank claim TASK-0cba7e9a10f6` under your own ank identity, then work that task until `ank done` closes it; if you cannot finish it, `ank release` it with the reason.",
  );
});

test("message: refuses something that is not a task id", () => {
  assert.throws(() => startMessage("ADR-4356697d1e82"), /not a task id/);
  assert.throws(() => startMessage("TASK-1; rm -rf ~"), /not a task id/);
  assert.throws(() => startMessage(null), /not a task id/);
});

test("picker: only installed agents, in the order knownAgents() gave", () => {
  const agents = [
    { key: "claude", name: "Claude Code", run: ["claude"], installed: true, agent: true },
    { key: "codex", name: "Codex", run: ["codex"], installed: false, agent: true },
    { key: "pi", name: "Pi", run: ["pi", "--yes"], installed: true, agent: true },
    { key: "broken", name: "No run", run: [], installed: true, agent: true },
  ];
  assert.deepEqual(
    installedAgents(agents).map((a) => a.key),
    ["claude", "pi"],
  );
  assert.deepEqual(installedAgents(null), []);
});

test("command: tab.new in the repo root, the agent's run, the task id as name, the claim message as task", () => {
  const agent = { key: "pi", name: "Pi", run: ["pi", "--yes"], installed: true };
  assert.deepEqual(startCommand({ root: "C:\\repos\\demo", agent, id: "TASK-0cba7e9a10f6" }), {
    name: "tab.new",
    args: {
      folder: "C:\\repos\\demo",
      argv: ["pi", "--yes"],
      name: "TASK-0cba7e9a10f6",
      task: "Run `ank claim TASK-0cba7e9a10f6` under your own ank identity, then work that task until `ank done` closes it; if you cannot finish it, `ank release` it with the reason.",
    },
  });
});

test("command: argv is a copy, never the agent's own array", () => {
  const agent = { run: ["claude"], installed: true };
  const cmd = startCommand({ root: "/r", agent, id: "TASK-0cba7e9a10f6" });
  cmd.args.argv.push("x");
  assert.deepEqual(agent.run, ["claude"]);
});

test("command: never an ank command, whatever the agent", () => {
  const cmd = startCommand({ root: "/r", agent: { run: ["claude"] }, id: "TASK-0cba7e9a10f6" });
  assert.notEqual(cmd.args.argv[0], "ank");
  assert.throws(() => startCommand({ root: "/r", agent: { run: ["ank", "claim", "TASK-0cba7e9a10f6"] }, id: "TASK-0cba7e9a10f6" }), /not an agent/);
  assert.throws(() => startCommand({ root: "/r", agent: { run: ["ank.cmd"] }, id: "TASK-0cba7e9a10f6" }), /not an agent/);
});

test("command: refuses a missing root or an agent with no run", () => {
  assert.throws(() => startCommand({ root: null, agent: { run: ["claude"] }, id: "TASK-0cba7e9a10f6" }), /root/);
  assert.throws(() => startCommand({ root: "/r", agent: { run: [] }, id: "TASK-0cba7e9a10f6" }), /run/);
});

test("claimable: the tasks ank judges ready, not claimed or blocked ones", () => {
  const ids = claimableIds(contextView(fixture("full/context.json")));
  assert.deepEqual([...ids], ["TASK-0cba7e9a10f6"]);
});

test("claimable: none under a claim (execution mode lists no tasks) or with no read", () => {
  assert.deepEqual([...claimableIds(contextView(fixture("full/context-claimed.json")))], []);
  assert.deepEqual([...claimableIds(undefined)], []);
});

test("claimable read: a repo-wide ank context, read only", () => {
  assert.deepEqual(CLAIMABLE_READ, { key: "ready", args: ["context", "--json"], at: "root" });
});
