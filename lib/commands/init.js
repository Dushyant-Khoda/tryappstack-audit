const fs = require("fs");
const chalk = require("chalk");
const inquirer = require("inquirer");
const logger = require("../utils/logger");
const { INIT, PREFIX } = require("../constants");

async function initCommand() {
    const answers = await inquirer.prompt([
        { type: "confirm", name: "hook", message: "Install pre-push git hook?", default: true },
        { type: "confirm", name: "auditrc", message: "Create .auditrc config?", default: true },
        { type: "confirm", name: "ai", message: "Setup AI provider now?", default: false },
    ]);

    if (answers.auditrc) {
        const config = `# tryappstack-audit config\n# STRICT_THRESHOLD=70\n# AI_PROVIDER="claude"\n# EXCLUDE_DIRS=("tests" "mocks")\n# PRE_PUSH_THRESHOLD=60\n`;
        fs.writeFileSync(".auditrc", config);
        logger.success(`${PREFIX.SUCCESS}${INIT.CREATED_CONFIG}`);
    }

    fs.mkdirSync("audits", { recursive: true });
    logger.success(`${PREFIX.SUCCESS}${INIT.CREATED_AUDITS}`);

    if (answers.hook) { const hookCmd = require("./hook"); hookCmd(); }
    if (answers.ai) { const aiCmd = require("./aiSetup"); await aiCmd(); }

    console.log("\n");
    logger.success(`  ${INIT.SETUP_COMPLETE}`);
    logger.brand(`  Run: ${INIT.RUN_HINT}\n`);
}

module.exports = initCommand;
