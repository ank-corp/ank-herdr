import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statusView } from "../mods/ank/lib/adapters.js";
import { acceptGate, acceptCommand, acceptOutcome } from "../mods/ank/lib/accept.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("gate: enabled on the default branch (status fixture: main, default main)", () => {
  assert.deepEqual(acceptGate(statusView(fixture("full/status.json"))), { enabled: true, reason: null });
});

test("gate: disabled on another branch, saying where accept runs", () => {
  assert.deepEqual(acceptGate({ branch: "feat", defaultBranch: "main" }), {
    enabled: false,
    reason: "on feat: accept runs on main",
  });
});

test("gate: disabled when ank knows no default branch, or no branch, or no status", () => {
  assert.deepEqual(acceptGate({ branch: "main", defaultBranch: null }), {
    enabled: false,
    reason: "ank knows no default branch here",
  });
  assert.deepEqual(acceptGate({ branch: null, defaultBranch: "main" }), {
    enabled: false,
    reason: "no branch checked out: accept runs on main",
  });
  assert.deepEqual(acceptGate(null), { enabled: false, reason: "ank status not read yet" });
});

test("command: ank accept <id> in the repo root, with the platform's program", () => {
  assert.deepEqual(acceptCommand({ ank: "ank.cmd", root: "C:\\repos\\demo", id: "ADR-4356697d1e82" }), {
    program: "ank.cmd",
    args: ["accept", "ADR-4356697d1e82"],
    cwd: "C:\\repos\\demo",
  });
  assert.deepEqual(acceptCommand({ ank: "ank", root: "/r", id: "SPEC-0a1b2c3d4e5f" }), {
    program: "ank",
    args: ["accept", "SPEC-0a1b2c3d4e5f"],
    cwd: "/r",
  });
});

test("command: refuses an id that is not an ADR or a spec, or one carrying a flag", () => {
  for (const id of ["TASK-0cba7e9a10f6", "--rescope", "ADR-1 --reanchor", "", null]) {
    assert.throws(() => acceptCommand({ ank: "ank", root: "/r", id }), /not an ADR or spec id/);
  }
});

test("command: refuses a missing root or a program that is not ank", () => {
  assert.throws(() => acceptCommand({ ank: "ank", root: "", id: "ADR-4356697d1e82" }), /root/);
  assert.throws(() => acceptCommand({ ank: "git", root: "/r", id: "ADR-4356697d1e82" }), /not ank/);
});

test("outcome: success notifies with ank's own line", () => {
  assert.deepEqual(acceptOutcome("ADR-fadfe1302904", { code: 0, stdout: "accepted ADR-fadfe1302904 -> fc19784\n", stderr: "" }), {
    title: "Accepted ADR-fadfe1302904",
    body: "accepted ADR-fadfe1302904 -> fc19784",
    level: "success",
  });
});

test("outcome: a refusal notifies with ank's error message from stderr, whole", () => {
  const stderr = "error[6]: ADR-fadfe1302904 is already ratified at 28316f1e2295\n  -> ank new adr --supersedes ADR-fadfe1302904\n";
  assert.deepEqual(acceptOutcome("ADR-fadfe1302904", { code: 6, stdout: "", stderr }), {
    title: "ank refused to accept ADR-fadfe1302904",
    body: "error[6]: ADR-fadfe1302904 is already ratified at 28316f1e2295\n  -> ank new adr --supersedes ADR-fadfe1302904",
    level: "error",
  });
});

test("outcome: a refusal with nothing on stderr falls back to stdout, then to the exit code", () => {
  assert.equal(acceptOutcome("ADR-1", { code: 9, stdout: "push refused\n", stderr: "" }).body, "push refused");
  assert.equal(acceptOutcome("ADR-1", { code: 9, stdout: "", stderr: "" }).body, "ank accept exited 9");
});

test("outcome: ank that could not be started is an error naming the program", () => {
  assert.deepEqual(acceptOutcome("ADR-1", null, "ank.cmd"), {
    title: "ank refused to accept ADR-1",
    body: "ank.cmd could not be started",
    level: "error",
  });
});
