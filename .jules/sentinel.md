## 2024-05-18 - Command and Option Injection in `git filter-branch`
**Vulnerability:** Constructing a shell command with user input inside double quotes allows shell variable expansion and command substitution. Also, files starting with `-` could be passed to `git rm` as unintended options, causing option injection.
**Learning:** Shell interpreters interpolate values inside double quotes before execution. Option parsers may treat arguments with leading dashes as flags unless explicitly told not to.
**Prevention:** Always enclose user-provided data in single quotes, safely escaping any internal single quotes (e.g. `f.replace(/'/g, "'\\''")`). Use `--` before passing variable filenames to commands to prevent option injection.
