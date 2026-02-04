import * as path from "path";
import * as fs from "fs";
import { createHash } from "crypto";

export type ManifestEntry = { path: string; size: number; sha256: string };
export type Manifest = { generated_utc: string; entries: ManifestEntry[] };

export async function buildManifest(root: string, filesRel: string[]): Promise<{ manifest: Manifest; manifestSha256: string }> {
  const entries: ManifestEntry[] = [];

  for (const rel of filesRel) {
    const abs = path.join(root, rel);
    const st = await fs.promises.stat(abs);
    const sha = await sha256File(abs);
    entries.push({
      path: rel.replace(/\\/g, "/"),
      size: st.size,
      sha256: sha
    });
  }

  const manifest: Manifest = {
    generated_utc: new Date().toISOString(),
    entries
  };

  const manifestSha256 = createHash("sha256").update(JSON.stringify(manifest), "utf8").digest("hex");
  return { manifest, manifestSha256 };
}

function sha256File(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    const s = fs.createReadStream(absPath);
    s.on("data", d => h.update(d));
    s.on("error", reject);
    s.on("end", () => resolve(h.digest("hex")));
  });
}
