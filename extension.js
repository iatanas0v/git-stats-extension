const vscode = require("vscode");
const { exec } = require("child_process");

// Reuses the user's shell pipeline. Guards the empty-base case so a repo with no
// main/master still counts working-tree changes instead of erroring.
const SCRIPT = `
base=$(for b in main master origin/main origin/master; do \
         git rev-parse --verify --quiet "$b" >/dev/null && { echo "$b"; break; }; \
       done)
if [ -n "$base" ]; then
  range=$(git merge-base HEAD "$base")
else
  range=HEAD
fi
{ git diff -M "$range" --numstat; \
  git ls-files -o --exclude-standard -z | xargs -0 -r -I{} git diff --no-index --numstat /dev/null {}; \
} | awk '{ a += $1; r += $2 } END { printf "%d %d", a, r }'
`;

let item;
let running = false;
let pending = false;
let debounceTimer;

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = "gitStats.refresh";
  item.tooltip = "Lines changed vs base branch (click to refresh)";
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
