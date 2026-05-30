import { step } from '@vcs-pw/test';
import { exec, ExecException, ExecOptions } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function isExecError(err: unknown): err is ExecException & {
  stdout?: Buffer | string;
  stderr?: Buffer | string;
} {
  return typeof err === 'object' && err !== null && ('code' in err || 'stdout' in err || 'stderr' in err);
}

export default class ExecRunner {
  async run(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    return await step(`CLI: Выполнение команды ${command}`, async () => {
      try {
        const { stdout, stderr } = await execAsync(command, options);
        return {
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: 0,
        };
      } catch (err: unknown) {
        if (isExecError(err)) {
          return {
            stdout: err.stdout?.toString() ?? '',
            stderr: err.stderr?.toString() ?? String(err),
            exitCode: typeof err.code === 'number' ? err.code : 1,
          };
        } else {
          return {
            stdout: '',
            stderr: `Unknown error: ${String(err)}`,
            exitCode: 1,
          };
        }
      }
    });
  }
}
