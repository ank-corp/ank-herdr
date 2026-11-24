// Adapters from the stdout of `ank <verb> --json` to the plain view models the
// panel draws (ADR-98bd). Pure: no herdr, gpui-kit or gpui-base import (ADR-5872).
import { CONTRACT } from "./version.js";

// Thrown for any output this mod will not read: another contract, no contract,
// or no JSON at all. `found` is the contract seen, or null when there was none.
export class IncompatibleContract extends Error {
  constructor(found, verb) {
    super(
      found === null
        ? `ank ${verb} --json: no contract in the output, expected contract ${CONTRACT}`
        : `ank ${verb} --json: contract ${found}, expected contract ${CONTRACT}`,
    );
    this.name = "IncompatibleContract";
    this.verb = verb;
    this.expected = CONTRACT;
    this.found = found;
  }
}

function accept(stdout, verb) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new IncompatibleContract(null, verb);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) || !("contract" in value)) {
    throw new IncompatibleContract(null, verb);
  }
  if (value.contract !== CONTRACT) throw new IncompatibleContract(value.contract, verb);
  return value;
}

const list = (v) => (Array.isArray(v) ? v : []);

// `ank status --json`
export function statusView(stdout) {
  const s = accept(stdout, "status");
  return {
    branch: s.branch ?? null,
    defaultBranch: s.default_branch ?? null,
    identity: s.identity?.value ?? null,
    claim: s.claim ? { id: s.claim.id, expires: s.claim.expires, lapsed: Boolean(s.claim.lapsed) } : null,
    elsewhere: list(s.elsewhere).map((c) => ({ id: c.id, title: c.title, holder: c.holder, expires: c.expires })),
    constraints: s.constraints ?? 0,
    queue: s.queue ?? 0,
    drift: s.drift?.entities ?? 0,
    faults: s.faults ?? 0,
    signals: s.signals ?? 0,
  };
}

// `ank find --status open --json`
export function openTasksView(stdout) {
  const f = accept(stdout, "find");
  return {
    total: f.total ?? 0,
    hidden: f.hidden ?? 0,
    items: list(f.results).map((r) => ({ id: r.id, kind: r.kind, title: r.title, state: r.state })),
  };
}

// `ank review --json`
export function reviewView(stdout) {
  const r = accept(stdout, "review");
  return {
    proposed: list(r.proposed).map((p) => ({ id: p.id, title: p.title })),
    dead: r.dead ?? 0,
    faults: r.faults ?? 0,
    signals: r.signals ?? 0,
  };
}

// `ank graph --json`, as a forest: each task hangs under every task blocking it,
// and the roots are the tasks nothing in the graph blocks, in ank's order. A
// task met again on its own path is not descended into, so a cycle terminates;
// when every task is blocked (a pure cycle) every task becomes a root.
export function graphView(stdout) {
  const g = accept(stdout, "graph");
  const tasks = list(g.tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const blocks = new Map();
  const blocked = new Set();
  for (const { task, blocked_by } of list(g.edges)) {
    if (!byId.has(task) || !byId.has(blocked_by)) continue;
    if (!blocks.has(blocked_by)) blocks.set(blocked_by, []);
    blocks.get(blocked_by).push(task);
    blocked.add(task);
  }
  const node = (id, path) => {
    const t = byId.get(id);
    const next = new Set(path).add(id);
    return {
      id: t.id,
      short: t.short,
      title: t.title,
      status: t.status,
      children: (blocks.get(id) ?? []).filter((c) => !next.has(c)).map((c) => node(c, next)),
    };
  };
  let roots = tasks.filter((t) => !blocked.has(t.id));
  if (roots.length === 0) roots = tasks;
  return { roots: roots.map((t) => node(t.id, new Set())) };
}

const CLAIMED = "claimed:";

// `ank context [<path>] --json`. A task's phase is claimed when someone holds
// it, otherwise ready or blocked as ank judges it.
export function contextView(stdout) {
  const c = accept(stdout, "context");
  return {
    mode: c.mode,
    head: c.head ?? null,
    criteria: c.criteria ?? null,
    method: c.method ?? null,
    constraints: list(c.constraints).map((k) => ({ id: k.id, short: k.short, title: k.title, text: k.constraint })),
    proposed: list(c.proposed).map((p) => ({ id: p.id, short: p.short, title: p.title })),
    tasks: list(c.tasks).map((t) => {
      const state = typeof t.state === "string" ? t.state : "";
      const holder = state.startsWith(CLAIMED) ? state.slice(CLAIMED.length) : null;
      return {
        id: t.id,
        short: t.short,
        title: t.title,
        phase: holder !== null ? "claimed" : t.ready ? "ready" : "blocked",
        holder,
        unblocks: t.unblocks ?? 0,
      };
    }),
    ready: c.ready ?? 0,
    blocked: c.blocked ?? 0,
    warnings: list(c.warnings),
  };
}
