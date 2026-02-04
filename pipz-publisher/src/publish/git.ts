import { createHash } from "crypto";
import { execCmdOrThrow } from "./proc";

export type GitIdentity = {
  baseCommitSha: string;
  worktreeState: "clean" | "dirty";
  worktreePatchSha256: string; // "N/A" when clean
};

export async function getGitIdentity(root: string): Promise<GitIdentity> {
  const sha = (await execCmdOrThrow(root, "git", ["rev-parse", "HEAD"])).stdout.trim();
  if (!sha) throw new Error("Failed to read git HEAD.");

  const porcelain = (await execCmdOrThrow(root, "git", ["status", "--porcelain"])).stdout;
  const dirty = porcelain.trim().length > 0;

  let patchHash = "N/A";
  if (dirty) {
    const unstaged = (await execCmdOrThrow(root, "git", ["diff"])).stdout;
    const staged = (await execCmdOrThrow(root, "git", ["diff", "--staged"])).stdout;
    patchHash = sha256Text(unstaged + "\n---STAGED---\n" + staged);
  }

  return {
    baseCommitSha: sha,
    worktreeState: dirty ? "dirty" : "clean",
    worktreePatchSha256: patchHash
  };
}

function sha256Text(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
