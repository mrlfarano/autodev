import { execSync } from "node:child_process";

export function runHardGate(commands, cwd) {
  const outputs = [];
  const t0 = performance.now();

  for (const cmd of commands) {
    try {
      const stdout = execSync(cmd, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300_000,
      });
      outputs.push({ command: cmd, stdout, exitCode: 0 });
    } catch (err) {
      const exitCode = err.status ?? 1;
      outputs.push({ command: cmd, stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode });
      return {
        passed: false,
        error: `"${cmd}" exited with code ${exitCode}`,
        outputs,
        buildSeconds: (performance.now() - t0) / 1000,
      };
    }
  }

  return {
    passed: true,
    error: null,
    outputs,
    buildSeconds: (performance.now() - t0) / 1000,
  };
}

export function findOutput(gateResult, commandSubstring) {
  return gateResult.outputs.find((o) => o.command.includes(commandSubstring));
}
