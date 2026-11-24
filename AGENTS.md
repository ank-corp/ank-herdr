This repo uses Ank: tasks and decisions live in `.ank/`.
Ank is a CLI, `ank`, and `.ank/` is opaque like `.git/`: never read or edit its files by hand, reach them through the CLI.

- Run `ank context <path>` before editing a path: it prints the decisions that bind it, in full, and what is claimable there.
- `ank claim <id>` takes a task and freezes its criterion; `ank done` closes it, running its verifiers itself.
- `ank help` lists every verb, and `ank help <verb>` gives its flags.

Install: https://haksolot.github.io/ank/install.html
