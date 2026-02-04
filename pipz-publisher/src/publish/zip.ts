import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

export async function createBundleZip(
  root: string,
  filesRel: string[],
  outZipAbs: string,
  extraFiles: { absPath: string; zipPath: string }[]
): Promise<void> {
  await fs.promises.mkdir(path.dirname(outZipAbs), { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipAbs);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", reject);

    archive.on("warning", err => reject(err));
    archive.on("error", reject);

    archive.pipe(output);

    for (const rel of filesRel) {
      const abs = path.join(root, rel);
      archive.file(abs, { name: rel.replace(/\\/g, "/") });
    }

    for (const f of extraFiles) {
      archive.file(f.absPath, { name: f.zipPath });
    }

    archive.finalize();
  });
}
