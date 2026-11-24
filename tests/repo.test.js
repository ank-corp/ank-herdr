// The repo the panel shows (ADR-2df9): the ank repo holding the focused
// terminal's cwd, else the last one shown, else nothing. The ank result is what
// `ank status --json` printed in that cwd; the git result is what
// `git rev-parse --path-format=absolute --show-toplevel --git-common-dir` printed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveRepo, ankProgram, repoName, parentDir, touches, corpusChanges } from "../mods/ank/lib/repo.js";

const fixture = (path) => readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

const inRepo = { code: 0, stdout: fixture("full/status.json"), stderr: "" };
// Captured from `ank status --json` run in a folder under no git and no .ank/:
// exit 1, nothing on stdout, the error JSON on stderr (TASK-80f33d6f530e).
const noRepo = { code: 1, stdout: "", stderr: fixture("norepo/status.stderr.json") };
const git = { code: 0, stdout: "C:/Users/me/work/proj\nC:/Users/me/work/proj/.git\n", stderr: "" };

const proj = {
  root: "C:/Users/me/work/proj",
  watch: ["C:/Users/me/work/proj/.ank", "C:/Users/me/work/proj/.git/refs/ank"],
};
const other = { root: "C:/Users/me/other", watch: ["C:/Users/me/other/.ank", "C:/Users/me/other/.git/refs/ank"] };

test("cwd inside a repo: that repo is shown, with .ank/ and refs/ank to watch", () => {
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me/work/proj/src", last: other, ank: inRepo, git }), {
    repo: proj,
    state: "repo",
  });
});

test("cwd inside a worktree: refs/ank is under the common git dir", () => {
  const wt = { code: 0, stdout: "C:/Users/me/wt/a\nC:/Users/me/work/proj/.git\n", stderr: "" };
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me/wt/a", last: null, ank: inRepo, git: wt }).repo, {
    root: "C:/Users/me/wt/a",
    watch: ["C:/Users/me/wt/a/.ank", "C:/Users/me/work/proj/.git/refs/ank"],
  });
});

test("cwd in no ank repo: the last repo is kept", () => {
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me", last: proj, ank: noRepo, git: null }), {
    repo: proj,
    state: "kept",
  });
});

test("ank could not run there: the last repo is kept", () => {
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me", last: proj, ank: null, git: null }), { repo: proj, state: "kept" });
});

test("no focused cwd (a mod pane has focus): the last repo is kept", () => {
  assert.deepEqual(resolveRepo({ cwd: null, last: proj, ank: null, git: null }), { repo: proj, state: "kept" });
});

test("no last repo, cwd in no ank repo, error on stderr: empty state, not an incompatibility", () => {
  const out = resolveRepo({ cwd: "C:/Users/me/AppData/Local/Temp/norepo-probe", last: null, ank: noRepo, git: null });
  assert.deepEqual(out, { repo: null, state: "empty" });
});

test("no last repo and cwd in no ank repo: empty state", () => {
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me", last: null, ank: noRepo, git: null }), {
    repo: null,
    state: "empty",
  });
});

test("an ank repo git cannot place: treated as no repo", () => {
  const notGit = { code: 128, stdout: "", stderr: "fatal: not a git repository" };
  assert.deepEqual(resolveRepo({ cwd: "C:/x", last: null, ank: inRepo, git: notGit }), { repo: null, state: "empty" });
});

test("another contract: incompatible, naming the contract found, last repo kept", () => {
  const v2 = { code: 0, stdout: '{"contract":2,"branch":"main"}', stderr: "" };
  assert.deepEqual(resolveRepo({ cwd: "C:/Users/me/work/proj", last: other, ank: v2, git }), {
    repo: other,
    state: "incompatible",
    found: 2,
  });
});

test("output with no contract: incompatible, found null", () => {
  const junk = { code: 0, stdout: "ank: command not understood", stderr: "" };
  assert.deepEqual(resolveRepo({ cwd: "C:/p", last: null, ank: junk, git }), {
    repo: null,
    state: "incompatible",
    found: null,
  });
});

test("Windows backslash paths from git are kept as given", () => {
  const winGit = { code: 0, stdout: "D:\\code\\x\r\nD:\\code\\x\\.git\r\n", stderr: "" };
  assert.deepEqual(resolveRepo({ cwd: "D:\\code\\x", last: null, ank: inRepo, git: winGit }).repo, {
    root: "D:\\code\\x",
    watch: ["D:\\code\\x/.ank", "D:\\code\\x\\.git/refs/ank"],
  });
});

test("ank program: ank.cmd on Windows, ank elsewhere", () => {
  assert.equal(ankProgram("C:\\Users\\me"), "ank.cmd");
  assert.equal(ankProgram("C:/Users/me"), "ank.cmd");
  assert.equal(ankProgram("/home/me"), "ank");
  assert.equal(ankProgram("/Users/me"), "ank");
});

test("repo name: the root's last segment, either separator", () => {
  assert.equal(repoName("C:/Users/me/work/proj"), "proj");
  assert.equal(repoName("D:\\code\\x\\"), "x");
  assert.equal(repoName("/home/me/ank-herdr"), "ank-herdr");
});

test("corpusChanges: ank's own index writes are not a change", () => {
  assert.deepEqual(corpusChanges(["C:\\r\\.ank\\index.db.15", "C:\\r\\.ank\\index.db.15-wal", "/r/.ank/index.db.15-shm"]), []);
  assert.deepEqual(corpusChanges(["C:\\r\\.ank\\entities\\TASK-1.md", "C:\\r\\.ank\\index.db.15"]), [
    "C:\\r\\.ank\\entities\\TASK-1.md",
  ]);
  assert.deepEqual(corpusChanges(["C:\\r\\.ank"]), ["C:\\r\\.ank"]);
});

test("parentDir: the folder above, either separator", () => {
  assert.equal(parentDir("C:/r/.git/refs/ank"), "C:/r/.git/refs");
  assert.equal(parentDir("C:\\r\\.git\\refs\\ank\\"), "C:\\r\\.git\\refs");
  assert.equal(parentDir("/r/.git/refs/ank"), "/r/.git/refs");
});

test("touches: only batches about refs/ank, or the parent root", () => {
  const dir = "C:/r/.git/refs/ank";
  assert.equal(touches(["C:\\r\\.git\\refs\\heads\\main"], dir), false);
  assert.equal(touches(["C:\\r\\.git\\refs\\ankle"], dir), false);
  assert.equal(touches(["C:\\r\\.git\\refs\\ank"], dir), true);
  assert.equal(touches(["c:/r/.git/refs/ank/claims/TASK-1"], dir), true);
  assert.equal(touches(["C:/r/.git/refs"], dir), true);
  assert.equal(touches([], dir), false);
  // as herdr's watchFolder reports them on Windows
  assert.equal(touches(["\\\\?\\C:\\r\\.git\\refs\\ank\\claims\\TASK-1"], dir), true);
  assert.equal(touches(["\\\\?\\C:\\r\\.git\\refs\\heads\\main"], dir), false);
});
