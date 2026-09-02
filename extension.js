const vscode = require("vscode");
const { exec } = require("child_process");

// Base is the parent branch (the branch this one was cut from), falling back to
// main/master and finally to HEAD so a repo with neither still counts working-tree
// changes instead of erroring.
const SCRIPT = `
cur=$(git rev-parse --abbrev-ref HEAD)

# A trunk branch has no parent. Without this guard show-branch happily returns an
# unrelated sibling branch, and its merge-base sits far behind HEAD, so a clean
# main reports every commit since the fork as a change.
case "$cur" in
  main|master|HEAD)
    parents=""
    ;;
  *)
    # Its first hit is as often origin/HEAD or a revision expression (feat^) as the
    # real parent, so take every name it offers, trimmed of ^/~, and let the
    # merge-base comparison below pick.
    parents=$(git show-branch -a 2>/dev/null | sed "s/].*//" | grep "\\*" | grep -v "\\[$cur\$" |
              sed -e "s/^.*\\[//" -e "s/[\\^~].*//" | grep -vx "$cur" | awk '!seen[$0]++' | head -n20)
    ;;
esac

# Candidates must be real branches: show-branch emits revision expressions
# (branch^2^^2) as readily as names, and rev-parse verifies those too.
resolve() {
  git rev-parse --verify --quiet "refs/heads/$1" ||
  git rev-parse --verify --quiet "refs/remotes/$1"
}

# Every wrong base -- a stale local master, a mis-detected parent -- sits behind
# the real fork point, so trunk commits merged back into this branch get counted
# as ours. The right base is whichever candidate's merge-base is furthest along.
range=HEAD
for cand in $parents main master origin/main origin/master; do
  [ -n "$cand" ] || continue
  resolve "$cand" >/dev/null || continue
  mb=$(git merge-base HEAD "$cand" 2>/dev/null) || continue
  if [ "$range" = HEAD ] || git merge-base --is-ancestor "$range" "$mb"; then
    range="$mb"
  fi
done

{ git diff -M "$range" --numstat
  git ls-files -o --exclude-standard -z | xargs -0 -r -I{} git diff --no-index --numstat /dev/null {}
} | awk '{ a += $1; r += $2 } END { printf "%d %d", a, r }'
`;

let item;
let running = false;
let pending = false;
let debounceTimer;

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = "gitStats.refresh";
  item.tooltip = "Lines changed vs parent branch (click to refresh)";
  context.subscriptions.push(item);

  context.subscriptions.push(
    vscode.commands.registerCommand("gitStats.refresh", () => refresh())
  );

  // On save.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => schedule())
  );

  // On branch/HEAD change: watch .git/HEAD and refs.
  const watcher = vscode.workspace.createFileSystemWatcher("**/.git/{HEAD,refs/**}");
  watcher.onDidChange(() => schedule());
  watcher.onDidCreate(() => schedule());
  watcher.onDidDelete(() => schedule());
  context.subscriptions.push(watcher);

  // Fallback timer.
  const timer = setInterval(() => refresh(), 60000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  refresh();
}

function schedule() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refresh(), 500);
}

function refresh() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    item.hide();
    return;
  }

  // Coalesce: if a run is in flight, remember to run once more after it finishes.
  if (running) {
    pending = true;
    return;
  }
  running = true;

  exec(SCRIPT, { cwd: folder.uri.fsPath, shell: "/bin/bash", timeout: 15000 }, (err, stdout) => {
    running = false;

    if (err) {
      item.hide();
    } else {
      const [added = "0", removed = "0"] = stdout.trim().split(/\s+/);
      item.text = `$(diff) +${added} -${removed}`;
      item.show();
    }

    if (pending) {
      pending = false;
      refresh();
    }
  });
}

function deactivate() {}

module.exports = { activate, deactivate };
