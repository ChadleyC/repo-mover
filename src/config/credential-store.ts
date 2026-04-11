import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'fs';
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
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2), 'utf-8');
  chmodSync(CONFIG_FILE, 0o600); // owner read/write only
}
