import * as vscode from "vscode";

export type PublishConfig = {
  outputDir: string;
  auditDir: string;
  pointerPath: string;
  releaseTag: string;
  releaseAssetName: string;
  allowlist: string[];
  exclude: string[];
  requireCleanGit: boolean;
};

export function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) throw new Error("No workspace folder open.");
  return folders[0].uri.fsPath;
}

export function getConfig(): PublishConfig {
  const c = vscode.workspace.getConfiguration("pipz.publish");
  return {
    outputDir: c.get<string>("outputDir", ".pipz_publish_out"),
    auditDir: c.get<string>("auditDir", ".ORCH_AUDITLOG/publish"),
    pointerPath: c.get<string>("pointerPath", "Governance/PIPZ_POINTER.txt"),
    releaseTag: c.get<string>("releaseTag", "context-latest"),
    releaseAssetName: c.get<string>("releaseAssetName", "pipz-context-latest.zip"),
    allowlist: c.get<string[]>("allowlist", []),
    exclude: c.get<string[]>("exclude", []),
    requireCleanGit: c.get<boolean>("requireCleanGit", false)
  };
}
