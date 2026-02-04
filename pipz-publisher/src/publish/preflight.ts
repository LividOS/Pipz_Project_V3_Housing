import * as path from "path";
import * as fs from "fs-extra";
import { execCmdOrThrow } from "./proc";
import { PublishConfig } from "./workspace";

export async function preflightChecks(root: string, cfg: PublishConfig): Promise<void> {
  const gitDir = path.join(root, ".git");
  if (!(await fs.pathExists(gitDir))) throw new Error("Workspace root is not a git repo (missing .git).");

  // gh exists
  await execCmdOrThrow(root, "gh", ["--version"]);

  // gh auth
  await execCmdOrThrow(root, "gh", ["auth", "status"]);

  if (cfg.requireCleanGit) {
    const out = await execCmdOrThrow(root, "git", ["status", "--porcelain"]);
    if (out.stdout.trim().length > 0) throw new Error("Git worktree is dirty and requireCleanGit=true.");
  }
}
