import * as fs from "fs-extra";

export function computeBuildIdUtc(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}-${mi}-${ss}Z`;
}

export async function writeTextFile(p: string, content: string): Promise<void> {
  await fs.writeFile(p, content, { encoding: "utf8" });
}
