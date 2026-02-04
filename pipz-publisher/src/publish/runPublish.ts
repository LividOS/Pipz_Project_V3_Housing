import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";

import { getWorkspaceRoot, getConfig } from "./workspace";
import { preflightChecks } from "./preflight";
import { computeBuildIdUtc, writeTextFile } from "./utils";
import { getGitIdentity } from "./git";
import { collectFiles } from "./collect";
import { buildManifest } from "./manifest";
import { createBundleZip } from "./zip";
import { ghEnsureRelease, ghUploadAsset, ghGetBrowserDownloadUrl } from "./github";
import { writePointerFile } from "./pointer";
import { writeAuditRecord } from "./audit";

export async function runPublish(): Promise<void> {
  const root = getWorkspaceRoot();
  const cfg = getConfig();

  await preflightChecks(root, cfg);

  const buildId = computeBuildIdUtc();

  const outDirAbs = path.join(root, cfg.outputDir);
  const auditDirAbs = path.join(root, cfg.auditDir);
  const pointerAbs = path.join(root, cfg.pointerPath);

  await fs.ensureDir(outDirAbs);
  await fs.ensureDir(auditDirAbs);
  await fs.ensureDir(path.dirname(pointerAbs));

  const { baseCommitSha, worktreeState, worktreePatchSha256 } = await getGitIdentity(root);

  const buildIdPath = path.join(outDirAbs, "BUILD_ID.txt");
  const commitPath = path.join(outDirAbs, "COMMIT_SHA.txt");
  await writeTextFile(buildIdPath, buildId + "\n");
  await writeTextFile(commitPath, baseCommitSha + "\n");

  const filesRel = await collectFiles(root, cfg.allowlist, cfg.exclude);
  if (filesRel.length === 0) throw new Error("No files matched allowlist after excludes.");

  const manifestPath = path.join(outDirAbs, "MANIFEST.json");
  const { manifest, manifestSha256 } = await buildManifest(root, filesRel);
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });

  // IMPORTANT: zip path is fixed to the asset name for stable publishing
  const zipPath = path.join(outDirAbs, cfg.releaseAssetName);

  await createBundleZip(root, filesRel, zipPath, [
    { absPath: manifestPath, zipPath: "MANIFEST.json" },
    { absPath: buildIdPath, zipPath: "BUILD_ID.txt" },
    { absPath: commitPath, zipPath: "COMMIT_SHA.txt" }
  ]);

  const bundleStats = await fs.stat(zipPath);

  await ghEnsureRelease(root, cfg.releaseTag);
  const upload = await ghUploadAsset(root, cfg.releaseTag, zipPath);
  const bundleUrl = await ghGetBrowserDownloadUrl(root, cfg.releaseTag, cfg.releaseAssetName);

  await writePointerFile(pointerAbs, {
    bundleUrl,
    buildId,
    baseCommitSha,
    worktreeState,
    worktreePatchSha256: worktreeState === "dirty" ? worktreePatchSha256 : "N/A",
    manifestSha256,
    fileCount: filesRel.length,
    bundleBytes: bundleStats.size
  });

  await writeAuditRecord(path.join(auditDirAbs, `publish_${buildId}.json`), {
    buildId,
    baseCommitSha,
    worktreeState,
    worktreePatchSha256: worktreeState === "dirty" ? worktreePatchSha256 : "N/A",
    outputDir: cfg.outputDir,
    auditDir: cfg.auditDir,
    pointerPath: cfg.pointerPath,
    allowlist: cfg.allowlist,
    exclude: cfg.exclude,
    releaseTag: cfg.releaseTag,
    releaseAssetName: cfg.releaseAssetName,
    manifestSha256,
    fileCount: filesRel.length,
    bundleBytes: bundleStats.size,
    bundleUrl,
    ghUpload: upload
  });

  vscode.window.showInformationMessage(`Pipz published: BUILD_ID ${buildId}`);
}
