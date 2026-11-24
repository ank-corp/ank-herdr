import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme, focused, panes, spaces, exec, home, watchFolder } from "herdr";
import { CONTRACT } from "./lib/version.js";
import { IncompatibleContract, statusView } from "./lib/adapters.js";
import { resolveRepo, sameRepo, ankProgram, repoName, GIT_ARGS } from "./lib/repo.js";

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

// Refreshes only on a change of focused folder and on watchFolder events on the
// repo's .ank/ and refs/ank (ADR-5468): no cx.timer, no sleep, no poll.
export default class Ank extends View {
  init(_props, cx) {
    this.cx = cx;
    this.ank = ankProgram(home());
    this.cwd = undefined;
    this.repo = null;
    this.state = "empty";
    this.found = null;
    this.status = null;
    this.error = null;
    this.watches = [];
    this.loading = false;
    this.dirty = false;
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
      if (!sameRepo(next.repo, this.repo)) {
        this.repo = next.repo;
        this.status = null;
        this.watch(cx);
      }
      await this.reload(cx);
    });
  }

  watch(cx) {
    for (const w of this.watches) w.cancel();
    this.watches = [];
    const repo = this.repo;
    if (!repo) return;
    for (const dir of repo.watch) {
      cx.spawn(async (cx) => {
        while (this.repo === repo) {
          const pending = watchFolder(dir);
          this.watches.push(pending);
          let paths;
          try {
            paths = await pending;
          } catch {
            return; // refs/ank is made by the first claim; the focus change after it rewatches
          } finally {
            this.watches = this.watches.filter((w) => w !== pending);
          }
          if (this.repo === repo && paths.length) await this.reload(cx);
        }
      });
    }
  }

  // One ank read at a time; events that land meanwhile owe one more.
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
        const out = await run(this.ank, ["status", "--json"], repo.root);
        if (repo !== this.repo) continue;
        try {
          this.status = out ? statusView(out.stdout) : null;
          this.error = out ? null : `${this.ank} could not be started`;
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
    return col
      .child(line(`${s.branch ?? "no branch"} · ${s.identity ?? "no identity"}`, t.dim))
      .child(line(s.claim ? `claim ${s.claim.id}` : "no claim", t.dim))
      .child(line(`${s.queue} to ratify · ${s.faults} fault(s) · ${s.signals} signal(s)`, t.dim));
  }
}
