const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const inquirer = require("inquirer");
const logger = require("../utils/logger");
const { AI, PROVIDERS, PREFIX } = require("../constants");
const { printAIComparison } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

const PROVIDER_MODELS = {
    claude: [
        { name: "claude-sonnet-4-20250514  ★ Recommended (fast + smart)", value: "claude-sonnet-4-20250514" },
        { name: "claude-opus-4-20250514      Most powerful (slower, higher cost)", value: "claude-opus-4-20250514" },
        { name: "claude-haiku-4-20250514     Fastest & cheapest", value: "claude-haiku-4-20250514" },
    ],
    anthropic: [
        { name: "claude-sonnet-4-20250514  ★ Recommended", value: "claude-sonnet-4-20250514" },
        { name: "claude-opus-4-20250514      Most powerful", value: "claude-opus-4-20250514" },
        { name: "claude-haiku-4-20250514     Fastest", value: "claude-haiku-4-20250514" },
    ],
    openai: [
        { name: "gpt-4o              ★ Recommended (best balance)", value: "gpt-4o" },
        { name: "gpt-4o-mini         Faster & cheaper", value: "gpt-4o-mini" },
        { name: "o1-preview          Best reasoning (slowest)", value: "o1-preview" },
        { name: "gpt-4-turbo         Previous flagship", value: "gpt-4-turbo" },
    ],
    gpt: [
        { name: "gpt-4o              ★ Recommended", value: "gpt-4o" },
        { name: "gpt-4o-mini         Faster & cheaper", value: "gpt-4o-mini" },
    ],
    grok: [
        { name: "grok-3              ★ Recommended", value: "grok-3" },
        { name: "grok-3-mini         Faster & cheaper", value: "grok-3-mini" },
    ],
    xai: [
        { name: "grok-3              ★ Recommended", value: "grok-3" },
        { name: "grok-3-mini         Faster", value: "grok-3-mini" },
    ],
    gemini: [
        { name: "gemini-2.0-flash    ★ Recommended (fast)", value: "gemini-2.0-flash" },
        { name: "gemini-1.5-pro      Most capable", value: "gemini-1.5-pro" },
        { name: "gemini-1.5-flash    Fastest", value: "gemini-1.5-flash" },
    ],
    google: [
        { name: "gemini-2.0-flash    ★ Recommended", value: "gemini-2.0-flash" },
        { name: "gemini-1.5-pro      Most capable", value: "gemini-1.5-pro" },
    ],
    deepseek: [
        { name: "deepseek-chat       ★ Recommended (fast, cheap)", value: "deepseek-chat" },
        { name: "deepseek-reasoner   R1 — best for analysis & code", value: "deepseek-reasoner" },
    ],
};

const PROVIDER_ICONS = {
    claude: "🟣", anthropic: "🟣",
    openai: "🟢", gpt: "🟢",
    grok: "🔵", xai: "🔵",
    gemini: "🟡", google: "🟡",
    deepseek: "🔴",
};

async function aiSetupCommand() {
    console.log(`\n  ${BRAND.bold("◆ TryAppStack AI Setup")}`);
    console.log(chalk.dim(`  Connect your AI key — unlock your full AI team\n`));
    logger.dim(`  ${AI.SECURITY_NOTE}\n`);

    const { provider } = await inquirer.prompt([
        { type: "list", name: "provider", message: "  Choose AI provider:", choices: PROVIDERS },
    ]);

    const selected = PROVIDERS.find((p) => p.value === provider);
    console.log(chalk.dim(`\n  Get your key: ${selected.url}\n`));

    const { key } = await inquirer.prompt([
        { type: "password", name: "key", message: "  Paste API key:", mask: "•" },
    ]);

    if (!key) { logger.error("  No key provided."); return; }

    // Model selection
    const modelChoices = PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude;
    const { model } = await inquirer.prompt([
        {
            type: "list",
            name: "model",
            message: "  Choose model:",
            choices: modelChoices,
        },
    ]);

    const configDir = path.join(os.homedir(), ".tryappstack");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        path.join(configDir, "config"),
        `AI_PROVIDER="${provider}"\nAI_KEY="${key}"\nAI_MODEL="${model}"\n`,
        { mode: 0o600 }
    );

    const icon = PROVIDER_ICONS[provider] || "🤖";

    // Premium success screen
    console.log("\n");
    console.log("  " + BRAND("━".repeat(54)));
    console.log(`  ${BRAND.bold("  ◆  AI Team Activated")}`);
    console.log("  " + BRAND("━".repeat(54)));
    console.log(`\n  ${icon} ${chalk.bold(provider.toUpperCase())}  ·  ${chalk.cyan(model)}`);
    console.log(chalk.dim("  Saved to ~/.tryappstack/config (chmod 600)\n"));
    console.log(`  ${chalk.bold("You now have access to:")}`);
    console.log(chalk.dim("  bizplan · features · estimate · testplan · brand · legal"));
    console.log(chalk.dim("  insights+ · codedocs+ · context+ · team · ai-plan · ai-chat\n"));
    console.log(`  ${BRAND("→")} Start with: ${BRAND.bold("npx tas-audit team")}`);
    console.log(chalk.dim("    Your AI team is ready to build, review, and ship\n"));
    console.log("  " + BRAND("━".repeat(54)) + "\n");

    printAIComparison();
}

module.exports = aiSetupCommand;
