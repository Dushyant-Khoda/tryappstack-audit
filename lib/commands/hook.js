const fs = require("fs");
const chalk = require("chalk");
const logger = require("../utils/logger");
const { GENERIC, PREFIX } = require("../constants");

function hookCommand() {
    if (!fs.existsSync(".git")) {
        logger.warn(`${PREFIX.WARN}${GENERIC.NOT_A_GIT_REPO}`);
        return;
    }

    const hookContent = `#!/bin/bash\necho ""\necho "  🔍 TAS Audit Pre-Push"\necho "  ─────────────────────"\nT=60\n[[ -f ".auditrc" ]] && source .auditrc 2>/dev/null\n[[ -n "\\$PRE_PUSH_THRESHOLD" ]] && T=\\$PRE_PUSH_THRESHOLD\nif command -v npx &>/dev/null; then\n  npx tryappstack-audit --pre-push --strict "\\$T"\n  exit \\$?\nfi\nexit 0\n`;

    if (fs.existsSync(".husky")) {
        fs.writeFileSync(".husky/pre-push", hookContent, { mode: 0o755 });
        logger.success(`${PREFIX.SUCCESS}Husky hook: .husky/pre-push`);
    } else {
        fs.mkdirSync(".git/hooks", { recursive: true });
        fs.writeFileSync(".git/hooks/pre-push", hookContent, { mode: 0o755 });
        logger.success(`${PREFIX.SUCCESS}Git hook: .git/hooks/pre-push`);
    }
    logger.dim("  Skip: git push --no-verify");
}

module.exports = hookCommand;
