# Git Diff Stats

Shows added/removed line counts vs the base branch in the VSCode status bar.

`$(diff) +123 -45` means 123 lines added, 45 removed compared to the base
branch — including untracked files.

## What it counts

Diff between `HEAD`'s merge-base with the base branch and the working tree, plus
untracked files. Base branch is the first that exists of: `main`, `master`,
`origin/main`, `origin/master`. If none exist, it counts working-tree changes
against `HEAD`.

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
code --install-extension git-stats-exten-0.0.1.vsix
```
