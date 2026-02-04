import { execCmdOrThrow } from "./proc";

export async function ghEnsureRelease(root: string, tag: string): Promise<void> {
  // If view fails, create
  const view = await execCmdOrOk(root, "gh", ["release", "view", tag]);
  if (view.ok) return;

  await execCmdOrThrow(root, "gh", [
    "release",
    "create",
    tag,
    "--title",
    "Pipz Context Bundle (Latest)",
    "--notes",
    "Latest published context bundle."
  ]);
}

export async function ghUploadAsset(root: string, tag: string, zipAbs: string): Promise<{ stdout: string; stderr: string }> {
  const res = await execCmdOrThrow(root, "gh", ["release", "upload", tag, zipAbs, "--clobber"]);
  return { stdout: res.stdout, stderr: res.stderr };
}

export async function ghGetBrowserDownloadUrl(root: string, tag: string, assetName: string): Promise<string> {
  // Reliable URL for pointer: uses API jq to return browser_download_url
  const res = await execCmdOrThrow(root, "gh", [
    "api",
    `repos/{owner}/{repo}/releases/tags/${tag}`,
    "--jq",
    `.assets[] | select(.name=="${assetName}") | .browser_download_url`
  ]);

  const url = res.stdout.trim();
  if (!url) throw new Error(`Could not resolve browser_download_url for asset "${assetName}" on tag "${tag}".`);
  return url;
}

async function execCmdOrOk(cwd: string, cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const res = await execCmdOrThrow(cwd, cmd, args);
    return { ok: true, stdout: res.stdout, stderr: res.stderr };
  } catch (e: any) {
    return { ok: false, stdout: "", stderr: e?.message ? String(e.message) : String(e) };
  }
}
