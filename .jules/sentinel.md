## 2024-04-24 - Command Injection in Git Filter Branch

**Vulnerability:** Command and option injection was possible in `git-engine.service.ts` because repository file names were passed dynamically into a shell command for `git filter-branch --index-filter` using double quotes (`"..."`). This allows internal execution of commands like `$()` or option injection if a file starts with `--`.
**Learning:** Double quotes do not prevent the shell from evaluating variables and command substitutions. Building shell commands with unsanitized user input is extremely dangerous, even in a locally executed migration script, if the input includes unexpected shell characters.
**Prevention:** Always use single quotes (`'...'`) when passing file names to shell commands, safely escape internal single quotes by replacing them with `'\''`, and use `--` to indicate the end of options before passing file paths (e.g., `git rm --cached --ignore-unmatch -- 'filename'`).
