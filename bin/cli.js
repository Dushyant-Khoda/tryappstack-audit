#!/usr/bin/env node

/**
 * tryappstack-audit v1 — CLI
 * Part of the TryAppStack ecosystem
 *   tryappstack       → boilerplates
 *   tryappstack-audit → code quality
 */

const { Command } = require("commander");
const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, spawn } = require("child_process");

const pkg = require("../package.json");
const VERSION = pkg.version;
const LIB = path.join(__dirname, "..", "lib");
const BRAND = chalk.hex("#c8ff00");

// ── Program ──
const program = new Command();

program
    .name("tryappstack-audit")
    .description(chalk.dim("Ship better code. Universal audit CLI with multi-AI agent support."))
    .version(VERSION, "-v, --version")
    .argument("[directory]", "Project directory to audit", ".")
    .option("-o, --output <file>", "Report output path")
    .option("-n, --name <name>", "Report name")
    .option("--verbose", "Show all files including passing ones")
    .option("--strict [threshold]", "CI mode — exit 1 if score < threshold")
    .option("--ai", "Enable AI-powered insights")
    .option("--ai-key <key>", "AI API key for this run")
    .option(
        "--ai-provider <provider>",
        "AI provider: claude | openai | grok | gemini | deepseek",
        "claude"
    )
    .option("--pre-push", "Pre-push mode (strict + minimal output)")
    .option("--exclude <dirs>", "Comma-separated dirs to exclude", "")
    .option("--include <dirs>", "Comma-separated dirs to include", "")
    .option("--loc", "Run only LOC health module")
    .option("--unused-packages", "Run only unused packages module")
    .option("--dead-code", "Run only dead code module")
    .option("--structure", "Run only structure module")
    .option("--bundle", "Run only bundle module")
    .option("--deps", "Run only deps module")
    .option("--complexity", "Run only complexity module")
    .option("--security", "Run only security module")
    .option("--performance", "Run only performance module")
    .option("--best-practices", "Run only best practices module")
    .option("--alternatives", "Run only alternatives module")
    .option("--env", "Run only environment module")
    .option("--git-health", "Run only git health module")
    .option("--tests", "Run only test coverage module")
    .option("--a11y", "Run only accessibility module")
    .option("--docs", "Run only documentation module")
    .option("--json", "Output JSON to stdout (for CI parsing)")
    .action(runAudit);

// ── Subcommands ──
program.command("init").description("Setup .auditrc config + git pre-push hook").action(runInit);

program
    .command("trend")
    .description("Show score trend from audit history in ./audits/")
    .argument("[directory]", "Project directory", ".")
    .action(runTrend);

program
    .command("watch")
    .description("Watch for file changes and re-run audit")
    .argument("[directory]", "Project directory", ".")
    .option("--debounce <ms>", "Debounce interval", "3000")
    .action(runWatch);

program
    .command("badge")
    .description("Generate a score badge for README")
    .argument("[directory]", "Project directory", ".")
    .action(runBadge);

program.command("hook").description("Install pre-push git hook").action(runHook);

program.command("ai-setup").description("Configure AI provider & API key").action(runAISetup);

program
    .command("fix")
    .description("Auto-fix safe issues (barrel exports, configs, console.log)")
    .action(runFix);

program.command("doctor").description("Check system dependencies").action(runDoctor);

program
    .command("compare")
    .description("Compare two audit reports")
    .argument("<file1>", "First report")
    .argument("<file2>", "Second report")
    .action(runCompare);

program
    .command("ai-plan")
    .description("Generate a 2-week sprint refactoring plan from latest audit (AI required)")
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/aiPlan")(directory, opts);
    });

program
    .command("ai-chat")
    .description("Interactive AI chat about your audit report (AI required)")
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/aiChat")(directory, opts);
    });

program
    .command("ai-estimate")
    .description("Tech debt time & cost estimation from latest audit (AI required)")
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/aiEstimate")(directory, opts);
    });

program
    .command("ai-review")
    .description("Deep AI review of a specific file (AI required — file contents sent to AI)")
    .argument("<file>", "File to review (.js/.ts/.jsx/.tsx/.vue/.svelte)")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((file, opts) => {
        require("../lib/commands/aiReview")(file, opts);
    });

program
    .command("insights")
    .description(
        "Hidden issue finder — security, API quality, architecture red flags (AI-enhanced if key set)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--verbose", "Show all info-level findings")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/insights")(directory, opts);
    });

program
    .command("codedocs")
    .description(
        "Generate complete project documentation (routes, components, models, env vars, AI architecture analysis)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--output <file>", "Output file path (default: PROJECT_DOCS.md)")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/codedocs")(directory, opts);
    });

program
    .command("bizplan")
    .description(
        "AI Revenue Analyst — monetization strategies, market trends, tool ROI (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--industry <type>", 'Industry/market (e.g. "B2B SaaS")')
    .option("--stage <stage>", 'Product stage (e.g. "early stage", "growth")')
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/bizplan")(directory, opts);
    });

program
    .command("features")
    .description(
        "AI Business Analyst — feature gap analysis, market comparison, revenue prioritisation (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--type <type>", 'Product type (e.g. "B2B SaaS")', "")
    .option("--target <audience>", "Target audience", "")
    .option("--yes", "Skip interactive prompts, use defaults")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/features")(directory, opts);
    });

program
    .command("estimate")
    .description(
        "AI Project Manager — interactive sprint timeline with story points and cost estimate (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/estimate")(directory, opts);
    });

program
    .command("testplan")
    .description(
        "AI Tester — test strategy, test cases per route/component, CI config (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/testplan")(directory, opts);
    });

program
    .command("brand")
    .description(
        "AI Marketing Strategist — ICP, GTM strategy, ready-made AI prompts for launch (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/brand")(directory, opts);
    });

program
    .command("legal")
    .description(
        "Legal & compliance audit — GDPR, CCPA, Privacy Policy, ToS requirements (AI-enhanced if key set)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/legal")(directory, opts);
    });

program
    .command("context")
    .description(
        "Generate .tas-context.md — compressed project context for any AI chat (90% fewer tokens than pasting files)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--output <file>", "Output file (default: .tas-context.md)")
    .option("--ai-key <key>", "AI API key for AI-enhanced executive summary")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .action((directory, opts) => {
        require("../lib/commands/context")(directory, opts);
    });

program
    .command("team")
    .description(
        "AI Team Member REPL — @dev · @architect · @security · @qa · @pm write & review code (AI required)"
    )
    .argument("[directory]", "Project directory", ".")
    .option("--ai-key <key>", "AI API key for this run")
    .option("--ai-provider <provider>", "AI provider: claude | openai | grok | gemini | deepseek")
    .option("--ai-model <model>", "Override model for this run")
    .option(
        "--temperature <n>",
        "Override temperature 0-2 (default: from config or 0.3)",
        parseFloat
    )
    .option("--dry-run", "Show the full prompt that would be sent without calling AI")
    .option("--resume <name>", "Resume a named session from disk")
    .action((directory, opts) => {
        require("../lib/commands/team")(directory, opts);
    });

program
    .command("help [command]")
    .description("Show all commands and options. Pass a command name for details.")
    .action((command) => {
        require("../lib/commands/help")(command);
    });

program
    .command("version")
    .description("Show version, AI config status, and system info")
    .action(() => {
        const chalk = require("chalk");
        const os = require("os");
        const fs = require("fs");
        const path = require("path");
        const pkg = require("../package.json");
        const BRAND = chalk.hex("#c8ff00");
        const DIM = chalk.dim;

        console.log(
            `\n  ${BRAND.bold("tryappstack-audit")}  ${chalk.white.bold("v" + pkg.version)}`
        );
        console.log(`  ${DIM(pkg.description)}\n`);

        console.log(`  ${DIM("Node:")}      ${process.version}`);
        console.log(`  ${DIM("Platform:")} ${process.platform} (${os.arch()})`);
        console.log(`  ${DIM("Shell:")}     ${process.env.SHELL || "unknown"}\n`);

        const configPath = path.join(os.homedir(), ".tryappstack", "config");
        if (fs.existsSync(configPath)) {
            try {
                const raw = fs.readFileSync(configPath, "utf8");
                const provider = raw.match(/AI_PROVIDER="(\w+)"/)?.[1];
                const model = raw.match(/AI_MODEL="([^"]+)"/)?.[1];
                if (provider) {
                    console.log(
                        `  ${chalk.green("✓")}  AI configured — ${chalk.cyan(provider)} · ${chalk.cyan(model || "default")}`
                    );
                }
            } catch {
                /* ignore */
            }
        } else {
            console.log(
                `  ${chalk.dim("–")}  AI not configured — run ${BRAND("tas-audit ai-setup")}`
            );
        }

        console.log(`\n  ${DIM("npm:")}   https://www.npmjs.com/package/tryappstack-audit`);
        console.log(`  ${DIM("docs:")}  https://tryappstack.vercel.app\n`);
    });

program
    .command("status [directory]")
    .description("Project health: AI config, hook, last audit score, memory file, .tasrc")
    .action((directory) => {
        require("../lib/commands/status")(directory || ".");
    });

program
    .command("show-template [command]")
    .description("Preview sample output for any command before running it")
    .action((command) => {
        require("../lib/commands/show-template")(command);
    });

program.parse();

// ── Main Audit ──
async function runAudit(directory, opts) {
    const dir = path.resolve(directory);

    // Validate
    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found in " + dir));
        console.log(chalk.dim("  Run inside a JS/TS project, or: tryappstack-audit ./my-app\n"));
        process.exit(1);
    }

    // Banner (skip in pre-push and json modes)
    if (!opts.prePush && !opts.json) {
        printBanner();
    }

    // Detect hasBash (requires bash 4+ for associative arrays)
    const hasBash = os.platform() !== "win32" && shellExists("bash") && getBashMajorVersion() >= 4;
    const hasWSL = os.platform() === "win32" && shellExists("wsl");

    if (!hasBash && !hasWSL) {
        runJSAudit(dir, opts);
        return;
    }

    // Build args for bash engine
    const args = [path.join(LIB, "core", "engine.sh")];
    args.push(dir);

    if (opts.output) args.push("-o", opts.output);
    if (opts.name) args.push("-n", opts.name);
    if (opts.verbose) args.push("--verbose");
    if (opts.strict !== undefined)
        args.push("--strict", opts.strict === true ? "70" : String(opts.strict));
    if (opts.ai) args.push("--ai");
    if (opts.aiKey) args.push("--ai-key", opts.aiKey);
    if (opts.aiProvider) args.push("--ai-provider", opts.aiProvider);
    if (opts.prePush) args.push("--pre-push");
    if (opts.exclude) args.push("--exclude", opts.exclude);
    if (opts.include) args.push("--include", opts.include);

    // Module flags
    const modFlags = [
        "loc",
        "unusedPackages",
        "deadCode",
        "structure",
        "bundle",
        "deps",
        "complexity",
        "security",
        "performance",
        "bestPractices",
        "alternatives",
        "env",
        "gitHealth",
        "tests",
        "a11y",
    ];
    const modNames = [
        "loc",
        "unused-packages",
        "dead-code",
        "structure",
        "bundle",
        "deps",
        "complexity",
        "security",
        "performance",
        "best-practices",
        "alternatives",
        "env",
        "git-health",
        "tests",
        "a11y",
    ];

    modFlags.forEach((f, i) => {
        if (opts[f]) args.push("--" + modNames[i]);
    });
    if (opts.docs) args.push("--api-docs");
    if (opts.json) args.push("--json");

    // Spawn bash engine
    const bashCmd = hasBash ? "bash" : "wsl";
    const bashArgs = hasBash ? args : ["bash", ...args];

    const child = spawn(bashCmd, bashArgs, {
        stdio: "inherit",
        cwd: dir,
        env: {
            ...process.env,
            TRYAPPSTACK_LIB: LIB,
            TRYAPPSTACK_VERSION: VERSION,
        },
    });

    child.on("error", (err) => {
        console.log(chalk.red("\n  ✗ Failed to start bash: " + err.message + "\n"));
        process.exit(1);
    });
    child.on("close", (code) => {
        if (!opts.prePush && !opts.json && code === 0) {
            printFooter(opts);
        }
        process.exit(code ?? 1);
    });
}

// ── Init ──
async function runInit() {
    const inquirer = require("inquirer");
    printBanner();

    const answers = await inquirer.prompt([
        { type: "confirm", name: "hook", message: "Install pre-push git hook?", default: true },
        { type: "confirm", name: "auditrc", message: "Create .auditrc config?", default: true },
        { type: "confirm", name: "ai", message: "Setup AI provider now?", default: false },
    ]);

    if (answers.auditrc) {
        const config = `# tryappstack-audit config
# Docs: https://github.com/Dushyant-Khoda/tryappstack-audit  (TryAppStack)

# Strict mode — fail if below threshold
# STRICT_MODE=true
# STRICT_THRESHOLD=70

# AI agent (claude | openai | grok | gemini | deepseek)
# AI_PROVIDER="claude"

# Additional exclude dirs
# EXCLUDE_DIRS=("tests" "mocks" "__fixtures__")

# Pre-push gate threshold
# PRE_PUSH_THRESHOLD=60
`;
        fs.writeFileSync(".auditrc", config);
        console.log(chalk.green("  ✓") + " Created .auditrc");
    }

    fs.mkdirSync("audits", { recursive: true });
    console.log(chalk.green("  ✓") + " Created audits/");

    if (answers.hook) runHook();
    if (answers.ai) await runAISetup();

    console.log("\n  " + chalk.green.bold("✓ Setup complete!"));
    console.log("  Run: " + BRAND("npx tryappstack-audit") + "\n");
}

// ── Hook ──
function runHook() {
    if (!fs.existsSync(".git")) {
        console.log(chalk.yellow("  ⚠ Not a git repo"));
        return;
    }

    const hookContent = `#!/bin/bash
echo ""
echo "  🔍 TryAppStack Pre-Push Audit"
echo "  ─────────────────────────────"
T=60
[[ -f ".auditrc" ]] && source .auditrc 2>/dev/null
[[ -n "$PRE_PUSH_THRESHOLD" ]] && T=$PRE_PUSH_THRESHOLD
if command -v npx &>/dev/null; then
  npx tryappstack-audit --pre-push --strict "$T"
  exit $?
fi
echo "  ⚠ npx not found — skipping audit"
exit 0
`;

    if (fs.existsSync(".husky")) {
        fs.writeFileSync(".husky/pre-push", hookContent, { mode: 0o755 });
        console.log(chalk.green("  ✓") + " Husky hook: .husky/pre-push");
    } else {
        fs.mkdirSync(".git/hooks", { recursive: true });
        fs.writeFileSync(".git/hooks/pre-push", hookContent, { mode: 0o755 });
        console.log(chalk.green("  ✓") + " Git hook: .git/hooks/pre-push");
    }
    console.log(chalk.dim("  Skip: git push --no-verify"));
}

// ── AI Setup ──
async function runAISetup() {
    const inquirer = require("inquirer");
    console.log("\n  " + chalk.bold("🤖 AI Agent Setup"));
    console.log(
        chalk.dim("  AI analyzes your audit scores and gives specific refactoring advice.")
    );
    console.log(chalk.dim("  Only scores & issue names are sent — never your source code.\n"));

    const providers = [
        { name: "🟣 Claude (Anthropic)    — best for code analysis", value: "claude" },
        { name: "🟢 GPT-4o (OpenAI)      — strong all-rounder", value: "openai" },
        { name: "🔵 Grok (xAI)           — fast & uncensored", value: "grok" },
        { name: "🟡 Gemini (Google)      — good for large context", value: "gemini" },
        { name: "🔴 DeepSeek             — budget-friendly", value: "deepseek" },
    ];

    const { provider } = await inquirer.prompt([
        { type: "list", name: "provider", message: "Select AI agent:", choices: providers },
    ]);

    const hints = {
        claude: "https://console.anthropic.com/settings/keys",
        openai: "https://platform.openai.com/api-keys",
        grok: "https://console.x.ai/team/default/api-keys",
        gemini: "https://aistudio.google.com/apikey",
        deepseek: "https://platform.deepseek.com/api_keys",
    };

    console.log(chalk.dim(`\n  Get key: ${hints[provider]}`));

    const { key } = await inquirer.prompt([
        { type: "password", name: "key", message: "Paste API key:", mask: "•" },
    ]);

    if (!key) {
        console.log(chalk.red("  No key provided."));
        return;
    }

    const configDir = path.join(os.homedir(), ".tryappstack");
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, "config");

    fs.writeFileSync(configPath, `AI_PROVIDER="${provider}"\nAI_KEY="${key}"\n`, { mode: 0o600 });

    console.log(chalk.green("\n  ✓") + ` Saved to ~/.tryappstack/config (chmod 600)`);
    console.log("  Run: " + BRAND("npx tryappstack-audit --ai") + "\n");

    // Show what they get
    printAIComparison();
}

// ── Fix ──
function runFix() {
    printBanner();
    const hasBash = os.platform() !== "win32" && shellExists("bash") && getBashMajorVersion() >= 4;
    const hasWSL = os.platform() === "win32" && shellExists("wsl");

    if (!hasBash && !hasWSL) {
        console.log(chalk.red("\n  ✗ Auto-fix requires bash 4+."));
        if (os.platform() === "darwin") {
            console.log(chalk.dim("  Install: brew install bash\n"));
        } else if (os.platform() === "win32") {
            console.log(chalk.dim("  Install WSL or Git Bash.\n"));
        }
        process.exit(1);
    }

    const enginePath = path.join(LIB, "core", "engine.sh");
    const bashCmd = hasBash ? "bash" : "wsl";
    const bashArgs = hasBash
        ? [enginePath, ".", "--fix-mode"]
        : ["bash", enginePath, ".", "--fix-mode"];

    const child = spawn(bashCmd, bashArgs, {
        stdio: "inherit",
        env: { ...process.env, TRYAPPSTACK_LIB: LIB },
    });
    child.on("error", (err) => {
        console.log(chalk.red("\n  ✗ Failed to start bash: " + err.message + "\n"));
        process.exit(1);
    });
    child.on("close", (code) => process.exit(code ?? 1));
}

// ── Doctor ──
function runDoctor() {
    console.log("\n  " + chalk.bold("🩺 TryAppStack Doctor\n"));

    const checks = [
        ["Node.js", "node", true, "--version"],
        ["npm", "npm", true, "-v"],
        ["Git", "git", true, "--version"],
        ["Bash", "bash", false, "--version"],
        ["jq", "jq", false, "--version"],
        ["cloc", "cloc", false, "--version"],
    ];

    let ok = 0,
        warn = 0,
        fail = 0;

    for (const [name, cmd, required, flag] of checks) {
        try {
            const ver = execSync(`${cmd} ${flag}`, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            })
                .trim()
                .split("\n")[0]
                .slice(0, 40);
            console.log("  " + chalk.green("✓") + ` ${name} ${chalk.dim(ver)}`);
            ok++;
        } catch {
            if (required) {
                console.log("  " + chalk.red("✗") + ` ${name} — ${chalk.red("required")}`);
                fail++;
            } else {
                console.log("  " + chalk.yellow("○") + ` ${name} — ${chalk.yellow("optional")}`);
                warn++;
            }
        }
    }

    // Bash version check (bash 4+ required for full audit engine)
    const bashVer = getBashMajorVersion();
    if (bashVer >= 4) {
        console.log(
            "  " + chalk.green("✓") + ` Bash ${bashVer}.x ${chalk.dim("(engine compatible)")}`
        );
        ok++;
    } else if (bashVer > 0) {
        console.log(
            "  " +
                chalk.yellow("⚠") +
                ` Bash ${bashVer}.x — ${chalk.yellow("upgrade to 4+ for full engine")}`
        );
        if (os.platform() === "darwin") {
            console.log("    " + chalk.dim("brew install bash"));
        }
        warn++;
    } else {
        console.log(
            "  " +
                chalk.yellow("○") +
                " Bash version — " +
                chalk.dim("JS engine will be used as fallback")
        );
        warn++;
    }

    // Platform info
    console.log(
        "\n  " + chalk.dim(`Platform: ${process.platform} (${os.arch()}) · Node ${process.version}`)
    );

    // AI config check
    const configPath = path.join(os.homedir(), ".tryappstack", "config");
    if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf8");
        const provider = content.match(/AI_PROVIDER="(\w+)"/)?.[1] || "unknown";
        console.log("\n  " + chalk.green("✓") + ` AI agent: ${provider}`);
    } else if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
        console.log("\n  " + chalk.green("✓") + " AI key in environment");
    } else {
        console.log(
            "\n  " +
                chalk.yellow("○") +
                " AI not configured — run: " +
                BRAND("tryappstack-audit ai-setup")
        );
    }

    // tryappstack check
    try {
        execSync("npx tryappstack --version", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        console.log("  " + chalk.green("✓") + " tryappstack (boilerplate CLI)");
    } catch {
        console.log(
            "  " +
                chalk.yellow("○") +
                ` tryappstack — ${chalk.dim("npm i -g tryappstack for boilerplates")}`
        );
    }

    console.log(
        `\n  ${chalk.bold("Summary:")} ${chalk.green(ok + " ok")}, ${chalk.yellow(warn + " optional")}, ${chalk.red(fail + " missing")}\n`
    );
    process.exit(fail > 0 ? 1 : 0);
}

// ── Compare ──
function runCompare(file1, file2) {
    if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        console.log(chalk.red("  ✗ File not found"));
        process.exit(1);
    }

    const extractScores = (content) => {
        const scores = {};
        // Emoji score indicator differs by font/encoding; extract module + numeric score robustly.
        const re = /\|\s*[^|]*?\s*(.+?)\s*\|\s*\*\*(\d+)\*\*\/100\s*\|/g;
        let m;
        while ((m = re.exec(content))) scores[m[1].trim()] = parseInt(m[2]);
        return scores;
    };

    const s1 = extractScores(fs.readFileSync(file1, "utf8"));
    const s2 = extractScores(fs.readFileSync(file2, "utf8"));

    console.log("\n  " + chalk.bold("📊 Audit Comparison"));
    console.log(chalk.dim(`  ${path.basename(file1)} → ${path.basename(file2)}\n`));

    const allMods = [...new Set([...Object.keys(s1), ...Object.keys(s2)])].sort();
    for (const mod of allMods) {
        const a = s1[mod] || 0,
            b = s2[mod] || 0,
            diff = b - a;
        const arrow =
            diff > 0
                ? chalk.green(`↑ +${diff}`)
                : diff < 0
                  ? chalk.red(`↓ ${diff}`)
                  : chalk.dim("= 0");
        console.log(
            `  ${mod.padEnd(20)} ${String(a).padStart(3)} → ${String(b).padStart(3)}  ${arrow}`
        );
    }

    const avg1 = Object.values(s1).reduce((a, b) => a + b, 0) / (Object.keys(s1).length || 1);
    const avg2 = Object.values(s2).reduce((a, b) => a + b, 0) / (Object.keys(s2).length || 1);
    const totalDiff = Math.round(avg2 - avg1);
    console.log("\n  " + chalk.bold(`Overall: ${Math.round(avg1)} → ${Math.round(avg2)}`));
    console.log(
        "  " +
            (totalDiff > 0
                ? chalk.green.bold(`↑ +${totalDiff} improvement`)
                : totalDiff < 0
                  ? chalk.red.bold(`↓ ${totalDiff} regression`)
                  : chalk.dim("No change")) +
            "\n"
    );
}

// ── Helpers ──

function shellExists(cmd) {
    try {
        const check = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
        execSync(check, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function getBashMajorVersion() {
    try {
        const ver = execSync("bash --version", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        const m = ver.match(/version\s+(\d+)/);
        return m ? parseInt(m[1]) : 0;
    } catch {
        return 0;
    }
}

function printBanner() {
    console.log("");
    try {
        const banner = figlet.textSync("TAS Audit", { font: "Small" });
        console.log(BRAND(banner));
    } catch {
        console.log(BRAND.bold("  ◆ TryAppStack Audit"));
    }

    // Check AI connection for premium mode
    const configPath = require("path").join(require("os").homedir(), ".tryappstack", "config");
    let aiLine = chalk.dim("  The All-in-One AI Terminal · v" + VERSION);
    if (require("fs").existsSync(configPath)) {
        try {
            const cfg = require("fs").readFileSync(configPath, "utf8");
            const p = cfg.match(/AI_PROVIDER="(\w+)"/)?.[1];
            const m = cfg.match(/AI_MODEL="([^"]+)"/)?.[1];
            const icons = {
                claude: "🟣",
                anthropic: "🟣",
                openai: "🟢",
                gpt: "🟢",
                grok: "🔵",
                xai: "🔵",
                gemini: "🟡",
                google: "🟡",
                deepseek: "🔴",
            };
            const names = {
                claude: "Claude",
                anthropic: "Claude",
                openai: "GPT",
                gpt: "GPT",
                grok: "Grok",
                xai: "Grok",
                gemini: "Gemini",
                google: "Gemini",
                deepseek: "DeepSeek",
            };
            if (p) {
                const tag =
                    BRAND("◆ AI Connected") +
                    chalk.dim(` ${icons[p] || "🤖"} ${names[p] || p}${m ? " · " + m : ""}`);
                aiLine = `  ${tag}  ${chalk.dim("v" + VERSION)}`;
            }
        } catch {
            /* ignore */
        }
    }

    console.log(aiLine);
    console.log(chalk.dim("  ─────────────────────────────────────────────\n"));
}

const PUNCHLINES = [
    "Built with ❤️  for developers who ship.",
    "Your entire product team — in one terminal.",
    "From audit to launch, one command at a time.",
    "Ship smarter, not harder.",
    "Where code meets strategy.",
    "The terminal your product deserves.",
    "Stop guessing. Start shipping.",
];

function printFooter(opts) {
    console.log("");
    if (!opts.ai) {
        printAIComparison();
    }
    const line = PUNCHLINES[Math.floor(Math.random() * PUNCHLINES.length)];
    console.log(chalk.dim("  " + line));
    console.log(chalk.dim("  tryappstack-audit · tryappstack.vercel.app"));

    // Rating nudge — shown ~20% of the time
    if (Math.random() < 0.2) {
        console.log("");
        console.log(chalk.dim("  ⭐ If this saved you time, a star means a lot →"));
        console.log(chalk.dim("  github.com/Dushyant-Khoda/tryappstack-audit  — TryAppStack"));
    }
    console.log("");
}

function printAIComparison() {
    console.log("  ┌──────────────────────────────────────────────────────────────┐");
    console.log(
        "  │  " +
            chalk.bold("Without AI") +
            "                  │  " +
            BRAND.bold("With AI ✨") +
            "                    │"
    );
    console.log("  ├──────────────────────────────────────────────────────────────┤");
    console.log("  │  ✓ 16 audit modules          │  ✓ Everything in free        │");
    console.log("  │  ✓ Scores & grades            │  ✓ Priority refactor plan    │");
    console.log("  │  ✓ .md report auto-saved      │  ✓ Architecture suggestions  │");
    console.log("  │  ✓ Pre-push git gate          │  ✓ 30-min quick wins list    │");
    console.log("  │  ✓ Auto-fix + watch mode      │  ✓ Tech debt time estimate   │");
    console.log("  │  ✓ Score trend history         │  ✓ Score improvement roadmap │");
    console.log(
        "  │  " +
            chalk.dim("Free forever") +
            "                │  " +
            chalk.dim("~$0.01/run, your key") +
            "       │"
    );
    console.log("  └──────────────────────────────────────────────────────────────┘");
    console.log("");
    console.log("  " + chalk.dim("Setup AI: ") + BRAND("npx tryappstack-audit ai-setup"));
    console.log("");
}

// ── Trend Command ──
function runTrend(directory) {
    const dir = path.resolve(directory);
    const auditsDir = path.join(dir, "audits");

    if (!fs.existsSync(auditsDir)) {
        console.log(chalk.yellow("\n  ⚠ No audits/ directory. Run an audit first.\n"));
        process.exit(1);
    }

    const files = fs
        .readdirSync(auditsDir)
        .filter((f) => f.endsWith(".md") && f.startsWith("audit-"))
        .sort();

    if (files.length < 1) {
        console.log(chalk.yellow("\n  ⚠ No audit reports found in ./audits/\n"));
        process.exit(1);
    }

    printBanner();
    console.log("  " + chalk.bold("📈 Score Trend") + chalk.dim(`  (${files.length} reports)\n`));

    const extractScore = (content) => {
        const m = content.match(/\*\*Score:\*\*\s*\*\*(\d+)\/100/);
        return m ? parseInt(m[1]) : null;
    };

    const extractDate = (filename) => {
        const m = filename.match(/audit-(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : filename;
    };

    let prev = null;
    const maxBar = 30;

    for (const f of files) {
        const content = fs.readFileSync(path.join(auditsDir, f), "utf8");
        const score = extractScore(content);
        if (score === null) continue;

        const date = extractDate(f);
        const barLen = Math.round((score / 100) * maxBar);
        const bar = "█".repeat(barLen) + "░".repeat(maxBar - barLen);

        const sc = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
        const diff = prev !== null ? score - prev : 0;
        const arrow =
            diff > 0
                ? chalk.green(` ↑+${diff}`)
                : diff < 0
                  ? chalk.red(` ↓${diff}`)
                  : chalk.dim(" =");

        console.log(
            `  ${chalk.dim(date)}  ${sc(bar)}  ${sc.bold(String(score).padStart(3))}${arrow}`
        );
        prev = score;
    }

    if (files.length >= 2) {
        const first = extractScore(fs.readFileSync(path.join(auditsDir, files[0]), "utf8")) || 0;
        const last =
            extractScore(fs.readFileSync(path.join(auditsDir, files[files.length - 1]), "utf8")) ||
            0;
        const total = last - first;
        console.log(
            "\n  " +
                chalk.bold("Overall: ") +
                (total >= 0 ? chalk.green.bold(`↑ +${total}`) : chalk.red.bold(`↓ ${total}`)) +
                chalk.dim(` (${files[0]} → ${files[files.length - 1]})`)
        );
    }
    console.log("");
}

// ── Watch Command ──
function runWatch(directory, opts) {
    const dir = path.resolve(directory);
    const debounce = parseInt(opts.debounce) || 3000;

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json in " + dir + "\n"));
        process.exit(1);
    }

    printBanner();
    console.log("  " + chalk.bold("👁  Watch Mode"));
    console.log(chalk.dim(`  Re-auditing on file changes (debounce: ${debounce}ms)`));
    console.log(chalk.dim("  Press Ctrl+C to stop\n"));

    let timer = null;
    const srcDir = fs.existsSync(path.join(dir, "src")) ? path.join(dir, "src") : dir;

    const runOnce = () => {
        console.log(
            chalk.dim("\n  ─── Re-running audit (" + new Date().toLocaleTimeString() + ") ───\n")
        );
        try {
            execSync(`node "${path.join(__dirname, "cli.js")}" "${dir}" -n "watch-latest"`, {
                stdio: "inherit",
                cwd: dir,
            });
        } catch {
            /* ignore */
        }
    };

    // Initial run
    runOnce();

    // Watch
    const watchOpts = { recursive: true };
    try {
        fs.watch(srcDir, watchOpts, (event, filename) => {
            if (!filename) return;
            if (
                filename.includes("node_modules") ||
                filename.includes(".git") ||
                filename.includes("audits")
            )
                return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(runOnce, debounce);
        });
    } catch (e) {
        console.log(chalk.yellow("  ⚠ fs.watch not supported. Using polling...\n"));
        setInterval(runOnce, Math.max(debounce, 10000));
    }
}

// ── Badge Command ──
function runBadge(directory) {
    const dir = path.resolve(directory);
    const auditsDir = path.join(dir, "audits");

    const files = fs.existsSync(auditsDir)
        ? fs
              .readdirSync(auditsDir)
              .filter((f) => f.endsWith(".md"))
              .sort()
        : [];
    let score = "?";
    let color = "lightgrey";

    if (files.length > 0) {
        const content = fs.readFileSync(path.join(auditsDir, files[files.length - 1]), "utf8");
        const m = content.match(/\*\*Score:\*\*\s*\*\*(\d+)\/100/);
        if (m) {
            score = m[1];
            const s = parseInt(score);
            color = s >= 80 ? "brightgreen" : s >= 60 ? "yellow" : "red";
        }
    }

    const badgeUrl = `https://img.shields.io/badge/audit%20score-${score}%2F100-${color}`;
    const markdown = `[![Audit Score](${badgeUrl})](./audits/)`;

    console.log("\n  " + chalk.bold("🏷  Audit Badge\n"));
    console.log("  " + chalk.dim("Markdown (paste in README.md):\n"));
    console.log("  " + BRAND(markdown));
    console.log("\n  " + chalk.dim("HTML:\n"));
    console.log("  " + chalk.dim(`<img src="${badgeUrl}" alt="Audit Score">`));
    console.log("");
}

// ── JS Engine Fallback (Windows without bash, macOS bash < 4) ──
function runJSAudit(dir, opts) {
    const jsonMode = opts && opts.json;

    if (!jsonMode) {
        if (!opts.prePush) printBanner();
        console.log(chalk.yellow("  Running JS engine (bash 4+ not available)\n"));
    }

    const { JSEngine } = require(path.join(LIB, "core", "jsEngine.js"));
    const engine = new JSEngine(dir, opts);
    const result = engine.run();

    const project = path.basename(dir);
    const totalMods = Object.keys(result.scores).length;
    const totalScore = Object.values(result.scores).reduce((a, b) => a + b, 0);
    const avg = totalMods > 0 ? Math.round(totalScore / totalMods) : 0;
    const grade =
        avg >= 90
            ? "A+"
            : avg >= 80
              ? "A"
              : avg >= 70
                ? "B"
                : avg >= 60
                  ? "C"
                  : avg >= 50
                    ? "D"
                    : "F";

    if (jsonMode) {
        console.log(
            JSON.stringify({
                project,
                framework: result.framework.display,
                score: avg,
                grade,
                modules: result.scores,
            })
        );
    } else {
        // Generate report
        const timestamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
        const outputDir = path.join(dir, "audits");
        fs.mkdirSync(outputDir, { recursive: true });
        const reportName = opts.name || `audit-${timestamp}`;
        const outputFile = opts.output || path.join(outputDir, `${reportName}.md`);

        let scoreTable = "| Module | Score |\n|--------|-------|\n";
        for (const [mod, score] of Object.entries(result.scores).sort((a, b) => b[1] - a[1])) {
            const emoji = score >= 80 ? "🟢" : score >= 60 ? "🟡" : "🔴";
            scoreTable += `| ${emoji} ${mod} | **${score}**/100 |\n`;
        }

        const report = `# 🔍 TryAppStack Audit Report

> **Project:** ${project}
> **Framework:** ${result.framework.display}
> **Date:** ${new Date().toISOString().slice(0, 19)}
> **Score:** **${avg}/100 (Grade: ${grade})**

---

## 📋 Scorecard

${scoreTable}| **Overall** | **${avg}/100 (${grade})** |

---

${result.report}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) v${VERSION} (JS engine)*
`;

        fs.writeFileSync(outputFile, report);

        // Console scorecard
        console.log("  " + chalk.bold("📋 Scorecard\n"));
        for (const [mod, score] of Object.entries(result.scores).sort((a, b) => b[1] - a[1])) {
            const barLen = Math.round((score / 100) * 25);
            const bar = "█".repeat(barLen) + "░".repeat(25 - barLen);
            const sc = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
            console.log(`  ${mod.padEnd(18)} ${sc(bar)} ${sc.bold(String(score).padStart(3))}`);
        }

        const gc = avg >= 80 ? chalk.green : avg >= 60 ? chalk.yellow : chalk.red;
        console.log("\n  " + chalk.bold("Overall: ") + gc.bold(`${avg}/100 (${grade})`));
        console.log("\n  " + chalk.green("✓") + ` Report: ${outputFile}\n`);
    }

    // Strict check
    if (opts && opts.strict !== undefined) {
        const threshold = opts.strict === true ? 70 : parseInt(opts.strict) || 70;
        if (avg < threshold) {
            if (!jsonMode) console.log(chalk.red.bold(`  ✗ FAILED: ${avg} < ${threshold}`));
            process.exit(1);
        }
    }
}
