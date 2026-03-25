const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { spawn } = require("child_process");
const { ensureInsideProject, hasBash, hasWSL, printAIComparison } = require("../utils/helpers");
const logger = require("../utils/logger");
const { AUDIT, PREFIX } = require("../constants");

async function auditCommand(directory, opts) {
    const dir = path.resolve(directory);
    ensureInsideProject(dir);

    const LIB = path.join(__dirname, "..");
    const enginePath = path.join(LIB, "core", "engine.sh");

    // Build args for bash engine
    const args = [enginePath, dir];
    if (opts.output) args.push("-o", opts.output);
    if (opts.name) args.push("-n", opts.name);
    if (opts.verbose) args.push("--verbose");
    if (opts.strict !== undefined) args.push("--strict", String(opts.strict));
    if (opts.ai) args.push("--ai");
    if (opts.aiKey) args.push("--ai-key", opts.aiKey);
    if (opts.aiProvider) args.push("--ai-provider", opts.aiProvider);
    if (opts.prePush) args.push("--pre-push");
    if (opts.json) args.push("--json");
    if (opts.exclude) args.push("--exclude", opts.exclude);
    if (opts.include) args.push("--include", opts.include);

    // Module flags
    const modMap = {
        loc: "--loc", unusedPackages: "--unused-packages", deadCode: "--dead-code",
        structure: "--structure", bundle: "--bundle", deps: "--deps",
        complexity: "--complexity", security: "--security", performance: "--performance",
        bestPractices: "--best-practices", alternatives: "--alternatives", env: "--env",
        gitHealth: "--git-health", tests: "--tests", a11y: "--a11y", docs: "--docs",
    };

    for (const [key, flag] of Object.entries(modMap)) {
        if (opts[key]) args.push(flag);
    }

    // Determine execution method
    if (hasBash()) {
        runWithBash("bash", args, dir, opts);
    } else if (hasWSL()) {
        runWithBash("wsl", ["bash", ...args], dir, opts);
    } else {
        // Pure JS fallback
        logger.warn(`\n${PREFIX.INFO}${require("../constants").GENERIC.BASH_NOT_FOUND}`);
        const { JSEngine } = require("../core/jsEngine");
        const engine = new JSEngine(dir, opts);
        engine.run();
    }
}

function runWithBash(cmd, args, dir, opts) {
    const child = spawn(cmd, args, {
        stdio: "inherit",
        cwd: dir,
        env: {
            ...process.env,
            TRYAPPSTACK_LIB: path.join(__dirname, ".."),
            TRYAPPSTACK_VERSION: require("../../package.json").version,
        },
    });

    child.on("close", (code) => {
        if (!opts.prePush && code === 0 && !opts.ai) {
            printAIComparison();
            console.log(chalk.dim("  Part of the TryAppStack ecosystem"));
            console.log(chalk.dim("  tryappstack       → boilerplates & scaffolding"));
            console.log(chalk.dim("  tryappstack-audit  → code quality & security\n"));
        }
        process.exit(code || 0);
    });
}

module.exports = auditCommand;
