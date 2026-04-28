export interface RepositoryMetadata {
  name: string;
  description?: string;
  isPrivate: boolean;
  owner: string;
  cloneUrl: string;
}

export interface BitbucketConfig {
  token: string;
  workspace: string;
  email?: string;
}

export interface GithubConfig {
  token: string;
  org?: string;
}

export interface AppConfig {
  bitbucket: BitbucketConfig;
  github: GithubConfig;
  tempDir: string;
}

export interface GitHubCredentials {
  token: string;
  org?: string;
}

export interface BitbucketCredentials {
  token: string;
  workspace: string;
  email?: string;
}
