import dotenv from 'dotenv';
import { AppConfig } from '../types/index.js';

dotenv.config();

/**
 * Gets an environment variable or returns undefined if not found.
 * Relaxed to allow interactive prompts to fill in missing values later.
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export const config: AppConfig = {
  bitbucket: {
    token: getEnv('BITBUCKET_TOKEN') as string,
    workspace: getEnv('BITBUCKET_WORKSPACE') as string,
  },
  github: {
    token: getEnv('GITHUB_TOKEN') as string,
    org: process.env.GITHUB_ORG,
  },
  tempDir: getEnv('TEMP_DIR', './temp-repos') as string,
};
