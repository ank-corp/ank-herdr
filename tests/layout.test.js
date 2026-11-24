import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = JSON.parse(readFileSync(new URL("../layouts/ank.json", import.meta.url), "utf8"));

function find(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

test("root row is main's sidebar and work, then the ank block on the right", () => {
  assert.equal(layout.id, "root");
  assert.equal(layout.type, "row");
  assert.deepEqual(layout.children.map((c) => c.id), ["sidebar", "work", "ank"]);
  assert.notEqual(layout.resizable, false, "the root boundaries stay draggable");
});

test("the sidebar keeps main's spaces and agents lists", () => {
  const sidebar = find(layout, "sidebar");
  assert.equal(sidebar.type, "column");
  assert.equal(find(sidebar, "spaces").content.mod, "spaces");
  assert.equal(find(sidebar, "agents").content.mod, "agents");
});

test("the centre keeps main's tabs and active tab", () => {
  const work = find(layout, "work");
  assert.equal(work.type, "column");
  assert.equal(find(work, "tabs").content.mod, "tabs");
  assert.equal(find(work, "main").content.tab, "active");
});

test("the ank block is about 320 px, resizable, and shows the ank mod", () => {
  const ank = layout.children.at(-1);
  assert.equal(ank.type, "block");
  assert.deepEqual(ank.content, { mod: "ank" });
  assert.ok(Math.abs(ank.size.px - 320) <= 40, `width ${ank.size.px}`);
  assert.ok(ank.min < ank.size.px && ank.size.px < ank.max, "room to drag both ways");
  assert.notEqual(ank.hidden, true);
});

test("ids are unique and the ank mod appears once", () => {
  const ids = [];
  let ankMods = 0;
  walk(layout, (n) => {
    ids.push(n.id);
    if (n.content?.mod === "ank") ankMods++;
  });
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ankMods, 1);
});

test("no theme, colors or fonts of its own (ADR-df02)", () => {
  const raw = JSON.stringify(layout);
  assert.doesNotMatch(raw, /#[0-9a-fA-F]{3,8}\b/, "no hex color");
  for (const key of ["theme", "themes", "font", "fonts", "font_family", "font_size", "colors"]) {
    assert.ok(!(key in layout), `root sets ${key}`);
  }
  walk(layout, (n) => {
    for (const key of Object.keys(n)) assert.doesNotMatch(key, /font|theme/i, `${n.id} sets ${key}`);
  });
});
