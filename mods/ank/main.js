import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, focused, panes, spaces, exec, home, watchFolder } from "herdr";
import { CONTRACT } from "./lib/version.js";
import { IncompatibleContract, statusView, openTasksView, reviewView, graphView, contextView } from "./lib/adapters.js";
import { resolveRepo, sameRepo, ankProgram, repoName, parentDir, touches, corpusChanges, GIT_ARGS } from "./lib/repo.js";
import { sections, READS } from "./lib/sections.js";

// The focused terminal's folder, or null when it is a mod pane or on another
// machine (watchFolder watches this machine only).
function focusedCwd() {
  const f = focused();
  if (!f) return null;
  const pane = f.pane ? panes().find((p) => p.pane === f.pane) : null;
  const remote = f.pane === null ? f.terminal?.includes("/") : spaces().find((s) => s.active)?.machine;
  if (remote) return null;
  return pane?.cwd || f.cwd || null;
}

const run = (program, args, cwd) => exec(program, args, { cwd }).catch(() => null);

const ADAPT = { open: openTasksView, review: reviewView, graph: graphView, context: contextView };

// Refreshes only on a change of focused folder and on watchFolder events on the
// repo's .ank/ and refs/ank (ADR-5468): no cx.timer, no sleep, no poll.
export default class Ank extends View {
  init(_props, cx) {
    this.cx = cx;
    this.ank = ankProgram(home());
    this.cwd = undefined;
    this.folder = null; // the last focused folder inside the shown repo
    this.repo = null;
    this.state = "empty";
    this.found = null;
    this.status = null;
    this.views = {};
    this.error = null;
    this.watches = [];
    this.loading = false;
    this.dirty = false;
    this.collapsed = new Set();
    this.follow(focusedCwd());
  }

  // Herdr re-renders mods when focus moves; a new folder starts a resolution.
  render(_cx) {
    const cwd = focusedCwd();
    if (cwd !== this.cwd) this.follow(cwd);
    return this.draw();
  }

  follow(cwd) {
    this.cwd = cwd;
    this.cx.spawn(async (cx) => {
      const ank = cwd ? await run(this.ank, ["status", "--json"], cwd) : null;
      const git = ank && ank.code === 0 ? await run("git", GIT_ARGS, cwd) : null;
      if (cwd !== this.cwd) return; // focus moved on while ank answered
      const next = resolveRepo({ cwd, last: this.repo, ank, git });
      this.state = next.state;
      this.found = next.found ?? null;
      if (next.state === "repo") this.folder = cwd;
      if (!sameRepo(next.repo, this.repo)) {
        this.repo = next.repo;
        this.status = null;
        this.views = {};
        this.watch(cx);
      }
      await this.reload(cx);
    });
  }

  // One loop per watched folder. A folder that does not exist yet (refs/ank
  // before the first claim or ratification) rejects the watch: its parent is
  // watched instead, its batches filtered to that folder, until it exists.
  watch(cx) {
    for (const w of this.watches) w.cancel();
    this.watches = [];
    const repo = this.repo;
    if (!repo) return;
    const wait = async (dir) => {
      const pending = watchFolder(dir);
      this.watches.push(pending);
      try {
        return await pending;
      } finally {
        this.watches = this.watches.filter((w) => w !== pending);
      }
    };
    for (const dir of repo.watch) {
      cx.spawn(async (cx) => {
        while (this.repo === repo) {
          let paths;
          try {
            paths = await wait(dir);
          } catch {
            try {
              paths = await wait(parentDir(dir));
            } catch {
              return; // neither the folder nor its parent can be watched
            }
            if (!touches(paths, dir)) continue;
          }
          if (this.repo === repo && corpusChanges(paths).length) await this.reload(cx);
        }
      });
    }
  }

  // One round of ank reads at a time; events that land meanwhile owe one more.
  async reload(cx) {
    if (this.loading) {
      this.dirty = true;
      return;
    }
    this.loading = true;
    try {
      do {
        this.dirty = false;
        const repo = this.repo;
        if (!repo) break;
        const folder = this.folder ?? repo.root;
        const [out, ...rest] = await Promise.all([
          run(this.ank, ["status", "--json"], repo.root),
          ...READS.map((r) => run(this.ank, r.args, r.at === "folder" ? folder : repo.root)),
        ]);
        if (repo !== this.repo) continue;
        try {
          this.status = out ? statusView(out.stdout) : null;
          this.error = out ? null : `${this.ank} could not be started`;
          const views = {};
          READS.forEach((r, i) => {
            if (rest[i]) views[r.key] = ADAPT[r.key](rest[i].stdout);
          });
          this.views = views;
          if (this.status && this.state === "incompatible") this.state = "repo";
        } catch (e) {
          if (!(e instanceof IncompatibleContract)) throw e;
          this.state = "incompatible";
          this.found = e.found;
        }
      } while (this.dirty);
    } finally {
      this.loading = false;
    }
    cx.notify();
  }

  toggle(key, cx) {
    if (this.collapsed.has(key)) this.collapsed.delete(key);
    else this.collapsed.add(key);
    cx.notify();
  }

  draw() {
    const t = theme();
    const line = (text, color = t.foreground) => div().text_color(color).child(text);
    const col = v_flex().size_full().bg(t.surface).p(10).gap(4).text_size(13);
    if (this.state === "incompatible") {
      return col
        .child(line("ank"))
        .child(line(`ank speaks contract ${this.found ?? "none"}; this panel reads contract ${CONTRACT}`, t.dim));
    }
    if (!this.repo) {
      return col.child(line("ank")).child(line("Focus a terminal inside an ank repository.", t.dim));
    }
    col.child(line(repoName(this.repo.root)));
    if (this.error) return col.child(line(this.error, t.dim));
    const s = this.status;
    if (!s) return col.child(line("Reading…", t.dim));
    col
      .child(line(`${s.branch ?? "no branch"} · ${s.identity ?? "no identity"}`, t.dim))
      .child(line(`${s.faults} fault(s) · ${s.signals} signal(s)`, t.dim));

    const body = v_flex().id("ank-sections").flex_1().min_h_0().overflow_y_scroll().gap(10).pt(6);
    for (const sec of sections({ status: s, ...this.views })) body.child(this.section(sec, t));
    return col.child(body);
  }

  section(sec, t) {
    const open = !this.collapsed.has(sec.key);
    const head = h_flex()
      .id(`ank-head-${sec.key}`)
      .gap(6)
      .cursor_pointer()
      .on_click((_e, cx) => this.toggle(sec.key, cx))
      .child(div().text_color(t.dim).child(open ? "▾" : "▸"))
      .child(div().text_color(t.foreground).font_weight(600).child(sec.title))
      .child(div().text_color(t.dim).child(String(sec.rows.length)));
    const box = v_flex().gap(2).child(head);
    if (!open) return box;
    if (sec.rows.length === 0) return box.child(div().pl(14).text_color(t.dim).child(sec.empty));
    for (const row of sec.rows) box.child(this.row(sec.key, row, t));
    return box;
  }

  row(key, r, t) {
    const id = div().flex_shrink_0().text_color(t.dim).child(r.short);
    const title = (text, color = t.foreground) => div().min_w_0().truncate().text_color(color).child(text ?? "");
    const h = h_flex().gap(6).pl(14).min_w_0();
    if (key === "tasks") {
      const claimed = r.status === "claimed";
      return h
        .child(id)
        .child(title(r.title ?? r.id))
        .child(div().flex_shrink_0().text_color(claimed ? t.working : t.idle).child(claimed ? `claimed by ${r.holder ?? "?"}` : r.status));
    }
    if (key === "queue") return h.child(id).child(title(r.title)).child(div().flex_shrink_0().text_color(t.dim).child(r.kind));
    if (key === "tree") {
      const color = r.status === "in_progress" ? t.working : r.status === "done" ? t.done : t.foreground;
      return h.pl(14 + 14 * r.depth).child(div().flex_shrink_0().text_color(t.dim).child(r.depth ? "└" : "·")).child(id).child(title(r.title, color));
    }
    return v_flex()
      .pl(14)
      .child(h_flex().gap(6).min_w_0().child(id).child(title(r.title)))
      .child(div().text_color(t.dim).child(r.text ?? ""));
  }
}
