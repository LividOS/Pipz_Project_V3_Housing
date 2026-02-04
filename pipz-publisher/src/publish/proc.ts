import { spawn } from "child_process";

export type CmdResult = { code: number; stdout: string; stderr: string };

export function execCmd(cwd: string, cmd: string, args: string[]): Promise<CmdResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", d => (stdout += d.toString()));
    p.stderr.on("data", d => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", code => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function execCmdOrThrow(cwd: string, cmd: string, args: string[]): Promise<CmdResult> {
  const res = await execCmd(cwd, cmd, args);
  if (res.code !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${res.stderr || res.stdout}`.trim());
  }
  return res;
}
