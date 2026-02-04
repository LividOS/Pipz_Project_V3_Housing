import fg from "fast-glob";

export async function collectFiles(root: string, allowlist: string[], exclude: string[]): Promise<string[]> {
  const entries = await fg(allowlist, {
    cwd: root,
    dot: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: exclude
  });

  entries.sort((a, b) => a.localeCompare(b));
  return entries;
}
