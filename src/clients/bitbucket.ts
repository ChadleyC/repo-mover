import { createRequire } from 'module';
import type { APIClient } from 'bitbucket';
import type { APIClientFactory } from 'bitbucket/lib/bitbucket.js';
import { config } from '../config/index.js';
import { RepositoryMetadata } from '../types/index.js';

const require = createRequire(import.meta.url);
const { Bitbucket } = require('bitbucket') as { Bitbucket: APIClientFactory<APIClient> };

export class BitbucketClient {
  private client: APIClient;

  constructor() {
    const auth = config.bitbucket.email
      ? { username: config.bitbucket.email, password: config.bitbucket.token }
      : { token: config.bitbucket.token };
    this.client = new Bitbucket({ auth });
  }

  /**
   * Fetches all repositories for the configured workspace.
   * Handles pagination to ensure all repositories are retrieved.
   */
  async listRepositories(): Promise<RepositoryMetadata[]> {
    const repositories: RepositoryMetadata[] = [];
    let hasNextPage = true;
    let page = 1;

    while (hasNextPage) {
      const { data } = await this.client.repositories.list({
        workspace: config.bitbucket.workspace,
        page: page.toString(),
        pagelen: 50,
      });

      const pageRepos = (data.values || []).map((repo: any) => ({
        name: repo.slug,
        description: repo.description || '',
        isPrivate: repo.is_private,
        owner: config.bitbucket.workspace,
        cloneUrl: repo.links.clone.find((link: any) => link.name === 'https')?.href || '',
      }));

      repositories.push(...pageRepos);

      if (data.next) {
        page++;
      } else {
        hasNextPage = false;
      }
    }

    return repositories;
  }
}
