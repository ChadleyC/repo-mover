## 2024-05-30 - Command Injection in Git Filter-Branch
**Vulnerability:** The `git-engine.service.ts` constructed a shell command string for `git filter-branch` using double quotes and directly interpolating user-provided filenames, making it vulnerable to command and option injection.
**Learning:** Shell evaluation inside `git filter-branch` requires strict quoting. Even if child_process.spawn handles array arguments safely, string-based sub-commands executed by a shell inside the spawned process are vulnerable.
**Prevention:** Always enclose dynamically injected filenames in single quotes, properly escape any internal single quotes as `'\''`, and use `--` to indicate the end of command options.
