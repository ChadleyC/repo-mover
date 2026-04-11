import { RepositoryMetadata } from '../types/index.js';

export class MetadataService {
  /**
   * Maps Bitbucket repository metadata to GitHub repository creation options.
   * Ensures the repository name is compatible with GitHub's naming conventions.
   * GitHub repository names can only contain alphanumeric characters, hyphens, underscores, and periods.
   */
  mapToGithubOptions(metadata: RepositoryMetadata): RepositoryMetadata {
    const sanitizedName = metadata.name
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase();

    return {
      ...metadata,
      name: sanitizedName,
      description: metadata.description || '',
    };
  }

  /**
   * Compares Bitbucket and GitHub metadata to determine if they are equivalent.
   * Useful for verifying migration or checking for existing repositories.
   */
  isEquivalent(bitbucketMetadata: RepositoryMetadata, githubMetadata: RepositoryMetadata): boolean {
    return (
      bitbucketMetadata.name.toLowerCase() === githubMetadata.name.toLowerCase() &&
      bitbucketMetadata.isPrivate === githubMetadata.isPrivate
    );
  }
}
