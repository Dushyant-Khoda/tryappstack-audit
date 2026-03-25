# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in `tryappstack-audit`, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email: Contact via [GitHub](https://github.com/Dushyant-Khoda/tryappstack-audit) directly or open a [private security advisory](https://github.com/Dushyant-Khoda/tryappstack-audit/security/advisories/new).

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgement:** Within 48 hours
- **Assessment:** Within 7 days
- **Fix & Release:** Within 30 days depending on severity

## Security Notes

- `tryappstack-audit` runs **locally** — no source code is ever transmitted externally
- When using AI features (`--ai`), only audit **scores and issue names** are sent to the AI provider — never your source code
- API keys are stored locally in `~/.tryappstack/config` with `chmod 600` permissions
- The tool does not make any network requests unless explicitly using `--ai`
