import fs from 'fs/promises';
import path from 'path';
import { GithubClient } from '../clients/github.js';
import { UIReporter } from '../cli/ui-reporter.js';

export class CleanupService {
  private tempDir: string;
  private githubClient: GithubClient;
  private reporter: UIReporter;

  constructor(tempDir: string, githubClient: GithubClient, reporter: UIReporter) {
    this.tempDir = tempDir;
    this.githubClient = githubClient;
    this.reporter = reporter;
  }

  /**
   * Deletes the local temporary directory used for cloning.
   */
  async clearTempDir(): Promise<void> {
    try {
      const exists = await fs.access(this.tempDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        this.reporter.success(`Cleaned up temporary directory: ${this.tempDir}`);
      }
    } catch (error: any) {
      this.reporter.error(`Failed to clean up temporary directory: ${this.tempDir}`, error);
    }
  }

  /**
   * Deletes a specific repository directory within the temp directory.
   */
  async clearRepoDir(repoName: string): Promise<void> {
    const repoDir = path.join(this.tempDir, `${repoName}.git`);
    try {
      const exists = await fs.access(repoDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(repoDir, { recursive: true, force: true });
      }
    } catch (error: any) {
      this.reporter.error(`Failed to clean up repository directory: ${repoDir}`, error);
    }
  }

  /**
   * Deletes a GitHub repository if a migration step fails.
   */
  async rollbackGithubRepo(repoName: string): Promise<void> {
    try {
      this.reporter.info(`Rolling back: Deleting GitHub repository ${repoName}...`);
      await this.githubClient.deleteRepository(repoName);
      this.reporter.success(`Successfully rolled back GitHub repository ${repoName}.`);
    } catch (error: any) {
      this.reporter.error(`Failed to rollback GitHub repository ${repoName}`, error);
    }
  }
}
