## 2024-04-15 - Command Injection in Git Filter-Branch
**Vulnerability:** Unsanitized filenames were interpolated into a shell command string using double quotes within `git filter-branch`.
**Learning:** `git filter-branch` evaluates commands using `eval` in bash. When variables like filenames are enclosed in double quotes, the shell processes metacharacters (e.g., `$()`, \` \`) before passing them to the command, leading to potential arbitrary command execution if a repository contains maliciously named files.
**Prevention:** Always enclose dynamically evaluated shell inputs (like filenames) in single quotes (`'`) to prevent shell expansion, and ensure inner single quotes are properly escaped using the POSIX `'\''` pattern.
