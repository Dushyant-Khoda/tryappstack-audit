# Contributing to TryAppStack Audit

Thanks for your interest. Here's how to contribute.

## Project Structure

```
tryappstack-audit/
├── bin/cli.js              # CLI entry (commander + figlet banner)
├── lib/
│   ├── constants.js        # All user-facing strings
│   ├── commands/           # One file per command (lazy-required)
│   │   ├── audit.js        # Main audit (delegates to bash/JS engine)
│   │   ├── init.js         # Setup config + hooks
│   │   ├── hook.js         # Git pre-push hook
│   │   ├── aiSetup.js      # AI agent configuration
│   │   ├── fix.js          # Auto-fix safe issues
│   │   ├── doctor.js       # System check
│   │   ├── trend.js        # Score history
│   │   ├── watch.js        # File watcher
│   │   ├── compare.js      # Report diff
│   │   └── badge.js        # README badge
│   ├── core/               # Bash engine + bash utilities
│   │   ├── engine.sh       # Main orchestrator
│   │   ├── jsEngine.js     # Windows JS fallback
│   │   ├── colors.sh       # ANSI colors
│   │   ├── detect.sh       # Framework detection
│   │   ├── ai.sh           # AI API calls (5 providers)
│   │   ├── report.sh       # Markdown report generator
│   │   ├── autofix.sh      # Auto-fix logic
│   │   └── bashHelpers.sh  # Bash helpers
│   ├── modules/            # 16 audit modules (each standalone)
│   └── utils/              # JS utilities
│       ├── logger.js       # Console logger
│       └── helpers.js      # Shared helpers
```

## Adding a Module

Each module is a standalone bash script in `lib/modules/`.

1. Create `lib/modules/your_module.sh`
2. Implement `audit_your_module()` — takes `$dir` as argument, outputs markdown
3. Call `register_score "Name" $score` at the end (0–100)
4. Add to `MODS` array in `lib/core/engine.sh`
5. Add `--your-module` flag in `bin/cli.js`

## Adding a Command

Each command is a separate file in `lib/commands/`.

1. Create `lib/commands/yourCommand.js`
2. Export a single function
3. Add to `bin/cli.js` with `.command()` + `.action(require(...))`
4. Add user-facing strings to `lib/constants.js`

## Rules

- **Same deps as tryappstack.** chalk 4.1.2, commander, figlet, inquirer, ora. No additions.
- **Centralized strings.** All user-facing text goes in `constants.js`.
- **Lazy require.** Commands are `require()`d inside `.action()`, not at top level.
- **Bash modules output markdown.** Tables, headers, summary lines.
- **No source code transmission.** AI only receives scores + issue category names.

## Development

```bash
git clone https://github.com/Dushyant-Khoda/tryappstack-audit.git
cd tryappstack-audit
npm install

# Test locally
node bin/cli.js
node bin/cli.js run /path/to/project --verbose
node bin/cli.js doctor
```

## Releasing

Uses semantic-release via GitHub Actions:

```bash
git commit -m "feat: add new module"  # → minor version bump
git commit -m "fix: resolve edge case" # → patch version bump
git push origin main                   # → auto-publishes to npm
```

## Code Style

- ESLint + Prettier (configured in package.json)
- Run `npm run lint` and `npm run format` before committing
- Husky pre-commit hook runs lint-staged automatically
