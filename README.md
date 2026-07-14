# Git Diff Stats

Shows added/removed line counts vs the parent branch in the VSCode status bar.

`$(diff) +123 -45` means 123 lines added, 45 removed compared to the parent
branch — including untracked files.

<img width="353" height="47" alt="image" src="https://github.com/user-attachments/assets/ab1335ba-1c50-4cc0-a6d2-b052d33e0b74" />

## What it counts

Diff between `HEAD`'s merge-base with the base branch and the working tree, plus
untracked files.

The base branch is the **parent branch** — the branch the current one was cut
from, detected via `git show-branch`. This keeps stacked branches honest: a
branch off a feature branch counts only its own lines, not the parent's too.
If no parent is found (e.g. you're on `main`), it falls back to the first that
exists of `main`, `master`, `origin/main`, `origin/master`, and finally to
working-tree changes against `HEAD`.

## When it refreshes

- On file save
- On branch switch / commit (watches `.git/HEAD` and refs)
- Every 60 seconds (fallback)
- On click (the status bar item runs a manual refresh)

## Requirements

Uses `git`, `bash`, `awk`, and `xargs` via a shell. Built and tested on macOS.

## Run from source

Open this folder in VSCode and press **F5** to launch an Extension Development
Host, then open a git repo in that window.

## Install the packaged build

```
npm run package
code --install-extension git-changed-lines.vsix --force
```

## Install from marketplace

https://marketplace.visualstudio.com/items?itemName=iatanas0v.git-changed-lines
