// Accepting a proposed ADR or spec from the ratification queue: the mod's only
// writing command, run on the default branch at the person's click (ADR-99bc).
// Pure: no herdr, gpui-kit or gpui-base import (ADR-5872).

const RATIFIABLE = /^(ADR|SPEC)-[0-9a-f]+$/;

const isAnk = (program) => /^ank(\.cmd|\.exe)?$/i.test(String(program ?? "").split(/[\\/]/).pop());

// Whether the accept buttons are live, from statusView(): only when the repo's
// branch is its default_branch. `reason` is what a disabled button says.
export function acceptGate(status) {
  if (!status) return { enabled: false, reason: "ank status not read yet" };
  const { branch, defaultBranch } = status;
  if (!defaultBranch) return { enabled: false, reason: "ank knows no default branch here" };
  if (!branch) return { enabled: false, reason: `no branch checked out: accept runs on ${defaultBranch}` };
  if (branch !== defaultBranch) return { enabled: false, reason: `on ${branch}: accept runs on ${defaultBranch}` };
  return { enabled: true, reason: null };
}

// The exec behind one accept: `<ank> accept <id>` in the repo root. `ank` is
// ankProgram(home()); the id must name an ADR or a spec, so no flag rides in.
export function acceptCommand({ ank, root, id }) {
  if (typeof id !== "string" || !RATIFIABLE.test(id)) throw new Error(`not an ADR or spec id: ${id}`);
  if (typeof root !== "string" || root === "") throw new Error("no repo root to accept in");
  if (!isAnk(ank)) throw new Error(`not ank: ${ank}`);
  return { program: ank, args: ["accept", id], cwd: root };
}

const text = (s) => (typeof s === "string" ? s.trim() : "");

// The notify() payload for what `ank accept <id>` answered. `result` is the
// exec result { code, stdout, stderr }, or null when `program` could not start.
// A refusal carries ank's own error message, which names the command that
// resolves it.
export function acceptOutcome(id, result, program = "ank") {
  if (result && result.code === 0) {
    return { title: `Accepted ${id}`, body: text(result.stdout) || `ank accept ${id} succeeded`, level: "success" };
  }
  const body = !result
    ? `${program} could not be started`
    : text(result.stderr) || text(result.stdout) || `ank accept exited ${result.code}`;
  return { title: `ank refused to accept ${id}`, body, level: "error" };
}
