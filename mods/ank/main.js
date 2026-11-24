import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, focused, panes, spaces, terminals, exec, home, watchFolder, knownAgents, notify, pickFolder, run as command } from "herdr";
import { CONTRACT } from "./lib/version.js";
import { IncompatibleContract, statusView, openTasksView, reviewView, graphView, contextView } from "./lib/adapters.js";
import { resolveRepo, sameRepo, ankProgram, repoName, parentDir, touches, corpusChanges, GIT_ARGS } from "./lib/repo.js";
import { sections, READS as SECTION_READS } from "./lib/sections.js";
import { installedAgents, startCommand, claimableIds, CLAIMABLE_READ } from "./lib/start.js";
import { acceptGate, acceptCommand, acceptOutcome } from "./lib/accept.js";
import { terminalCwds, repoCandidates, pickOutcome, STORE_KEY, storeValue, storedRoot, restoredRepo } from "./lib/pick.js";

const READS = [...SECTION_READS, CLAIMABLE_READ];

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

const ADAPT = { open: openTasksView, review: reviewView, graph: graphView, context: contextView, ready: contextView };

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
    this.picking = null; // the task whose agent picker is open
    this.agents = null; // installed knownAgents(), null while asked
    this.pickError = null;
    this.accepting = new Set(); // ids whose ank accept is running
    this.choosing = false; // the header's change control is open
    this.candidates = null; // repos under the open terminals, null while probed
    this.probed = null; // the terminal cwds the candidates were read from
    this.chooseError = null;
    this.restore();
    this.follow(focusedCwd());
  }

  // The repo stored by the last run, re-read through ank; focus that has found
  // a repo meanwhile wins (ADR-2df9).
  restore() {
    const root = storedRoot(localStorage.getItem(STORE_KEY));
    if (!root) return;
    this.cx.spawn(async (cx) => {
      const ank = await run(this.ank, ["status", "--json"], root);
      const git = ank && ank.code === 0 ? await run("git", GIT_ARGS, root) : null;
      const repo = restoredRepo({ current: this.repo, root, ank, git });
      if (repo && !this.repo) {
        this.folder = root;
        await this.show(repo, cx);
      }
    });
  }

  // Shows `repo`, rewatches and stores it when it is another one, and reloads.
  async show(repo, cx) {
    this.state = "repo";
    this.found = null;
    if (!sameRepo(repo, this.repo)) {
      this.repo = repo;
      this.status = null;
      this.views = {};
      this.watch(cx);
      localStorage.setItem(STORE_KEY, storeValue(repo));
    }
    await this.reload(cx);
  }

  // The picker is drawn: probe the ank repos under the open terminals' cwds,
  // again whenever that set of folders changes (render runs on terminals()).
  probe() {
    const cwds = terminalCwds(terminals());
    const probed = cwds.join("|");
    if (probed === this.probed) return;
    this.probed = probed;
    this.candidates = null;
    this.cx.spawn(async (cx) => {
      const probes = await Promise.all(
        cwds.map(async (cwd) => {
          const ank = await run(this.ank, ["status", "--json"], cwd);
          const git = ank && ank.code === 0 ? await run("git", GIT_ARGS, cwd) : null;
          return { cwd, ank, git };
        }),
      );
      if (probed === this.probed) this.candidates = repoCandidates(probes, this.repo);
      cx.notify();
    });
  }

  // A candidate's root, or (root null) the folder the system picker answers.
  choose(root, cx) {
    this.chooseError = null;
    cx.notify();
    this.cx.spawn(async (cx) => {
      let folder;
      try {
        folder = root ?? (await pickFolder({ prompt: "Show in ank" }));
      } catch (e) {
        this.chooseError = `pickFolder failed: ${e?.message ?? e}`;
        return cx.notify();
      }
      const ank = folder ? await run(this.ank, ["status", "--json"], folder) : null;
      const git = ank && ank.code === 0 ? await run("git", GIT_ARGS, folder) : null;
      const out = pickOutcome({ folder, ank, git });
      if (out.cancelled) return cx.notify();
      if (out.error) {
        this.chooseError = out.error;
        return cx.notify();
      }
      this.choosing = false;
      this.probed = null;
      this.folder = folder;
      await this.show(out.repo, cx);
    });
  }

  toggleChoosing(cx) {
    this.choosing = !this.choosing;
    this.chooseError = null;
    this.probed = null;
    cx.notify();
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
      if (next.state === "repo") {
        this.folder = cwd;
        return this.show(next.repo, cx);
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

  // The start button: opens the picker of installed agents for task `id`.
  pick(id, cx) {
    if (this.picking === id) {
      this.picking = null;
      return cx.notify();
    }
    this.picking = id;
    this.agents = null;
    this.pickError = null;
    cx.notify();
    this.cx.spawn(async (cx) => {
      try {
        const agents = installedAgents(await knownAgents());
        if (this.picking === id) this.agents = agents;
      } catch (e) {
        if (this.picking === id) this.pickError = `knownAgents failed: ${e?.message ?? e}`;
      }
      cx.notify();
    });
  }

  // Opens the agent's tab in the repo root; the agent claims the task itself
  // (ADR-99bc): no ank command runs here.
  start(id, agent, cx) {
    this.picking = null;
    try {
      const { name, args } = startCommand({ root: this.repo?.root, agent, id });
      command(name, args);
    } catch (e) {
      this.error = `could not start ${id}: ${e?.message ?? e}`;
    }
    cx.notify();
  }

  // The accept button: the mod's only writing command (ADR-99bc), on the
  // default branch only. The refs/ank watch reloads the queue once it lands.
  accept(id, cx) {
    if (this.accepting.has(id) || !acceptGate(this.status).enabled) return;
    let cmd;
    try {
      cmd = acceptCommand({ ank: this.ank, root: this.repo?.root, id });
    } catch (e) {
      notify({ title: `ank refused to accept ${id}`, body: String(e?.message ?? e), level: "error" });
      return;
    }
    this.accepting.add(id);
    cx.notify();
    this.cx.spawn(async (cx) => {
      const result = await run(cmd.program, cmd.args, cmd.cwd);
      this.accepting.delete(id);
      notify(acceptOutcome(id, result, cmd.program));
      await this.reload(cx);
    });
  }

  // The repos under the open terminals, then the system folder picker.
  chooser(t) {
    this.probe();
    const box = v_flex().gap(2).pt(4).pb(6);
    if (!this.candidates) box.child(div().text_color(t.dim).child("Looking in the open terminals…"));
    else if (this.candidates.length === 0) box.child(div().text_color(t.dim).child("No other ank repository in the open terminals."));
    else {
      for (const c of this.candidates) {
        box.child(
          h_flex()
            .id(`ank-repo-${c.root}`)
            .gap(6)
            .min_w_0()
            .cursor_pointer()
            .on_click((_e, cx) => this.choose(c.root, cx))
            .child(div().flex_shrink_0().text_color(t.foreground).child(c.name))
            .child(div().min_w_0().truncate().text_color(t.dim).child(c.root)),
        );
      }
    }
    box.child(
      div()
        .id("ank-open-folder")
        .cursor_pointer()
        .text_color(t.foreground)
        .on_click((_e, cx) => this.choose(null, cx))
        .child("Open folder…"),
    );
    if (this.chooseError) box.child(div().text_color(t.dim).child(this.chooseError));
    return box;
  }

  picker(id, t) {
    const box = v_flex().pl(28).gap(2);
    if (this.pickError) return box.child(div().text_color(t.dim).child(this.pickError));
    if (!this.agents) return box.child(div().text_color(t.dim).child("Looking for agents…"));
    if (this.agents.length === 0) return box.child(div().text_color(t.dim).child("No installed agent."));
    for (const a of this.agents) {
      box.child(
        div()
          .id(`ank-agent-${id}-${a.key}`)
          .cursor_pointer()
          .text_color(t.foreground)
          .on_click((_e, cx) => this.start(id, a, cx))
          .child(a.name ?? a.key),
      );
    }
    return box;
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
      return col
        .child(line("ank"))
        .child(line("Focus a terminal inside an ank repository, or pick one.", t.dim))
        .child(this.chooser(t));
    }
    col.child(
      h_flex()
        .gap(6)
        .min_w_0()
        .child(div().flex_1().min_w_0().truncate().text_color(t.foreground).child(repoName(this.repo.root)))
        .child(
          div()
            .id("ank-change-repo")
            .flex_shrink_0()
            .cursor_pointer()
            .text_color(t.dim)
            .on_click((_e, cx) => this.toggleChoosing(cx))
            .child(this.choosing ? "cancel" : "change"),
        ),
    );
    if (this.choosing) col.child(this.chooser(t));
    if (this.error) return col.child(line(this.error, t.dim));
    const s = this.status;
    if (!s) return col.child(line("Reading…", t.dim));
    this.claimable = claimableIds(this.views.ready);
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
      h.child(id)
        .child(title(r.title ?? r.id))
        .child(div().flex_shrink_0().text_color(claimed ? t.working : t.idle).child(claimed ? `claimed by ${r.holder ?? "?"}` : r.status));
      if (claimed || !this.claimable?.has(r.id)) return h;
      h.child(
        div()
          .id(`ank-start-${r.id}`)
          .flex_shrink_0()
          .cursor_pointer()
          .text_color(t.foreground)
          .on_click((_e, cx) => this.pick(r.id, cx))
          .child(this.picking === r.id ? "cancel" : "start"),
      );
      return this.picking === r.id ? v_flex().child(h).child(this.picker(r.id, t)) : h;
    }
    if (key === "queue") {
      h.child(id).child(title(r.title)).child(div().flex_shrink_0().text_color(t.dim).child(r.kind));
      const gate = acceptGate(this.status);
      const busy = this.accepting.has(r.id);
      const button = div().id(`ank-accept-${r.id}`).flex_shrink_0();
      if (busy) return h.child(button.text_color(t.dim).child("accepting…"));
      if (!gate.enabled) return v_flex().child(h.child(button.text_color(t.dim).child("accept"))).child(div().pl(28).text_color(t.dim).child(gate.reason));
      return h.child(button.cursor_pointer().text_color(t.foreground).on_click((_e, cx) => this.accept(r.id, cx)).child("accept"));
    }
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
