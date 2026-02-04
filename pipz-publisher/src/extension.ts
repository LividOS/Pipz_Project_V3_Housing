import * as vscode from "vscode";
import { runPublish } from "./publish/runPublish";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("pipz.publishBundle", async () => {
    try {
      await runPublish();
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : String(err);
      vscode.window.showErrorMessage(`Pipz publish failed: ${msg}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}