## 2024-05-24 - [CRITICAL] Fix command injection in git filter-branch

**Vulnerability:** User-controlled repository file paths (`largeFiles`) were being dynamically interpolated directly into a `git rm` command passed to `git filter-branch --index-filter`. Since the application does not inherently restrict filenames in the source repository from containing shell metacharacters (e.g., `;`, `&`, `|`, `$`), a malicious Bitbucket repository could include a file named, for example, `large_file; touch /tmp/pwned` that, when processed, would break out of the intended `git rm` shell context and execute arbitrary system commands within the sandbox environment.

**Learning:** When generating shell scripts dynamically—even for internal use within specialized commands like `filter-branch --index-filter` which executes via an internal `/bin/sh -c`—data must be treated as untrusted input. Standard Node.js mitigations like using `child_process.execFile` or array-based argument passing in `spawn` do not protect against injection vulnerabilities that occur *within* the dynamically constructed string executed by the secondary shell.

**Prevention:** To prevent command and option injection when dynamically constructing shell commands for `git filter-branch`:
1.  **Enclose user-provided paths in single quotes (`'`).** Single quotes in bash ensure that no interpolation or evaluation occurs within the string.
2.  **Safely escape internal single quotes.** Because bash does not allow escaping a single quote within a single-quoted string, any internal single quote must be replaced with the sequence `'\''` (close quote, escaped quote, open quote).
3.  **Prefix paths with `--`.** Use the end-of-options marker (`--`) immediately before the interpolated path to prevent git (or other commands) from misinterpreting a filename starting with a hyphen (e.g., `-rf`) as a command-line flag.

## 2024-05-24 - [CRITICAL] Fix embedded credentials in process lists

**Vulnerability:** Git authentication tokens (GitHub/Bitbucket) were being embedded directly into clone/push URLs (e.g. `https://x-access-token:${token}@github.com/...`). These URLs are passed as arguments to spawned `git` child processes. On Linux systems, command-line arguments of running processes are visible to any user via `ps aux` or similar tools, exposing the raw authentication tokens.

**Learning:** When invoking external processes (like git) that require authentication, never pass secrets in command-line arguments or URLs. The process arguments are globally visible on the system and often logged in debug output.

**Prevention:** Pass credentials via environment variables and use configuration options (like Git's credential helper: `git -c credential.helper=...`) that read from those environment variables to securely supply the credentials to the external process.