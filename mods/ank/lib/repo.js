// Which ank repo the panel shows (ADR-2df9) and which folders it watches
// (ADR-5468). Pure: no herdr, gpui-kit or gpui-base import (ADR-5872).
import { CONTRACT } from "./version.js";

// The program to exec: on Windows herdr's exec does no PATHEXT lookup and the
// extensionless `ank` npm installs is a sh shim, so `ank.cmd` is the one that
// runs (TASK-7246). `home` is herdr's home(); a drive letter or a backslash
// marks Windows.
export function ankProgram(home) {
  return /^[A-Za-z]:|\\/.test(home ?? "") ? "ank.cmd" : "ank";
}

// The arguments main.js passes git, in the cwd, once ank has answered there:
// the worktree root, then the common git dir that holds refs/ank.
export const GIT_ARGS = ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"];

// From the focused terminal's cwd, the repo last shown and what `ank status
// --json` (ank) and git (GIT_ARGS) printed there, to the repo shown:
//   repo          ank answered in a repo: { root, watch: [<root>/.ank, <git>/refs/ank] }
//   kept          cwd in no ank repo, no cwd, or ank could not run: the last repo
//   empty         as kept, with no last repo: null
//   incompatible  ank printed another contract or none: the last repo, and found
// A result is { code, stdout }; null when the program could not be started.
export function resolveRepo({ cwd, last, ank, git }) {
  const keep = (extra) => ({ repo: last ?? null, state: last ? "kept" : "empty", ...extra });
  if (!cwd || !ank) return keep();

  let value;
  try {
    value = JSON.parse(ank.stdout);
  } catch {
    value = undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) || !("contract" in value)) {
    return { repo: last ?? null, state: "incompatible", found: null };
  }
  if (value.contract !== CONTRACT) return { repo: last ?? null, state: "incompatible", found: value.contract };
  if (ank.code !== 0 || value.error) return keep();

  const lines = git && git.code === 0 ? git.stdout.split(/\r?\n/).filter(Boolean) : [];
  if (lines.length < 2) return keep();
  const [root, common] = lines;
  return { repo: { root, watch: [`${root}/.ank`, `${common}/refs/ank`] }, state: "repo" };
}

// The name the panel heads a repo with: its root's last segment.
export const repoName = (root) => root.split(/[\\/]+/).filter(Boolean).pop() ?? root;

// Two resolutions name the same repo: no reload or rewatch is owed.
export const sameRepo = (a, b) => (a?.root ?? null) === (b?.root ?? null);

// The folder above one: refs/ank does not exist until the first claim or
// ratification, and watching a missing folder rejects, so its parent is
// watched instead until it appears.
export const parentDir = (dir) => dir.replace(/[\\/]+[^\\/]+[\\/]*$/, "");

// watchFolder reports Windows paths in their verbatim form, \\?\C:\...
const norm = (p) =>
  p
    .replace(/\\/g, "/")
    .replace(/^\/\/\?\//, "")
    .replace(/\/+$/, "")
    .toLowerCase();

// Every ank read, the panel's own included, rewrites its index under
// .ank/index.db*: a batch holding nothing else is the panel hearing itself, and
// reloading on it would read, write the index and reload again for ever.
export const corpusChanges = (paths) => paths.filter((p) => !/[\\/]\.ank[\\/]index\.db[^\\/]*$/i.test(p));

// A batch from the parent's watch concerns `dir`: a path at or under it, or
// the parent itself (a batch holding the root means refresh everything).
export function touches(paths, dir) {
  const d = norm(dir);
  const parent = norm(parentDir(dir));
  return paths.some((p) => {
    const n = norm(p);
    return n === d || n.startsWith(`${d}/`) || n === parent;
  });
}
