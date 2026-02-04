import * as fs from "fs-extra";

export async function writePointerFile(
  absPath: string,
  data: {
    bundleUrl: string;
    buildId: string;
    baseCommitSha: string;
    worktreeState: "clean" | "dirty";
    worktreePatchSha256: string;
    manifestSha256: string;
    fileCount: number;
    bundleBytes: number;
  }
): Promise<void> {
  const lines = [
    `BUNDLE_URL: ${data.bundleUrl}`,
    `BUILD_ID: ${data.buildId}`,
    `BASE_COMMIT_SHA: ${data.baseCommitSha}`,
    `WORKTREE_STATE: ${data.worktreeState}`,
    `WORKTREE_PATCH_SHA256: ${data.worktreePatchSha256}`,
    `UPDATED_UTC: ${data.buildId}`,
    `MANIFEST_SHA256: ${data.manifestSha256}`,
    `FILE_COUNT: ${data.fileCount}`,
    `BUNDLE_BYTES: ${data.bundleBytes}`
  ];
  await fs.writeFile(absPath, lines.join("\n") + "\n", { encoding: "utf8" });
}
