/**
 * help — full command reference with categories
 *
 * tas-audit help
 * tas-audit help team
 * tas-audit help <command>
 */

const chalk = require("chalk");
const pkg   = require("../../package.json");

const BRAND = chalk.hex("#c8ff00");
const DIM   = chalk.dim;
const BOLD  = chalk.bold;
const GREEN = chalk.green;

// ── Command catalogue ─────────────────────────────────────────────────────────

const COMMANDS = {
    "Free — no AI key needed": [
        { cmd: "tas-audit",                    alias: "",                     desc: "Scan project across 16 modules, score each one, save report to audits/" },
        { cmd: "tas-audit insights",           alias: "",                     desc: "Deeper scan — security patterns, empty catch blocks, missing validation" },
        { cmd: "tas-audit codedocs",           alias: "",                     desc: "Generate PROJECT_DOCS.md — routes, components, exports, env vars" },
        { cmd: "tas-audit context",            alias: "",                     desc: "Generate .tas-context.md — attach to any AI chat instead of pasting files" },
        { cmd: "tas-audit legal",              alias: "",                     desc: "GDPR / CCPA checklist — static compliance reference" },
        { cmd: "tas-audit trend",              alias: "",                     desc: "Plot score history from past reports in audits/" },
        { cmd: "tas-audit watch",              alias: "",                     desc: "Re-audit automatically whenever a file is saved" },
        { cmd: "tas-audit compare <a> <b>",   alias: "",                     desc: "Diff two audit reports — show what improved or regressed" },
        { cmd: "tas-audit fix",                alias: "",                     desc: "Apply safe automatic fixes — barrel files, .env.example, console.log cleanup" },
        { cmd: "tas-audit badge",              alias: "",                     desc: "Generate a Shields.io score badge for your README" },
        { cmd: "tas-audit init",               alias: "",                     desc: "Create audits/ directory, config file, and .gitignore entries" },
        { cmd: "tas-audit hook",               alias: "",                     desc: "Install pre-push git hook — blocks push if score drops below threshold" },
        { cmd: "tas-audit doctor",             alias: "",                     desc: "Check Node version, bash availability, and system dependencies" },
    ],
    "AI — requires key from ai-setup": [
        { cmd: "tas-audit team",               alias: "",                     desc: "Interactive REPL — @dev / @architect / @security / @qa / @pm write code to disk" },
        { cmd: "tas-audit bizplan",            alias: "",                     desc: "Business analysis — revenue models, competitor notes, 90-day roadmap" },
        { cmd: "tas-audit features",           alias: "",                     desc: "Feature gap analysis — what is missing, what to cut, priority matrix" },
        { cmd: "tas-audit estimate",           alias: "",                     desc: "Sprint planning — story points, timeline, risk register" },
        { cmd: "tas-audit testplan",           alias: "",                     desc: "Test case generation — unit, integration, E2E per route and component" },
        { cmd: "tas-audit brand",              alias: "",                     desc: "Marketing notes — ICP, positioning, GTM by channel, copy" },
        { cmd: "tas-audit legal",              alias: "(AI-enhanced)",        desc: "Full GDPR/CCPA compliance + ToS and Privacy Policy templates" },
        { cmd: "tas-audit insights",           alias: "(AI-enhanced)",        desc: "Priority fix list with code snippets and production checklist" },
        { cmd: "tas-audit codedocs",           alias: "(AI-enhanced)",        desc: "Architecture analysis, data flow diagram, deployment guide" },
        { cmd: "tas-audit ai-plan",            alias: "",                     desc: "2-week sprint plan built from current audit findings" },
        { cmd: "tas-audit ai-chat",            alias: "",                     desc: "Ask questions about your codebase — quick Q&A without a full REPL" },
        { cmd: "tas-audit ai-estimate",        alias: "",                     desc: "Estimate tech debt in hours — broken down by module" },
        { cmd: "tas-audit ai-review <file>",   alias: "",                     desc: "Deep code review with before/after suggestions" },
        { cmd: "tas-audit --ai",               alias: "",                     desc: "Append AI insights to the main audit in one run" },
    ],
    "Setup and config": [
        { cmd: "tas-audit ai-setup",           alias: "",                     desc: "Choose provider and model, save API key to ~/.tryappstack/config" },
        { cmd: "tas-audit status",             alias: "",                     desc: "Show AI config, hook status, last audit score, and project health" },
        { cmd: "tas-audit version",            alias: "",                     desc: "Show version and system info" },
        { cmd: "tas-audit doctor",             alias: "",                     desc: "Check system dependencies" },
    ],
    "Utilities": [
        { cmd: "tas-audit show-template <cmd>",alias: "",                     desc: "Preview sample output for any command before running it" },
        { cmd: "tas-audit help",               alias: "",                     desc: "Show this reference" },
        { cmd: "tas-audit help <command>",     alias: "",                     desc: "Show details and options for a specific command" },
    ],
};

// ── Per-command detail pages ──────────────────────────────────────────────────

const COMMAND_DETAIL = {
    audit: {
        usage: "tas-audit [directory] [options]",
        desc:  "Scans a JS/TS project across 16 modules and produces a scored markdown report.",
        options: [
            ["--ai",                     "Append AI insights (key required)"],
            ["--ai-provider <p>",        "claude | openai | grok | gemini | deepseek"],
            ["--strict [N]",             "Exit 1 if overall score < N (default 70)"],
            ["--json",                   "Output JSON instead of markdown report"],
            ["--pre-push",               "Strict + minimal output for git hook"],
            ["--exclude <dirs>",         "Comma-separated directories to skip"],
            ["--include <dirs>",         "Only audit these directories"],
            ["--verbose",                "Show every file scanned"],
            ["--loc",                    "Run only the LOC Health module"],
            ["--security",               "Run only the Security module"],
            ["--tests",                  "Run only the Test Coverage module"],
            ["--a11y",                   "Run only the Accessibility module"],
            ["(and 12 more flags)",      "One per module — see docs/without-ai.md"],
        ],
        examples: [
            "tas-audit",
            "tas-audit --strict 75",
            "tas-audit --security --tests",
            "tas-audit --json | jq '.score'",
            "tas-audit ./my-app --exclude dist,build",
        ],
    },
    team: {
        usage: "tas-audit team [directory] [options]",
        desc:  "Opens an interactive REPL with an AI persona that reads your project and writes code to disk.",
        options: [
            ["--ai-key <key>",           "Use this key for this run only"],
            ["--ai-provider <p>",        "Override provider for this run"],
            ["--ai-model <model>",       "Override model for this run"],
            ["--temperature <n>",        "Set temperature 0–2 (default from config or 0.3)"],
            ["--dry-run",               "Print the full prompt without sending it"],
            ["--resume <name>",          "Resume a named session saved with /save-session"],
        ],
        examples: [
            "tas-audit team",
            "tas-audit team --resume auth-refactor",
            "tas-audit team --ai-model claude-opus-4-20250514",
            "tas-audit team --dry-run",
        ],
        note: "Inside the REPL, type / and press Tab to see all slash commands.",
    },
    "ai-setup": {
        usage: "tas-audit ai-setup",
        desc:  "Walks through provider selection, model selection, and API key entry using arrow-key menus. Saves to ~/.tryappstack/config (chmod 600).",
        options: [],
        examples: ["tas-audit ai-setup"],
        note: "API key is never written to any project file. Run again to change provider or model.",
    },
    "show-template": {
        usage: "tas-audit show-template [command]",
        desc:  "Preview realistic sample output for any command before running it.",
        options: [],
        examples: [
            "tas-audit show-template",
            "tas-audit show-template audit",
            "tas-audit show-template team",
            "tas-audit show-template bizplan",
            "tas-audit show-template testplan",
        ],
    },
    status: {
        usage: "tas-audit status [directory]",
        desc:  "Shows current project health: AI configured, hook installed, last audit score, memory file, and .tasrc.",
        options: [],
        examples: ["tas-audit status", "tas-audit status ./my-app"],
    },
    context: {
        usage: "tas-audit context [directory] [options]",
        desc:  "Generates .tas-context.md — a structured project summary you can paste into any AI chat tool.",
        options: [
            ["--output <file>",          "Write to a custom filename"],
            ["--ai-key <key>",           "Add AI executive summary"],
            ["--ai-provider <p>",        "Provider for AI summary"],
        ],
        examples: [
            "tas-audit context",
            "tas-audit context --output context-for-claude.md",
        ],
    },
};

// ── Renderers ─────────────────────────────────────────────────────────────────

function renderHelp(topic) {
    if (topic) {
        const key = topic.replace(/^tas-audit\s+/, "").toLowerCase();
        const detail = COMMAND_DETAIL[key];
        if (detail) {
            renderCommandDetail(key, detail);
        } else {
            console.log(chalk.yellow(`\n  No detail page for "${topic}". Showing full reference.\n`));
            renderFullHelp();
        }
        return;
    }
    renderFullHelp();
}

function renderFullHelp() {
    console.log(`\n  ${BRAND.bold("tryappstack-audit")}  ${DIM("v" + pkg.version)}`);
    console.log(`  ${DIM("16-module code audit + AI assistant for JS/TS projects")}\n`);

    for (const [section, cmds] of Object.entries(COMMANDS)) {
        const isFree = section.startsWith("Free");
        const isAI   = section.startsWith("AI");
        const label  = isFree ? GREEN.bold(section) : isAI ? BRAND.bold(section) : BOLD(section);

        console.log(`  ${label}\n`);

        const maxCmd = Math.max(...cmds.map((c) => c.cmd.length));
        for (const { cmd, alias, desc } of cmds) {
            const aliasStr = alias ? chalk.dim(` ${alias}`) : "";
            console.log(`    ${BRAND(cmd.padEnd(maxCmd + 1))}${aliasStr}`);
            console.log(`    ${DIM(" ".repeat(maxCmd + 1) + desc)}\n`);
        }
    }

    console.log(`  ${DIM("─".repeat(60))}`);
    console.log(`  ${DIM("Get details for any command:")}  ${BRAND("tas-audit help <command>")}`);
    console.log(`  ${DIM("Preview sample output:")        }  ${BRAND("tas-audit show-template <command>")}`);
    console.log(`  ${DIM("Docs:")                         }  ${chalk.cyan("https://tryappstack.vercel.app")}\n`);
}

function renderCommandDetail(name, detail) {
    console.log(`\n  ${BRAND.bold("tas-audit " + name)}\n`);
    console.log(`  ${detail.desc}\n`);

    console.log(`  ${BOLD("Usage")}`);
    console.log(`    ${chalk.cyan(detail.usage)}\n`);

    if (detail.options && detail.options.length > 0) {
        console.log(`  ${BOLD("Options")}`);
        const maxOpt = Math.max(...detail.options.map(([o]) => o.length));
        for (const [opt, desc] of detail.options) {
            console.log(`    ${BRAND(opt.padEnd(maxOpt + 2))} ${DIM(desc)}`);
        }
        console.log("");
    }

    if (detail.examples && detail.examples.length > 0) {
        console.log(`  ${BOLD("Examples")}`);
        for (const ex of detail.examples) {
            console.log(`    ${chalk.cyan(ex)}`);
        }
        console.log("");
    }

    if (detail.note) {
        console.log(`  ${DIM("Note: " + detail.note)}\n`);
    }
}

module.exports = renderHelp;
