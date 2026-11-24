// The four sections the panel draws, built from the adapters' view models.
// Pure: no herdr, gpui-kit or gpui-base import (ADR-5872). Each section is
// { key, title, empty, rows }; `empty` is the line drawn when rows is [].

const short = (id) => (typeof id === "string" ? id.replace(/^([A-Z]+-[0-9a-f]{4})[0-9a-f]*$/, "$1") : id);

// Open and claimed tasks across the repo: `find --status open` leaves out
// in_progress, so claims come from status (elsewhere, and the mod's own claim).
export function tasksSection({ open, status }) {
  const rows = [];
  const seen = new Set();
  const add = (row) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    rows.push(row);
  };
  // The own claim has no title in status, and find never lists it (in_progress).
  if (status?.claim) {
    add({ id: status.claim.id, short: short(status.claim.id), title: null, status: "claimed", holder: status.identity });
  }
  for (const c of status?.elsewhere ?? []) {
    add({ id: c.id, short: short(c.id), title: c.title ?? null, status: "claimed", holder: c.holder ?? null });
  }
  for (const t of open?.items ?? []) {
    if (t.kind && t.kind !== "task") continue;
    add({ id: t.id, short: short(t.id), title: t.title ?? null, status: t.state ?? "open", holder: null });
  }
  return { key: "tasks", title: "Tasks", empty: "No open or claimed task.", rows };
}

// Proposed ADRs and specs, waiting for a human to ratify.
export function queueSection({ review }) {
  const rows = (review?.proposed ?? []).map((p) => ({
    id: p.id,
    short: short(p.id),
    kind: /^SPEC-/.test(p.id) ? "spec" : "adr",
    title: p.title ?? null,
  }));
  return { key: "queue", title: "Ratification queue", empty: "Nothing proposed.", rows };
}

// The blocked_by forest flattened depth first: each row indented under the
// task that blocks it.
export function treeSection({ graph }) {
  const rows = [];
  const walk = (node, depth) => {
    rows.push({ id: node.id, short: node.short ?? short(node.id), title: node.title ?? null, status: node.status ?? null, depth });
    for (const c of node.children ?? []) walk(c, depth + 1);
  };
  for (const r of graph?.roots ?? []) walk(r, 0);
  return { key: "tree", title: "blocked_by", empty: "No task in the graph.", rows };
}

// The constraints binding the focused folder, as `ank context .` reports them.
export function constraintsSection({ context }) {
  const rows = (context?.constraints ?? []).map((k) => ({
    id: k.id,
    short: k.short ?? short(k.id),
    title: k.title ?? null,
    text: k.text ?? null,
  }));
  return { key: "constraints", title: "Constraints here", empty: "No constraint binds this folder.", rows };
}

export function sections(views) {
  return [tasksSection(views), queueSection(views), treeSection(views), constraintsSection(views)];
}

// The `ank <verb> --json` reads behind the sections, with the cwd each runs in:
// the repo root for repo-wide views, the focused folder for context.
export const READS = [
  { key: "open", args: ["find", "--status", "open", "--json"], at: "root" },
  { key: "review", args: ["review", "--json"], at: "root" },
  { key: "graph", args: ["graph", "--json"], at: "root" },
  { key: "context", args: ["context", ".", "--json"], at: "folder" },
];
