# Repo Mover

A CLI tool to migrate repositories from Bitbucket to GitHub with ease. It performs a full mirror migration, preserving all branches and tags.

## Features

- 🚀 **Automated Migration**: Fetches all repositories from a Bitbucket workspace and migrates them to GitHub.
- 🔄 **Mirror Migration**: Uses `git clone --mirror` and `git push --mirror` to ensure all history, branches, and tags are preserved.
- 🛠️ **Conflict Resolution**: Detects existing repositories on GitHub and offers options to skip, overwrite, or abort.
- 🧹 **Automatic Cleanup**: Cleans up temporary local files after each migration and on completion.
- 🛡️ **Robust Error Handling**: Rollback mechanism to delete partially migrated GitHub repositories on failure.
- 📊 **Progress Tracking**: Real-time progress bar and detailed status reporting.

## Prerequisites

- **Node.js**: v18 or higher.
- **Git**: Installed and configured in your PATH.
- **Bitbucket App Password**: With `Repository: Read` permissions.
- **GitHub Personal Access Token (PAT)**: With `repo` and `delete_repo` (if rollback/overwrite is needed) permissions.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-org/repo-mover.git
   cd repo-mover
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Create a `.env` file in the root directory (you can use `.env.example` as a template):

```env
BITBUCKET_TOKEN=your_bitbucket_app_password
BITBUCKET_WORKSPACE=your_bitbucket_workspace_slug

GITHUB_TOKEN=your_github_pat
GITHUB_ORG=your_github_org_name (optional, defaults to authenticated user)

TEMP_DIR=./temp_migration
```

## Usage

To start the migration process:

```bash
npm start migrate
```

### Options

- `--yes`: Skip all confirmation prompts and use default actions (skips existing repositories).

```bash
npm start migrate -- --yes
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

MIT
