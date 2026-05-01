import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { simpleGit, SimpleGitOptions } from 'simple-git';
import { RepositoryMetadata } from '../types/index.js';

const execFileAsync = promisify(execFile);

const GITHUB_MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;
const GITHUB_MAX_FILE_SIZE_STR = '95mb';

const BASE_GIT_OPTIONS: Partial<SimpleGitOptions> = {
  timeout: { block: 120000 },
};

const GIT_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: 'echo',
};

export type ProgressCallback = (message: string) => void;

export class LargeFilesError extends Error {
  constructor(public readonly files: string[]) {
    super(`Repository contains ${files.length} file(s) exceeding GitHub's 100MB limit`);
    this.name = 'LargeFilesError';
  }
}

export class GitEngineService {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  static async isGitLfsInstalled(): Promise<boolean> {
    try {
      // Use 'which' to find git-lfs directly — avoids PATH differences in git subcommand lookup
      await execFileAsync('which', ['git-lfs']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clones from Bitbucket and pushes to GitHub.
   * Fires onProgress with git stage updates. Throws LargeFilesError if oversized files exist.
   */
  async mirror(
    source: RepositoryMetadata,
    targetUrl: string,
    sourceToken: string,
    onProgress?: ProgressCallback,
    targetToken?: string,
  ): Promise<void> {
    const repoDir = path.join(this.tempDir, `${source.name}.git`);
    await fs.mkdir(this.tempDir, { recursive: true });

    onProgress?.(`[${source.name}] Starting clone from Bitbucket…`);
    const cloneGit = simpleGit({
      ...BASE_GIT_OPTIONS,
      config: [
        'credential.helper=!f() { echo password=$SOURCE_TOKEN; echo username=x-bitbucket-api-token-auth; }; f'
      ],
      progress({ method, stage, progress, processed, total }) {
        const count = total ? ` (${processed}/${total})` : '';
        onProgress?.(`[${source.name}] ${method}: ${stage} ${progress}%${count}`);
      },
    }).env({ ...GIT_ENV, SOURCE_TOKEN: sourceToken });

    await cloneGit.clone(source.cloneUrl, repoDir, ['--mirror', '--progress']);

    onProgress?.(`[${source.name}] Scanning for large files…`);
    const largeFiles = await this.findLargeBlobs(repoDir);
    if (largeFiles.length > 0) {
      throw new LargeFilesError(largeFiles);
    }

    onProgress?.(`[${source.name}] Pushing to GitHub…`);
    await this.push(repoDir, targetUrl, source.name, onProgress, targetToken);
  }

  /**
   * Migrates large files to Git LFS, rewrites history, then pushes refs + LFS objects.
   */
  async migrateWithLfs(
    source: RepositoryMetadata,
    targetUrl: string,
    onProgress?: ProgressCallback,
    targetToken?: string,
  ): Promise<void> {
    const repoDir = path.join(this.tempDir, `${source.name}.git`);
    const label = `[${source.name}]`;

    onProgress?.(`${label} Migrating large files to LFS (rewriting history)…`);
    await this.spawnWithProgress(
      'git', ['lfs', 'migrate', 'import', '--everything', `--above=${GITHUB_MAX_FILE_SIZE_STR}`],
      repoDir, onProgress, label, 1_800_000,
    );

    onProgress?.(`${label} Pushing git history to GitHub…`);
    await this.push(repoDir, targetUrl, source.name, onProgress, targetToken);

    onProgress?.(`${label} Pushing LFS objects to GitHub…`);
    await this.spawnWithProgress(
      'git', ['-c', 'credential.helper=!f() { echo password=$GITHUB_TOKEN; echo username=x-access-token; }; f', 'lfs', 'push', '--all', targetUrl],
      repoDir, onProgress, label, 1_800_000, { GITHUB_TOKEN: targetToken ?? '' }
    );
  }

  /**
   * Strips large files from history then pushes. Call after catching LargeFilesError.
   * Pass filesToStrip to remove only specific files; omit to remove all large files.
   */
  async stripAndPush(
    source: RepositoryMetadata,
    targetUrl: string,
    onProgress?: ProgressCallback,
    filesToStrip?: string[],
    targetToken?: string,
  ): Promise<void> {
    const repoDir = path.join(this.tempDir, `${source.name}.git`);
    await this.stripLargeFiles(repoDir, source.name, onProgress, filesToStrip);

    onProgress?.(`[${source.name}] Pushing to GitHub…`);
    await this.push(repoDir, targetUrl, source.name, onProgress, targetToken);
  }

  async findLargeBlobs(repoDir: string): Promise<string[]> {
    const git = simpleGit({ ...BASE_GIT_OPTIONS, baseDir: repoDir }).env(GIT_ENV);

    const allObjects = await git.raw([
      'cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize)', '--batch-all-objects',
    ]);

    const largeHashes = new Set<string>();
    for (const line of allObjects.split('\n')) {
      const parts = line.trim().split(' ');
      if (parts[0] === 'blob' && parseInt(parts[2], 10) > GITHUB_MAX_FILE_SIZE_BYTES) {
        largeHashes.add(parts[1]);
      }
    }

    if (largeHashes.size === 0) return [];

    const revList = await git.raw(['rev-list', '--objects', '-z', '--all']);
    const largePaths = new Set<string>();
    for (const line of revList.split('\0')) {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx === -1) continue;
      const hash = line.slice(0, spaceIdx);
      const filePath = line.slice(spaceIdx + 1);
      if (filePath && largeHashes.has(hash)) {
        largePaths.add(filePath);
      }
    }

    return [...largePaths];
  }

  private async stripLargeFiles(
    repoDir: string,
    repoName: string,
    onProgress?: ProgressCallback,
    filesToStrip?: string[],
  ): Promise<void> {
    const largeFiles = filesToStrip ?? await this.findLargeBlobs(repoDir);
    if (largeFiles.length === 0) return;

    onProgress?.(`[${repoName}] Rewriting history — this may take a few minutes…`);

    const git = simpleGit({ ...BASE_GIT_OPTIONS, baseDir: repoDir }).env({
      ...GIT_ENV,
      FILTER_BRANCH_SQUELCH_WARNING: '1',
    });

    // Security: Prevent command and option injection when dynamically constructing shell commands.
    // User-provided paths are enclosed in single quotes, safely escape internal single quotes, and prefixed with '--'.
    const rmCommand = largeFiles
      .map(f => `git rm --cached --ignore-unmatch -- '${f.replace(/'/g, "'\\''")}'`)
      .join('; ');

    await git.raw([
      'filter-branch', '--force',
      '--index-filter', rmCommand,
      '--prune-empty',
      '--tag-name-filter', 'cat',
      '--', '--all',
    ]);

    onProgress?.(`[${repoName}] Cleaning up backup refs…`);
    const backupRefs = await git.raw(['for-each-ref', '--format=delete %(refname)', 'refs/original']);
    if (backupRefs.trim()) {
      const refs = backupRefs.trim().split('\n')
        .map(line => line.replace('delete ', '').trim())
        .filter(Boolean);
      for (const ref of refs) {
        await git.raw(['update-ref', '-d', ref]).catch(() => {});
      }
    }

    onProgress?.(`[${repoName}] Running garbage collection…`);
    await git.raw(['reflog', 'expire', '--expire=now', '--all']);
    await git.raw(['gc', '--prune=now', '--quiet']);
  }

  private async push(
    repoDir: string,
    targetUrl: string,
    repoName: string,
    onProgress?: ProgressCallback,
    targetToken?: string,
  ): Promise<void> {
    const pushGit = simpleGit({
      ...BASE_GIT_OPTIONS,
      baseDir: repoDir,
      config: [
        'credential.helper=!f() { echo password=$TARGET_TOKEN; echo username=x-access-token; }; f'
      ],
      progress({ method, stage, progress, processed, total }) {
        const count = total ? ` (${processed}/${total})` : '';
        onProgress?.(`[${repoName}] ${method}: ${stage} ${progress}%${count}`);
      },
    }).env({ ...GIT_ENV, TARGET_TOKEN: targetToken ?? '' });

    await pushGit.push(['--mirror', '--progress', targetUrl]);
  }

  /** Spawns a command and streams its stderr output through onProgress. */
  private spawnWithProgress(
    cmd: string,
    args: string[],
    cwd: string,
    onProgress?: ProgressCallback,
    label = '',
    timeoutMs = 120_000,
    extraEnv: Record<string, string> = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...GIT_ENV, ...extraEnv },
      });

      let stderrBuf = '';
      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        stderrBuf += text;
        if (onProgress) {
          text.split('\n').forEach(line => {
            if (line.trim()) onProgress(`${label} ${line.trim()}`);
          });
        }
      };

      proc.stdout.on('data', handleOutput);
      proc.stderr.on('data', handleOutput);

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      proc.on('close', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`${cmd} ${args[0]} failed (exit ${code}): ${stderrBuf.slice(-500)}`));
      });

      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

}
