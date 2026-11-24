// Picking a repo by hand (TASK-c973fbe8e2a5): the candidates offered when focus
// gives the panel no repo, the outcome of a pick, and the repo stored with
// localStorage and restored at start. Pure: no herdr, gpui-kit or gpui-base
// import (ADR-5872); main.js runs ank and git and hands the results here.
import { CONTRACT } from "./version.js";
import { resolveRepo, repoName } from "./repo.js";

// One spelling per folder: separators, a trailing slash and case (Windows
// paths, and drive letters, come in either case) do not make two folders.
const key = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

const distinctBy = (items, keyOf) => {
  const seen = new Set();
  return items.filter((item) => {
    const k = keyOf(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// The folders of the open terminals, from terminals(), on this machine only
// (watchFolder watches this machine; a remote address carries "machine/").
export function terminalCwds(terminals) {
  const cwds = (terminals ?? [])
    .filter((t) => typeof t?.cwd === "string" && t.cwd && !String(t.address ?? "").includes("/"))
    .map((t) => t.cwd);
  return distinctBy(cwds, key);
}

// From what ank and git printed in each cwd ({ cwd, ank, git }, as resolveRepo
// takes them), the distinct ank repos found, in order, minus the one shown.
export function repoCandidates(probes, current) {
  const roots = probes
    .map(({ cwd, ank, git }) => resolveRepo({ cwd, last: null, ank, git }))
    .filter((r) => r.state === "repo")
    .map((r) => r.repo.root);
  const shown = current ? key(current.root) : null;
  return distinctBy(roots, key)
    .filter((root) => key(root) !== shown)
    .map((root) => ({ root, name: repoName(root) }));
}

// What a pick gives: a candidate's root or the folder pickFolder() answered
// (null when the person cancelled), with what ank and git printed there.
export function pickOutcome({ folder, ank, git }) {
  if (!folder) return { cancelled: true };
  const r = resolveRepo({ cwd: folder, last: null, ank, git });
  if (r.state === "repo") return { repo: r.repo };
  if (r.state === "incompatible") {
    return { error: `ank speaks contract ${r.found ?? "none"} in ${folder}; this panel reads contract ${CONTRACT}.` };
  }
  return { error: `${folder} is in no ank repository.` };
}

// localStorage holds the root of the repo last shown, picked or followed.
export const STORE_KEY = "repo";
export const storeValue = (repo) => JSON.stringify({ root: repo.root });

export function storedRoot(text) {
  try {
    const v = JSON.parse(text ?? "");
    return v && typeof v === "object" && typeof v.root === "string" && v.root ? v.root : null;
  } catch {
    return null;
  }
}

// At start: the stored root, re-read through ank and git there, unless focus
// has already found a repo, which wins (ADR-2df9).
export function restoredRepo({ current, root, ank, git }) {
  if (current) return current;
  const r = resolveRepo({ cwd: root, last: null, ank, git });
  return r.state === "repo" ? r.repo : null;
}
