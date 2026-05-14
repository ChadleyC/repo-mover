## 2024-05-14 - Prevent Credential Exposure in Process Lists
**Vulnerability:** Credentials (API tokens) injected directly into Git remote URLs were exposed in process lists (`ps aux`), shell histories, and git trace logs.
**Learning:** Using `simple-git` or native `spawn` with credential URLs (`https://token@host`) is a critical security vulnerability. Overriding the built-in `credential.helper` is the correct, secure approach for programmatic authentication.
**Prevention:** Avoid embedding tokens in URLs. Always securely pass tokens via environment variables (`GIT_TARGET_TOKEN`) and inject them into Git operations using a temporary `credential.helper` shell function: `-c 'credential.helper=!f() { echo "username=x-access-token"; echo "password=$GIT_TARGET_TOKEN"; }; f'`.
