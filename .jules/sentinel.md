## 2025-06-15 - [CRITICAL] Prevent Token Exposure in Git Remote URLs

**Vulnerability:** Git authentication tokens (e.g., GitHub/Bitbucket tokens) were being embedded directly into Git remote URLs (e.g., `https://x-access-token:${token}@github.com...`). This is a critical security vulnerability as it exposes the tokens in Git configuration, command-line arguments (visible in process lists like `ps aux`), and potentially CI/CD logs.
**Learning:** `simple-git` provides a secure way to handle authentication by using inline configuration for the credential helper. The helper can read tokens from environment variables, which keeps them out of the process list and logs.
**Prevention:** Always use environment variables combined with a custom Git `credential.helper` inline configuration (e.g., `credential.helper=!f() { echo "username=x-access-token"; printf "password=%s\n" "$GIT_GITHUB_TOKEN"; }; f`) for Git operations requiring authentication, rather than embedding tokens in remote URLs.
