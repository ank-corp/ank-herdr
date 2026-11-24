// Starting an agent on a claimable task. Pure: no herdr, gpui-kit or gpui-base
// import (ADR-5872). The mod never claims (ADR-99bc): it opens a tab whose
// first message asks the agent to run `ank claim` under its own identity.

const TASK_ID = /^TASK-[0-9a-f]+$/;

// The first message the started agent reads.
export function startMessage(id) {
  if (typeof id !== "string" || !TASK_ID.test(id)) throw new Error(`not a task id: ${id}`);
  return `Run \`ank claim ${id}\` under your own ank identity, then work that task until \`ank done\` closes it; if you cannot finish it, \`ank release\` it with the reason.`;
}

// The picker's entries: knownAgents() that are installed and can be started,
// in the order Herdr gave them (most picked first).
export function installedAgents(agents) {
  return (Array.isArray(agents) ? agents : []).filter((a) => a && a.installed && Array.isArray(a.run) && a.run.length > 0);
}

const isAnk = (program) => /^ank(\.cmd|\.exe)?$/i.test(String(program).split(/[\\/]/).pop());

// The Herdr command that starts `agent` on task `id` in the repo root.
export function startCommand({ root, agent, id }) {
  if (typeof root !== "string" || root === "") throw new Error("no repo root to start in");
  const run = agent?.run;
  if (!Array.isArray(run) || run.length === 0) throw new Error("the agent has no run to start it with");
  if (isAnk(run[0])) throw new Error(`not an agent: ${run[0]}`);
  return {
    name: "tab.new",
    args: { folder: root, argv: [...run], name: id, task: startMessage(id) },
  };
}

// The ids ank judges claimable: ready, neither claimed nor blocked. Under a
// claim held by the reader, context is in execution mode and lists no task.
export function claimableIds(context) {
  return new Set((context?.tasks ?? []).filter((t) => t.phase === "ready").map((t) => t.id));
}

// The repo-wide read behind claimableIds, run at the repo root.
export const CLAIMABLE_READ = { key: "ready", args: ["context", "--json"], at: "root" };
