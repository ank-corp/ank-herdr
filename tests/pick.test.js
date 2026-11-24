// Picking a repo by hand (TASK-c973fbe8e2a5): when focus gives the panel no
// repo, it offers the ank repos under the open terminals' cwds and a folder
// picker; the repo shown is stored with localStorage and restored at start.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { terminalCwds, repoCandidates, pickOutcome, STORE_KEY, storeValue, storedRoot, restoredRepo } from "../mods/ank/lib/pick.js";

const fixture = (path) => readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

const inRepo = { code: 0, stdout: fixture("full/status.json"), stderr: "" };
const noRepo = { code: 1, stdout: "", stderr: fixture("norepo/status.stderr.json") };
const gitAt = (root) => ({ code: 0, stdout: `${root}\n${root}/.git\n`, stderr: "" });

const proj = { root: "C:/w/proj", watch: ["C:/w/proj/.ank", "C:/w/proj/.git/refs/ank"] };

test("terminal cwds: distinct local folders, in terminals() order", () => {
  const terms = [
    { address: "t1", cwd: "C:\\w\\proj\\src" },
    { address: "t2", cwd: "C:\\Users\\me" },
    { address: "t3", cwd: "c:/w/proj/src/" }, // same folder, other spelling
    { address: "vps/t4", cwd: "/home/me/proj" }, // another machine
    { address: "t5" }, // no cwd reported
    { address: "t6", cwd: "" },
    { address: "t7", cwd: "C:\\w\\other" },
  ];
  assert.deepEqual(terminalCwds(terms), ["C:\\w\\proj\\src", "C:\\Users\\me", "C:\\w\\other"]);
});

test("terminal cwds: nothing open, nothing offered", () => {
  assert.deepEqual(terminalCwds([]), []);
  assert.deepEqual(terminalCwds(null), []);
});

test("candidates: one per ank repo found, cwds in no repo dropped", () => {
  const probes = [
    { cwd: "C:/w/proj/src", ank: inRepo, git: gitAt("C:/w/proj") },
    { cwd: "C:/Users/me", ank: noRepo, git: null },
    { cwd: "C:/w/proj/docs", ank: inRepo, git: gitAt("C:/w/proj") },
    { cwd: "C:/w/other", ank: inRepo, git: gitAt("C:/w/other") },
    { cwd: "C:/w/gone", ank: null, git: null },
  ];
  assert.deepEqual(repoCandidates(probes, null), [
    { root: "C:/w/proj", name: "proj" },
    { root: "C:/w/other", name: "other" },
  ]);
});

test("candidates: the repo already shown is not offered again", () => {
  const probes = [
    { cwd: "C:/w/proj", ank: inRepo, git: gitAt("C:/w/proj") },
    { cwd: "C:/w/other", ank: inRepo, git: gitAt("C:/w/other") },
  ];
  assert.deepEqual(repoCandidates(probes, proj), [{ root: "C:/w/other", name: "other" }]);
});

test("candidates: a root git spells in two cases is one repo", () => {
  const probes = [
    { cwd: "C:/w/proj", ank: inRepo, git: gitAt("C:/w/proj") },
    { cwd: "c:/w/proj", ank: inRepo, git: gitAt("c:\\w\\proj") },
  ];
  assert.deepEqual(repoCandidates(probes, null), [{ root: "C:/w/proj", name: "proj" }]);
});

test("pick: a folder in an ank repo shows that repo", () => {
  assert.deepEqual(pickOutcome({ folder: "C:/w/proj/src", ank: inRepo, git: gitAt("C:/w/proj") }), { repo: proj });
});

test("pick: the picker cancelled changes nothing", () => {
  assert.deepEqual(pickOutcome({ folder: null, ank: null, git: null }), { cancelled: true });
});

test("pick: a folder in no ank repo is refused, naming it", () => {
  assert.deepEqual(pickOutcome({ folder: "C:/Users/me", ank: noRepo, git: null }), {
    error: "C:/Users/me is in no ank repository.",
  });
});

test("pick: ank speaking another contract is refused, naming it", () => {
  const v2 = { code: 0, stdout: '{"contract":2}', stderr: "" };
  assert.deepEqual(pickOutcome({ folder: "C:/w/proj", ank: v2, git: gitAt("C:/w/proj") }), {
    error: "ank speaks contract 2 in C:/w/proj; this panel reads contract 1.",
  });
});

test("store: the shown repo's root, read back as given", () => {
  assert.equal(STORE_KEY, "repo");
  assert.equal(storeValue(proj), '{"root":"C:/w/proj"}');
  assert.equal(storedRoot('{"root":"C:/w/proj"}'), "C:/w/proj");
});

test("store: nothing stored, or something unreadable, restores nothing", () => {
  assert.equal(storedRoot(null), null);
  assert.equal(storedRoot("[object Object]"), null);
  assert.equal(storedRoot('{"root":""}'), null);
  assert.equal(storedRoot('{"root":3}'), null);
  assert.equal(storedRoot('"C:/w/proj"'), null);
});

test("restore: the stored repo is shown at start when it is still an ank repo", () => {
  assert.deepEqual(restoredRepo({ current: null, root: "C:/w/proj", ank: inRepo, git: gitAt("C:/w/proj") }), proj);
});

test("restore: a stored folder that is no longer an ank repo shows nothing", () => {
  assert.equal(restoredRepo({ current: null, root: "C:/w/proj", ank: noRepo, git: null }), null);
  assert.equal(restoredRepo({ current: null, root: "C:/w/proj", ank: null, git: null }), null);
});

test("restore: focus that already found a repo wins over the stored one (ADR-2df9)", () => {
  const other = { root: "C:/w/other", watch: [] };
  assert.equal(restoredRepo({ current: other, root: "C:/w/proj", ank: inRepo, git: gitAt("C:/w/proj") }), other);
});
