## 2024-04-17 - Command Injection in Git Filter-Branch

**Vulnerability:** Command injection in `GitEngineService.stripLargeFiles`. The filenames extracted from `git cat-file` were concatenated into a `git rm` bash command that was passed to `git filter-branch --index-filter`. Since the strings were only sanitized for double-quotes `f.replace(/"/g, '\\"')`, an attacker who managed to commit a file with `$()` or backticks or semicolons could execute arbitrary commands in the context of the user running `repo-mover`.

**Learning:** Shell-escaping strings correctly is extremely tricky and relying on double quotes is insufficient as bash still expands `$()` and backticks within double-quoted strings. Passing dynamically-constructed scripts via string concatenation into `bash -c` or similar functions (such as the `index-filter` argument of `filter-branch`) is high risk.

**Prevention:** To prevent command injection in bash scripts constructed via strings, variables should be enclosed in single quotes `''`, with any embedded single quotes properly escaped as `'\''`. Additionally, command-line flags should be terminated with `--` before injecting variable arguments to avoid option injection (e.g. filenames starting with `-`).
