import { Octokit } from 'octokit';
import { config } from '../config/index.js';
import { RepositoryMetadata } from '../types/index.js';

export class GithubClient {
  private octokit: Octokit;
  private authenticatedUser: string | null = null;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
  }

  /**
   * Checks if a repository already exists on GitHub.
   * Uses the configured organization or the authenticated user.
   */
  async repositoryExists(name: string): Promise<boolean> {
    try {
      const owner = config.github.org || (await this.getAuthenticatedUser());
      await this.octokit.rest.repos.get({
        owner,
        repo: name,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Creates a new repository on GitHub.
   * If an organization is configured, creates it there; otherwise, creates it for the authenticated user.
   */
  async createRepository(metadata: RepositoryMetadata): Promise<void> {
    const org = config.github.org;
    
    if (org) {
      await this.octokit.rest.repos.createInOrg({
        org,
        name: metadata.name,
        description: metadata.description,
        private: metadata.isPrivate,
      });
    } else {
      await this.octokit.rest.repos.createForAuthenticatedUser({
        name: metadata.name,
        description: metadata.description,
        private: metadata.isPrivate,
      });
    }
  }

  /**
   * Deletes a repository on GitHub.
   */
  async deleteRepository(name: string): Promise<void> {
    const owner = await this.getTargetOwner();
    await this.octokit.rest.repos.delete({
      owner,
      repo: name,
    });
  }

  /**
   * Retrieves the target owner (organization or authenticated user).
   */
  async getTargetOwner(): Promise<string> {
    return config.github.org || (await this.getAuthenticatedUser());
  }

  /**
   * Retrieves the login of the authenticated user.
   */
  private async getAuthenticatedUser(): Promise<string> {
    if (this.authenticatedUser) {
      return this.authenticatedUser;
    }
    const { data } = await this.octokit.rest.users.getAuthenticated();
    this.authenticatedUser = data.login;
    return this.authenticatedUser;
  }
}
