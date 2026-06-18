## 2024-06-18 - Prevent Token Exposure in Git Process Listings
**Vulnerability:** Git authentication tokens (GitHub and Bitbucket) were embedded directly within remote URLs for git clone, push, and lfs operations. This allows the credentials to be exposed in system process listings (e.g. `ps aux`) while the git commands execute.
**Learning:** `simple-git` auto-escapes URL credentials but passing an embedded URL exposes the credentials at the shell level. Injecting credentials safely requires using the git `credential.helper` inline config and passing the token safely through environment variables (using a bash function with `printf` for interpolation).
**Prevention:** Avoid embedding credentials into Git URLs. Always use `git -c credential.helper=...` and environment variables. When using `simple-git`, use its `config` array option along with `.env()` injection, rather than explicit `'-c'` arguments.

## 2024-06-18 - Prevent Token Exposure in Git Process Listings
**Vulnerability:** Git authentication tokens (GitHub and Bitbucket) were embedded directly within remote URLs for git clone, push, and lfs operations. This allows the credentials to be exposed in system process listings (e.g. `ps aux`) while the git commands execute.
**Learning:** `simple-git` auto-escapes URL credentials but passing an embedded URL exposes the credentials at the shell level. Injecting credentials safely requires using the git `credential.helper` inline config and passing the token safely through environment variables (using a bash function with `printf` for interpolation).
**Prevention:** Avoid embedding credentials into Git URLs. Always use `git -c credential.helper=...` and environment variables. When using `simple-git`, use its `config` array option along with `.env()` injection, rather than explicit `'-c'` arguments.

## 2024-06-18 - Prevent Token Exposure in Git Process Listings
**Vulnerability:** Git authentication tokens (GitHub and Bitbucket) were embedded directly within remote URLs for git clone, push, and lfs operations. This allows the credentials to be exposed in system process listings (e.g. `ps aux`) while the git commands execute.
**Learning:** `simple-git` auto-escapes URL credentials but passing an embedded URL exposes the credentials at the shell level. Injecting credentials safely requires using the git `credential.helper` inline config and passing the token safely through environment variables (using a bash function with `printf` for interpolation).
**Prevention:** Avoid embedding credentials into Git URLs. Always use `git -c credential.helper=...` and environment variables. When using `simple-git`, use its `config` array option along with `.env()` injection, rather than explicit `'-c'` arguments.
