#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import { BitbucketClient } from './clients/bitbucket.js';
import { GithubClient } from './clients/github.js';
import { MetadataService } from './services/metadata.service.js';
import { GitEngineService, LargeFilesError } from './services/git-engine.service.js';
import { CleanupService } from './services/cleanup.service.js';
import { config } from './config/index.js';
import { loadSavedCredentials, saveCredentials } from './config/credential-store.js';
import { UIReporter } from './cli/ui-reporter.js';
import { Prompts } from './cli/prompts.js';

const program = new Command();

/**
 * Ensures all required configuration is present, prompting the user if necessary.
 * Loads previously saved credentials and saves any newly entered ones.
 */
async function ensureConfig(prompts: Prompts, reporter: UIReporter): Promise<void> {
  const saved = loadSavedCredentials();
  let credentialsUpdated = false;

  // Seed config from saved credentials (env vars take precedence if already set)
  if (!config.github.token && saved.github?.token) config.github.token = saved.github.token;
  if (!config.github.org && saved.github?.org) config.github.org = saved.github.org;
  if (!config.bitbucket.token && saved.bitbucket?.token) config.bitbucket.token = saved.bitbucket.token;
  if (!config.bitbucket.workspace && saved.bitbucket?.workspace) config.bitbucket.workspace = saved.bitbucket.workspace;
  if (!config.bitbucket.email && saved.bitbucket?.email) config.bitbucket.email = saved.bitbucket.email;

  reporter.showSection('GitHub Credentials', 1, 2);
  if (!config.github.token) {
    const creds = await prompts.collectGitHubCredentials();
    config.github.token = creds.token;
    config.github.org = creds.org;
    credentialsUpdated = true;
  } else {
    reporter.info(`GitHub: using saved credentials.`);
  }

  reporter.showSection('Bitbucket Credentials', 2, 2);
  if (!config.bitbucket.token || !config.bitbucket.workspace) {
    const creds = await prompts.collectBitbucketCredentials();
    config.bitbucket.token = creds.token;
    config.bitbucket.workspace = creds.workspace;
    config.bitbucket.email = creds.email;
    credentialsUpdated = true;
  } else {
    reporter.info(`Bitbucket: using saved credentials.`);
  }

  if (credentialsUpdated) {
    saveCredentials({
      github: { token: config.github.token, org: config.github.org },
      bitbucket: { token: config.bitbucket.token, workspace: config.bitbucket.workspace, email: config.bitbucket.email },
    });
    reporter.success('Credentials saved to ~/.repo-mover/config.json');
  }
}

program
  .name('repo-mover')
  .description('Migrate repositories from Bitbucket to GitHub')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate selected repositories from the configured Bitbucket workspace to GitHub')
  .option('--yes', 'Skip confirmation prompts', false)
  .action(async (options) => {
    const reporter = new UIReporter();
    const prompts = new Prompts();
    
    try {
      reporter.showWelcomeBanner();

      // Step 1: Ensure configuration is complete
      await ensureConfig(prompts, reporter);

      const github = new GithubClient();
      const cleanup = new CleanupService(config.tempDir, github, reporter);
      const bitbucket = new BitbucketClient();
      const metadataService = new MetadataService();
      const gitEngine = new GitEngineService(config.tempDir);

      reporter.info('Fetching repositories from Bitbucket...');
      const allRepositories = await bitbucket.listRepositories();
      
      if (allRepositories.length === 0) {
        reporter.info('No repositories found in the configured Bitbucket workspace.');
        return;
      }

      // Step 2: Select repositories to migrate
      let repositoriesToMigrate = allRepositories;
      if (!options.yes) {
        repositoriesToMigrate = await prompts.selectRepositories(allRepositories);
      }
      
      if (repositoriesToMigrate.length === 0) {
        reporter.info('No repositories selected for migration.');
        return;
      }

      reporter.info(`Selected ${repositoriesToMigrate.length} repositories for migration.`);

      if (!options.yes) {
        const confirmed = await prompts.confirm(`Do you want to proceed with migrating ${repositoriesToMigrate.length} repositories?`);
        if (!confirmed) {
          reporter.info('Migration cancelled by user.');
          return;
        }
      }

      const targetOwner = await github.getTargetOwner();
      reporter.info(`Target GitHub owner: ${targetOwner}`);

      const lfsAvailable = await GitEngineService.isGitLfsInstalled();
      
      reporter.start(repositoriesToMigrate.length, 'Migrating repositories');

      for (let i = 0; i < repositoriesToMigrate.length; i++) {
        const repo = repositoriesToMigrate[i];
        const githubOptions = metadataService.mapToGithubOptions(repo);
        let repoCreated = false;
        
        try {
          reporter.update(i, `Processing ${repo.name}...`);

          const exists = await github.repositoryExists(githubOptions.name);
          
          if (exists) {
            if (options.yes) {
              reporter.info(`Repository ${githubOptions.name} already exists on GitHub. Skipping.`);
              reporter.increment(`Skipped ${repo.name}`);
              continue;
            }

            const action = await prompts.resolveExistingRepo(githubOptions.name);
            if (action === 'skip') {
              reporter.info(`Skipping ${repo.name}.`);
              reporter.increment(`Skipped ${repo.name}`);
              continue;
            } else if (action === 'abort') {
              reporter.info('Migration aborted by user.');
              break;
            } else if (action === 'delete') {
              reporter.info(`Deleting existing repository ${githubOptions.name}...`);
              await github.deleteRepository(githubOptions.name);
              reporter.success(`Deleted repository ${githubOptions.name}.`);
            }
          }

          await github.createRepository(githubOptions);
          repoCreated = true;
          
          // Construct target URL for GitHub without embedding authentication tokens
          const targetUrl = `https://github.com/${targetOwner}/${githubOptions.name}.git`;
          const onProgress = (msg: string) => reporter.log(chalk.dim(`  ${msg}`));
          
          // Mirror the repository — detects large files before pushing
          try {
            await gitEngine.mirror(repo, targetUrl, config.github.token, config.bitbucket.token, onProgress);
          } catch (err) {
            if (err instanceof LargeFilesError) {
              const { action, selectedFiles } = await prompts.resolveLargeFiles(repo.name, err.files, lfsAvailable);
              if (action === 'lfs') {
                reporter.info(`Migrating ${repo.name} to Git LFS…`);
                await gitEngine.migrateWithLfs(repo, targetUrl, config.github.token, onProgress);
              } else if (action === 'skip') {
                reporter.info(`Skipping ${repo.name} — large files not stripped.`);
                if (repoCreated) await cleanup.rollbackGithubRepo(githubOptions.name);
                await cleanup.clearRepoDir(repo.name);
                reporter.increment(`Skipped ${repo.name}`);
                continue;
              } else if (action === 'select') {
                reporter.info(`Removing ${selectedFiles!.length} selected file(s) from ${repo.name} history…`);
                await gitEngine.stripAndPush(repo, targetUrl, config.github.token, onProgress, selectedFiles);
              } else {
                reporter.info(`Stripping all large files from ${repo.name} history…`);
                await gitEngine.stripAndPush(repo, targetUrl, config.github.token, onProgress);
              }
            } else {
              throw err;
            }
          }
          
          // Clean up the local repo directory after successful migration
          await cleanup.clearRepoDir(repo.name);
          
          reporter.increment(`Successfully migrated ${repo.name}`);
        } catch (error: any) {
          reporter.error(`Failed to migrate ${repo.name}`, error);
          
          // Rollback if repository was created but migration failed
          if (repoCreated) {
            await cleanup.rollbackGithubRepo(githubOptions.name);
          }
          
          // Clean up local repo directory on failure
          await cleanup.clearRepoDir(repo.name);
          
          reporter.increment(`Failed ${repo.name}`);
        }
      }

      reporter.stop('Migration process completed!');
    } catch (error: any) {
      reporter.error('Migration failed', error);
    } finally {
      // Final cleanup of the entire temp directory
      // Note: we can't easily clean up here if we want to support partial re-runs
      // so we rely on the per-repo cleanup and final manual cleanup instructions.
      // await cleanup.clearTempDir();
      prompts.close();
    }
  });

// Global error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  process.exit(1);
});

program.parse();
