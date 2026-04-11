import inquirer from 'inquirer';
import chalk from 'chalk';
import { RepositoryMetadata, GitHubCredentials, BitbucketCredentials } from '../types/index.js';

export class Prompts {
  /**
   * Asks a yes/no question to the user.
   */
  async confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.yellow(`\n❓ ${message}`),
        default: defaultValue,
      },
    ]);
    return confirmed;
  }

  /**
   * Asks the user for a text input.
   */
  async askForInput(message: string, isPassword: boolean = false): Promise<string> {
    const { input } = await inquirer.prompt([
      {
        type: isPassword ? 'password' : 'input',
        name: 'input',
        message: chalk.yellow(`\n❓ ${message}`),
        mask: isPassword ? '*' : undefined,
      },
    ]);
    return input;
  }

  /**
   * Asks the user to select repositories from a list.
   */
  async selectRepositories(repos: RepositoryMetadata[]): Promise<RepositoryMetadata[]> {
    const { selectedRepos } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedRepos',
        message: chalk.yellow('\n❓ Select repositories to migrate:'),
        choices: repos.map((repo) => ({
          name: `${repo.name} (${repo.isPrivate ? 'private' : 'public'})`,
          value: repo,
        })),
        validate: (answer: RepositoryMetadata[]) => {
          if (answer.length < 1) {
            return 'You must choose at least one repository.';
          }
          return true;
        },
      },
    ]);
    return selectedRepos;
  }

  /**
   * Asks the user to choose an action for an existing repository.
   */
  async resolveExistingRepo(repoName: string): Promise<'skip' | 'delete' | 'abort'> {
    const { action } = await inquirer.prompt([
      {
        type: 'select',
        name: 'action',
        message: chalk.yellow(`\n❓ Repository ${repoName} already exists on GitHub. What would you like to do?`),
        choices: [
          { name: 'Skip this repository', value: 'skip' },
          { name: 'Delete existing repository and recreate', value: 'delete' },
          { name: 'Abort migration', value: 'abort' },
        ],
      },
    ]);
    return action;
  }

  /**
   * Closes the prompts (no-op for inquirer but kept for interface compatibility).
   */
  close(): void {
    // Inquirer doesn't need explicit closing like readline
  }

  /**
   * Prompts for GitHub credentials, validates via API, and returns the token and optional org.
   */
  async collectGitHubCredentials(): Promise<GitHubCredentials> {
    while (true) {
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: chalk.yellow('\n❓ GitHub Personal Access Token:'),
          mask: '*',
        },
      ]);

      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'repo-mover',
          },
        });

        if (!response.ok) {
          console.log(chalk.red(`✖ Authentication failed (HTTP ${response.status}). Please try again.`));
          continue;
        }

        const user = (await response.json()) as { login: string };
        console.log(chalk.green(`✔ Authenticated as: ${user.login}`));

        const { org } = await inquirer.prompt([
          {
            type: 'input',
            name: 'org',
            message: chalk.yellow('\n❓ GitHub Organization (leave blank to migrate to your personal account):'),
          },
        ]);

        return { token, org: org.trim() || undefined };
      } catch {
        console.log(chalk.red('✖ Network error contacting GitHub. Please check your connection and try again.'));
      }
    }
  }

  /**
   * Prompts for Bitbucket credentials using API tokens (replacement for App Passwords).
   * Uses Basic auth with Atlassian account email + API token.
   */
  async collectBitbucketCredentials(): Promise<BitbucketCredentials> {
    console.log(chalk.dim('\n  ℹ  Create a Bitbucket API token (replacement for App Passwords):'));
    console.log(chalk.dim('     bitbucket.org/account/settings/api-tokens/  →  Create API token'));
    console.log(chalk.dim('     Required scope: Repositories → Read'));
    console.log(chalk.dim('     Your Atlassian email: bitbucket.org/account/settings/email/\n'));

    while (true) {
      const { email } = await inquirer.prompt([{
        type: 'input',
        name: 'email',
        message: chalk.yellow('❓ Atlassian account email:'),
      }]);

      const { token } = await inquirer.prompt([{
        type: 'password',
        name: 'token',
        message: chalk.yellow('\n❓ Bitbucket API Token:'),
        mask: '*',
      }]);

      const { workspace } = await inquirer.prompt([{
        type: 'input',
        name: 'workspace',
        message: chalk.yellow('\n❓ Bitbucket Workspace ID (the slug from bitbucket.org/{workspace-id}/):'),
      }]);

      try {
        const authHeader = `Basic ${Buffer.from(`${email.trim()}:${token}`).toString('base64')}`;
        const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${workspace.trim()}?pagelen=1`, {
          headers: { Authorization: authHeader, 'User-Agent': 'repo-mover' },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
          const reason = body?.error?.message || `HTTP ${response.status}`;
          console.log(chalk.red(`\n✖ ${reason}\n`));
          continue;
        }

        const result = (await response.json()) as { size: number };
        console.log(chalk.green(`✔ Connected to workspace: ${workspace.trim()} (${result.size} repositor${result.size === 1 ? 'y' : 'ies'} found)`));

        return { token, workspace: workspace.trim(), email: email.trim() };
      } catch {
        console.log(chalk.red('✖ Network error contacting Bitbucket. Please check your connection and try again.\n'));
      }
    }
  }

  /**
   * Informs the user that large files were found and asks how to proceed.
   * Returns 'strip' to rewrite history removing them, or 'skip' to skip the repo.
   */
  async resolveLargeFiles(repoName: string, files: string[], lfsAvailable: boolean): Promise<{ action: 'lfs' | 'strip' | 'select' | 'skip'; selectedFiles?: string[] }> {
    console.log(chalk.yellow(`\n⚠  ${repoName} contains ${files.length} file(s) exceeding GitHub's 100MB limit:`));
    files.slice(0, 10).forEach(f => console.log(chalk.dim(`   • ${f}`)));
    if (files.length > 10) {
      console.log(chalk.dim(`   … and ${files.length - 10} more`));
    }

    const lfsChoice = lfsAvailable
      ? { name: 'Migrate to Git LFS  (preserves files, rewrites history)', value: 'lfs' }
      : { name: 'Migrate to Git LFS  (preserves files, rewrites history)', value: 'lfs', disabled: 'requires git-lfs — brew install git-lfs' };

    const { action } = await inquirer.prompt([{
      type: 'select',
      name: 'action',
      message: chalk.yellow('How would you like to proceed?'),
      choices: [
        lfsChoice,
        { name: 'Remove specific files from history  (choose which ones)', value: 'select' },
        { name: 'Remove all large files from history  (files removed permanently)', value: 'strip' },
        { name: 'Skip this repository', value: 'skip' },
      ],
    }]);

    if (action === 'select') {
      const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: chalk.yellow('Select files to remove from history:'),
        choices: files.map(f => ({ name: f, value: f, checked: true })),
        validate: (chosen: string[]) => chosen.length > 0 || 'Select at least one file.',
      }]);

      const remaining = files.filter(f => !selectedFiles.includes(f));
      if (remaining.length > 0) {
        console.log(chalk.yellow(`\n⚠  ${remaining.length} large file(s) will remain — the push may still fail unless you also migrate them to LFS.`));
      }

      return { action: 'select', selectedFiles };
    }

    return { action: action as 'lfs' | 'strip' | 'skip' };
  }
}
