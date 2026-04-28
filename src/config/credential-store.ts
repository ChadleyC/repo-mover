import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface SavedCredentials {
  github?: { token: string; org?: string };
  bitbucket?: { token: string; workspace: string; email?: string };
}

const CONFIG_DIR = join(homedir(), '.repo-mover');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadSavedCredentials(): SavedCredentials {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as SavedCredentials;
  } catch {
    return {};
  }
}

export function saveCredentials(creds: SavedCredentials): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2), { encoding: 'utf-8', mode: 0o600 });
}
