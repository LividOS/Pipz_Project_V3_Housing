import * as fs from "fs-extra";

export async function writeAuditRecord(absPath: string, record: any): Promise<void> {
  await fs.writeJson(absPath, record, { spaces: 2 });
}
