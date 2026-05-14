import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const FOREST_FILE = join(homedir(), ".niwaki", "forest.json");
const DEBOUNCE_MS = 2000;

let statusBarItem: vscode.StatusBarItem;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("niwaki");
  return {
    enabled: cfg.get<boolean>("enabled", true),
    autoDetect: cfg.get<boolean>("autoDetect", true),
    minLines: cfg.get<number>("minLines", 3),
  };
}

function readForest(): { count: number; streak: number } {
  try {
    const forest = JSON.parse(readFileSync(FOREST_FILE, "utf8"));
    return {
      count: forest.trees?.length ?? 0,
      streak: forest.streak ?? 0,
    };
  } catch {
    return { count: 0, streak: 0 };
  }
}

function updateStatusBar() {
  const { count, streak } = readForest();
  statusBarItem.text = `$(tree) ${count}`;
  const streakText = streak > 0 ? ` · ${streak}d streak` : "";
  statusBarItem.tooltip = `Niwaki: ${count} tree${count === 1 ? "" : "s"}${streakText}`;
}

function plantTree(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("niwaki", ["plant"], (error) => {
      if (error) {
        reject(error);
      } else {
        updateStatusBar();
        resolve();
      }
    });
  });
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "niwaki.plant";
  updateStatusBar();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("niwaki.plant", async () => {
      const { enabled } = getConfig();
      if (!enabled) {
        return;
      }
      try {
        await plantTree();
      } catch {
        vscode.window.showErrorMessage(
          "Niwaki: failed to plant. Is niwaki installed? (npm i -g niwaki)",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const { enabled, autoDetect, minLines } = getConfig();
      if (!enabled || !autoDetect) {
        return;
      }

      const isAiInsertion = e.contentChanges.some((change) => {
        const newlines = (change.text.match(/\n/g) || []).length;
        return newlines >= minLines;
      });

      if (!isAiInsertion) {
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        plantTree().catch(() => {});
      }, DEBOUNCE_MS);
    }),
  );
}

export function deactivate() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}
