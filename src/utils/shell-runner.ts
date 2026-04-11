import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface ShellResult {
  stdout: string;
  stderr: string;
}

export class ShellRunner {
  /**
   * Executes a shell command and returns the output.
   * @param command The shell command to execute.
   * @param options Optional execution options (e.g., cwd).
   * @returns A promise that resolves with the stdout and stderr.
   */
  async run(command: string, options: { cwd?: string } = {}): Promise<ShellResult> {
    try {
      const { stdout, stderr } = await execPromise(command, options);
      return { stdout, stderr };
    } catch (error: any) {
      const errorMessage = error.stderr || error.message;
      throw new Error(`Command failed: ${command}\nError: ${errorMessage}`);
    }
  }
}
