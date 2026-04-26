## 2025-02-28 - Command Injection in Git Filter-Branch and Race Condition in Credential File Creation
**Vulnerability:**
1. Command injection in `git-engine.service.ts`: Shell commands passed to `git filter-branch --index-filter` were vulnerable to injection because user-provided filepaths were wrapped in double quotes. A path containing `"; malicious_command; #"` could break out of the string and execute arbitrary shell commands. Additionally, `rev-list` parsed objects splitting by `\n` which could break if filenames had newlines.
2. File permission race condition in `credential-store.ts`: The file holding API tokens was written without a mode set and then `chmodSync` was applied *after* writing. This left a tiny race window where the file was readable to others. Also, `mkdirSync` was called without a restricted mode for the config folder.

**Learning:**
1. `git filter-branch --index-filter` executes the string passed to it in a shell. Any user input (like filenames from `git cat-file`) embedded in the command string must be meticulously escaped, using single quotes and escaping internal single quotes, as well as passing `--` before the filename to prevent option injection. It's safer to avoid shell-evaluated filters if possible, but if needed, extreme escaping is required.
2. Modifying file modes after creation (`chmodSync` after `writeFileSync`) creates a brief "Time of Check to Time of Use" (TOCTOU) race condition window where an attacker might read the secret data.

**Prevention:**
1. In `git filter-branch`, always wrap dynamically inserted filepaths in single quotes (`'`), escape internal single quotes as `'\''`, and use `--` to indicate the end of options (e.g. `git rm --cached --ignore-unmatch -- 'filename'`). For parsing git output containing paths, always use null-terminated output (`-z`) and split by `\0` to handle newlines correctly.
2. Pass the desired secure permissions directly via the `mode` option in `mkdirSync(..., { mode: 0o700 })` and `writeFileSync(..., ..., { mode: 0o600 })` to ensure the file/directory is created safely from the start.
