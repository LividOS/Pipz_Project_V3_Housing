// ------------------------------------------------------------------
// GEMINI MEM TAG (DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\PipzOrchestratorExtension\src\extension.ts"
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// MAINTEMPLATE - extension.ts
// Version: 0.1.0
// Last change: Initial creation.
// Content-Fingerprint: YYYY-MM-DDTHH-MM-SSZ-XXXXXXXX
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
// ------------------------------------------------------------------

import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";

function runNode(scriptPath: string, args: string[], cwd: string): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [scriptPath, ...args], { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", d => (stdout += d.toString()));
    child.stderr.on("data", d => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Orchestrator exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("pipzOrch.run", async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("Open the Pipz_Project_V3 workspace folder first.");
      return;
    }

    const repoRoot = workspaceFolders[0].uri.fsPath;

    const userGoal = await vscode.window.showInputBox({
      title: "Pipz Orchestrator — User Goal",
      prompt: "Describe what you want to do. (MVP only runs bootstrap verification and writes an audit log.)",
      ignoreFocusOut: true
    });

    if (!userGoal) return;

    const orchScript = context.asAbsolutePath(path.join("..", "..", "orchestrator", "orch_bootstrap.js"));

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Pipz Orchestrator: Running bootstrap verification...", cancellable: false },
        async () => {
          const { stdout } = await runNode(orchScript, ["--repo", repoRoot, "--goal", userGoal], repoRoot);
          const channel = vscode.window.createOutputChannel("Pipz Orchestrator");
          channel.appendLine(stdout);
          channel.show(true);
        }
      );

      vscode.window.showInformationMessage("Bootstrap verification complete. See .ORCH_AUDITLOG for artifacts.");
    } catch (err: any) {
      vscode.window.showErrorMessage(err?.message ?? String(err));
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
