/**
 * tas-audit team  v1
 * AI Team Member REPL — the terminal-native AI coding team
 *
 * Core:     Streaming · Ctrl+C interruption · Per-message cost · Budget alerts
 * Context:  Window meter · Auto-compress · Memory anchors · Overflow warning
 * Memory:   tas-memory.md · /remember · auto-injected · portable across models
 * Trust:    Confidence badge · /verify · /disagree · hallucination risk flags
 * Search:   /star · /search all sessions · code block index · weekly digest
 * Router:   Auto-failover · rate limit handling · smart routing cheap/complex
 * Logging:  npm-style temp log · errors show file path · auto-cleanup on exit
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const readline = require("readline");
const chalk = require("chalk");
const { scanProject } = require("../core/scanner");
const { streamAI }    = require("../ai/stream");
const { callAI, getProviderName } = require("../ai/runner");
const { getAIStatus } = require("../utils/helpers");
const { resolveConfig, applyProfile, listProfiles, createTasRC, printConfig } = require("../utils/tas-config");
const { calcCost, formatCostLine, recordUsage, checkBudget, printCostSummary, printModelComparison, estimateTokens } = require("../utils/cost");
const { saveSession, resumeSession, branchSession, printSessions } = require("../utils/session");
const { savePrompt, loadPrompt, exportPack, importPack, installPack, printPrompts, listPrompts } = require("../utils/prompt-store");
const { initSessionLog, logVerbose, logError, logAITurn, closeSessionLog, installGlobalErrorHandler } = require("../utils/temp-log");
const { remember, forget, injectMemoryIntoMessages, printMemory, exportBundle, importBundle } = require("../utils/memory");
const { getContextUsage, renderContextMeter, compressContext, aiCompressContext, parseAnchor, printAnchors, COMPRESS_AT } = require("../utils/context-window");
const { withConfidenceRequest, parseConfidence, stripConfidenceLine, renderConfidenceBadge, flagHighRiskContent, renderRiskFlags, buildVerifyMessages, buildDisagreeMessages, printVerifyHeader, printDisagreeHeader } = require("../utils/trust");
const { indexMessage, starMessage, printStarred, search, printSearchResults, printWeeklyDigest, recordTagCost, printCostTags } = require("../utils/search");
const { classifyQuery, routeByComplexity, callWithFailover, printRoutingInfo } = require("../utils/router");
const { runGitignoreGuard, printStoragePolicy } = require("../utils/gitignore");

const BRAND = chalk.hex("#c8ff00");
const DIM   = chalk.dim;

// ── Team members ──────────────────────────────────────────────────────────────
const MEMBERS = {
    dev: {
        name: "@dev", title: "Senior Developer", icon: "👨‍💻", color: chalk.cyan, canWrite: true,
        persona: "You are a senior full-stack developer. Write clean, production-ready code with proper error handling, TypeScript types, and best practices. Use the project's existing patterns.",
    },
    architect: {
        name: "@architect", title: "System Architect", icon: "🏗", color: chalk.blue, canWrite: false,
        persona: "You are a system architect with experience at Google and Vercel. Design scalable, maintainable systems. Focus on patterns, trade-offs, and long-term implications.",
    },
    security: {
        name: "@security", title: "Security Expert", icon: "🔐", color: chalk.red, canWrite: true,
        persona: "You are a security engineer specialising in web application security. Identify vulnerabilities, suggest fixes with code, and reference OWASP. Be specific about CVEs and attack vectors.",
    },
    qa: {
        name: "@qa", title: "QA Lead", icon: "🧪", color: chalk.green, canWrite: true,
        persona: "You are a QA lead who writes thorough test cases. Think in edge cases, error states, and user journeys. Always provide runnable test code with proper setup/teardown.",
    },
    pm: {
        name: "@pm", title: "Product Manager", icon: "📋", color: chalk.yellow, canWrite: false,
        persona: "You are a product manager from Linear/Notion. Define clear requirements, acceptance criteria, and think in user stories. Balance user value with engineering effort.",
    },
    all: {
        name: "@all", title: "Full Team", icon: "🤝", color: BRAND, canWrite: true,
        persona: "You are a cross-functional team. For each task provide input from: Developer (implementation), Architect (design), Security (risks), QA (testing), PM (requirements). Be structured.",
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function askLine(rl, prompt) {
    return new Promise((resolve) => rl.question(prompt, resolve));
}

function buildProjectContext(scan) {
    const apis  = scan.routes.filter((r) => r.type === "api").slice(0, 15);
    const pages = scan.routes.filter((r) => r.type === "page").slice(0, 10);
    const crit  = scan.issues.filter((i) => i.severity === "critical").slice(0, 5);
    return [
        `PROJECT: ${scan.name} v${scan.version}`,
        `FRAMEWORK: ${scan.framework.name} | LANG: ${scan.framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `STACK: ${scan.tech.slice(0, 8).join(", ")}`,
        `FEATURES: ${scan.features.map((f) => f.name).join(", ")}`,
        `PAGES: ${pages.map((r) => r.path).join(", ")}`,
        `API: ${apis.map((r) => (r.method || "GET") + " " + r.path).join(", ")}`,
        `MODELS: ${scan.models.map((m) => m.name).join(", ") || "none"}`,
        `COMPONENTS: ${scan.components.slice(0, 10).map((c) => c.name).join(", ")}`,
        crit.length ? `CRITICAL ISSUES: ${crit.map((i) => i.message).join(" | ")}` : "",
    ].filter(Boolean).join("\n");
}

function readFileForContext(filePath, dir) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(dir, filePath);
    if (!fs.existsSync(abs)) return null;
    try {
        return fs.readFileSync(abs, "utf8")
            .replace(/(['"`])[A-Za-z0-9_\-]{20,}(['"`])/g, "$1[REDACTED]$2")
            .replace(/\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS)\s*=\s*[^\n]+/g, "[REDACTED]")
            .slice(0, 6000);
    } catch { return null; }
}

function extractFileMentions(task, dir) {
    const re = /@([\w./\-]+\.[a-zA-Z]+)/g;
    const files = [];
    let m;
    while ((m = re.exec(task)) !== null) {
        const content = readFileForContext(m[1], dir);
        if (content) files.push({ path: m[1], content });
    }
    return files;
}

// ── Code change parser & applier ──────────────────────────────────────────────

function parseCodeChanges(text) {
    const changes = [];
    const re = /---CHANGE START---\s*\nACTION:\s*(\w+)\s*\nFILE:\s*(.+?)\s*\n(?:```[^\n]*\n)?([\s\S]*?)(?:```\s*\n)?---CHANGE END---/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        changes.push({ action: m[1].toLowerCase().trim(), file: m[2].trim(), content: m[3].trim() });
    }
    if (changes.length === 0) {
        const fb = /(?:\/\/|#)\s*([\w./\-]+\.[a-z]+)\s*\n```[^\n]*\n([\s\S]*?)```/g;
        while ((m = fb.exec(text)) !== null) {
            changes.push({ action: "create", file: m[1].trim(), content: m[2].trim() });
        }
    }
    return changes;
}

async function applyChanges(changes, dir, rl) {
    if (!changes.length) return;
    console.log(`\n  ${BRAND.bold("📝 Code Changes")} ${DIM(`(${changes.length} file${changes.length > 1 ? "s" : ""})`)}`);
    for (const c of changes) {
        const abs = path.isAbsolute(c.file) ? c.file : path.join(dir, c.file);
        const exists = fs.existsSync(abs);
        const label = c.action === "delete" ? chalk.red("DELETE") : exists ? chalk.yellow("MODIFY") : chalk.green("CREATE");
        console.log(`\n  ${label}  ${chalk.bold(c.file)}`);
        if (c.action !== "delete" && c.content) {
            const lines = c.content.split("\n");
            lines.slice(0, 20).forEach((l) => console.log("  " + chalk.green("+ ") + DIM(l)));
            if (lines.length > 20) console.log(DIM(`  ... ${lines.length - 20} more lines`));
        }
    }
    const ans = await askLine(rl, `\n  ${BRAND("?")} Apply changes? ${DIM("(y/n)")} `);
    if (!ans.trim().toLowerCase().startsWith("y")) {
        console.log(DIM("  Skipped.\n")); return;
    }
    let written = 0;
    for (const c of changes) {
        const abs = path.isAbsolute(c.file) ? c.file : path.join(dir, c.file);
        try {
            if (c.action === "delete") {
                if (fs.existsSync(abs)) { fs.unlinkSync(abs); console.log(`  ${chalk.red("✗")} Deleted: ${c.file}`); }
            } else {
                fs.mkdirSync(path.dirname(abs), { recursive: true });
                fs.writeFileSync(abs, c.content + "\n");
                console.log(`  ${chalk.green("✓")} ${fs.existsSync(abs) ? "Updated" : "Created"}: ${chalk.bold(c.file)}`);
                written++;
            }
        } catch (e) { console.log(`  ${chalk.red("✗")} ${c.file} — ${e.message}`); }
    }
    if (written) console.log(DIM(`\n  ${written} file(s) written.\n`));
}

// ── URL fetcher ───────────────────────────────────────────────────────────────

async function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith("https") ? require("https") : require("http");
        const req = mod.get(url, { headers: { "User-Agent": "tas-audit/1.0" } }, (res) => {
            // Follow redirect
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchURL(res.headers.location).then(resolve).catch(reject);
            }
            let data = "";
            res.on("data", (c) => { data += c; });
            res.on("end", () => {
                // Strip HTML tags for cleaner context
                const text = data
                    .replace(/<script[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s{2,}/g, " ")
                    .trim()
                    .slice(0, 8000);
                resolve(text);
            });
        });
        req.on("error", reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error("URL fetch timed out")); });
    });
}

// ── Image loader (base64 for vision models) ───────────────────────────────────

function loadImageAsBase64(imagePath) {
    const abs = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
    if (!fs.existsSync(abs)) throw new Error(`Image not found: ${imagePath}`);
    const ext = path.extname(abs).toLowerCase().slice(1);
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext] || "image/png";
    const data = fs.readFileSync(abs).toString("base64");
    return { mime, data, path: abs };
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(member, scan, pinned, anchors = []) {
    const lines = [
        member.persona,
        pinned ? `\nADDITIONAL INSTRUCTIONS: ${pinned}` : "",
        anchors.length ? `\nCONTEXT ANCHORS (always remember): ${anchors.join(" | ")}` : "",
        "",
        "PROJECT CONTEXT (structured metadata — no raw source code):",
        buildProjectContext(scan),
        "",
        "CODE CHANGE FORMAT — use this for all file changes:",
        "---CHANGE START---",
        "ACTION: create|modify|delete",
        "FILE: relative/path/to/file.ext",
        "```",
        "// full file content",
        "```",
        "---CHANGE END---",
        "",
        `Language: ${scan.framework?.isTypeScript ? "TypeScript" : "JavaScript"}`,
        `Stack: ${scan.tech.slice(0, 6).join(", ")}`,
        "Be concise and actionable. Never include real secret values.",
    ];
    return lines.filter((l) => l !== undefined).join("\n");
}

// ── Dry run printer ───────────────────────────────────────────────────────────

function printDryRun(messages, config) {
    const total = messages.reduce((acc, m) => acc + m.content.length, 0);
    const estTokens = Math.ceil(total / 4);
    const { calcCost: cc, MODEL_COSTS } = require("../utils/cost");
    const pricing = MODEL_COSTS[config.model];
    const estCost = pricing ? cc(config.model, estTokens, estTokens * 1.5) : null;

    console.log(`\n  ${BRAND.bold("🔍 Dry Run — Prompt Preview")}\n`);
    console.log(`  ${DIM("Provider:")} ${config.provider}  ${DIM("Model:")} ${config.model || "(default)"}`);
    console.log(`  ${DIM("Est. input tokens:")} ~${estTokens.toLocaleString()}`);
    if (estCost) console.log(`  ${DIM("Est. cost:")} ~$${estCost.toFixed(4)}`);
    console.log(`\n  ${DIM("─".repeat(54))}`);
    for (const msg of messages) {
        const preview = msg.content.slice(0, 400).replace(/\n/g, "\n  ");
        console.log(`\n  ${chalk.bold("[" + msg.role + "]")}`);
        console.log("  " + DIM(preview) + (msg.content.length > 400 ? DIM("\n  ...") : ""));
    }
    console.log(`\n  ${DIM("─".repeat(54))}\n`);
}

// ── Main command ──────────────────────────────────────────────────────────────

async function teamCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    // ── Session log (npm-style: verbose → file, errors show path) ─────────────
    const logPath = initSessionLog();
    installGlobalErrorHandler();
    logVerbose("session-start", `dir=${dir} pid=${process.pid}`);

    // ── Load config (global + .tasrc + CLI opts) ───────────────────────────────
    let config = resolveConfig(dir, opts);

    if (!config.key) {
        console.log(chalk.yellow("\n  ✗ AI key required.\n"));
        console.log(`  Configure once: ${BRAND("npx tryappstack-audit ai-setup")}\n`);
        process.exit(1);
    }

    // ── Scan project ──────────────────────────────────────────────────────────
    process.stdout.write(DIM("  Scanning project... "));
    const scan = scanProject(dir);
    process.stdout.write(chalk.green("✓\n"));

    // ── Security guard: auto-.gitignore + credential scan ─────────────────
    runGitignoreGuard(dir);

    // ── Show config source ────────────────────────────────────────────────
    const aiStatus = getAIStatus();
    const providerLine = `${aiStatus.icon || "🤖"} ${config.provider} · ${config.model || "default"}`;
    console.log(`\n  ${BRAND.bold("◆ AI Team")} ${DIM("· " + providerLine)}`);
    if (config.rcSource) console.log(DIM(`  Config: ${config.rcSource} (.tasrc)`));
    console.log(DIM(`  ${scan.name} · ${scan.framework?.name || "JS"} · ${scan.scannedFiles} files\n`));

    // ── Pick team member ──────────────────────────────────────────────────────
    const memberList = Object.values(MEMBERS);
    memberList.forEach((m, i) => {
        console.log(`  ${DIM((i + 1) + ".")} ${m.icon}  ${m.color.bold(m.name.padEnd(12))} ${DIM(m.title)}`);
    });

    // ── Slash command tab-completion ────────────────────────────────────────
    const SLASH_COMMANDS = [
        "/help","/context","/clear","/compress","/anchor ","/anchors",
        "/remember ","/memory","/forget ","/confidence","/verify","/disagree",
        "/star","/starred","/search ","/digest",
        "/cost","/tag ","/cost-tags","/budget ","/benchmark",
        "/smart-route","/failover ",
        "/fetch ","/image ","/pin ","/unpin",
        "/save ","/load ","/prompts","/export ","/import ","/bundle",
        "/save-session ","/sessions","/resume ","/branch ",
        "/retry","/retry --temp=","/dry-run","/use ","/config",
        "/init-config","/security","/members",
    ];

    function slashCompleter(line) {
        if (!line.startsWith("/")) return [[], line];
        const hits = SLASH_COMMANDS.filter((c) => c.startsWith(line));
        return [hits.length ? hits : SLASH_COMMANDS, line];
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: slashCompleter,
    });

    // ── Resume session if --resume flag ──────────────────────────────────────
    let history = [];
    let pinned = config.pinned || null;
    let sessionName = null;
    let sessionCost = 0;
    let sessionTokens = 0;
    let sessionMessages = 0;
    let lastUserInput = "";
    let lastMessages = [];
    let pendingInjection = null; // URL/image content to inject into next message
    let contextAnchors   = [];   // always-kept facts (/anchor command)
    let activeTag        = null; // /tag label for cost tracking
    let confidenceMode   = false; // /confidence toggle
    let smartRoute       = false; // /smart-route toggle
    let fallbackConfigs  = [];   // /failover <provider> <key> <model>

    if (opts.resume) {
        const s = resumeSession(opts.resume);
        if (s) {
            history = s.history || [];
            pinned  = s.pinned || pinned;
            sessionName = s.name;
            sessionCost = s.totalCost || 0;
            sessionTokens = s.totalTokens || 0;
            sessionMessages = s.messages || 0;
            console.log(DIM(`\n  ↩ Resumed session: ${s.name} (${history.length} messages)\n`));
        } else {
            console.log(chalk.yellow(`  ⚠ Session "${opts.resume}" not found.\n`));
        }
    }

    const choice = await askLine(rl, `\n  ${BRAND(">")} Choose member (1-${memberList.length} or @name): `);
    const choiceClean = choice.trim().toLowerCase();
    let member = MEMBERS[choiceClean.replace("@", "")] ||
                 memberList[parseInt(choiceClean) - 1] ||
                 MEMBERS.dev;

    console.log(`\n  ${member.icon}  ${member.color.bold(member.name)} ${DIM(`(${member.title})`)} ${DIM("is ready")}`);

    if (pinned) console.log(`  ${DIM("📌 Pinned:")} ${DIM(pinned.slice(0, 60) + (pinned.length > 60 ? "..." : ""))}`);

    // Show memory status if exists
    {
        const { loadMemory } = require("../utils/memory");
        const mem = loadMemory(dir);
        if (mem) {
            const factCount = mem.split("\n").filter((l) => l.startsWith("-")).length;
            console.log(`  ${DIM("📌 tas-memory.md:")} ${DIM(factCount + " facts loaded · /memory to view · /remember to add")}`);
        }
    }

    console.log(DIM(`\n  Type /help for all commands. Ctrl+C mid-response to interrupt and redirect.\n`));

    let turn = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const raw = await askLine(rl, `  ${member.color(member.name)} ${BRAND("›")} `);
        const task = raw.trim();

        if (!task) continue;

        // ── Exit ───────────────────────────────────────────────────────────────
        if (task === "exit" || task === "quit" || task === "/exit") break;

        // ── Member switch ──────────────────────────────────────────────────────
        if (task.startsWith("@") && MEMBERS[task.slice(1).split(" ")[0]]) {
            const mk = task.slice(1).split(" ")[0];
            member = MEMBERS[mk];
            history.length = 0;
            console.log(`\n  ${member.icon}  Switched to ${member.color.bold(member.name)} ${DIM(`(${member.title})`)}\n`);
            continue;
        }

        // ── /help ──────────────────────────────────────────────────────────────
        if (task === "/help") {
            console.log(`\n  ${chalk.bold("Slash Commands")}\n`);
            const sections = [
                ["Context & Memory", [
                    ["/context",              "Show project context used in every prompt"],
                    ["/clear",                "Clear conversation history"],
                    ["/compress",             "Compress old messages to free context space"],
                    ["/anchor \"fact\"",       "Pin a fact that survives context compression"],
                    ["/anchors",              "List all context anchors"],
                    ["/remember \"fact\"",     "Save to tas-memory.md (persists across sessions)"],
                    ["/memory",               "Show tas-memory.md"],
                    ["/forget <text>",        "Remove a fact from memory"],
                ]],
                ["Trust & Verification", [
                    ["/confidence",           "Toggle confidence badge on every response"],
                    ["/verify",               "Fact-check last response with a second model"],
                    ["/disagree",             "Devil's advocate — argue against last answer"],
                ]],
                ["Search & Bookmarks", [
                    ["/star",                 "Bookmark the last response"],
                    ["/starred",              "Show bookmarked responses"],
                    ["/search <query>",       "Search all past conversations"],
                    ["/digest",               "Weekly digest of top starred responses"],
                ]],
                ["Cost & Routing", [
                    ["/cost",                 "Session cost + budget status"],
                    ["/compare-models",       "Cost across all models for last prompt"],
                    ["/tag <label>",          "Label next exchange for cost tracking"],
                    ["/cost-tags",            "Cost breakdown by tag"],
                    ["/budget daily=1 monthly=20", "Set budget limits"],
                    ["/smart-route",          "Toggle smart routing (cheap/fast vs powerful)"],
                    ["/failover <provider> <key> <model>", "Add fallback provider"],
                ]],
                ["Injection", [
                    ["/fetch <url>",          "Fetch URL content into next message"],
                    ["/image <path>",         "Load image for vision-capable models"],
                    ["/pin \"msg\"",           "Pin instruction to every request"],
                    ["/unpin",                "Remove pinned instruction"],
                ]],
                ["Prompts & Sessions", [
                    ["/save <name>",          "Save current input as reusable prompt"],
                    ["/load <name>",          "Load a saved prompt"],
                    ["/prompts",              "List saved prompts"],
                    ["/export <name>",        "Export prompts as .yaml"],
                    ["/import <file>",        "Import prompt pack"],
                    ["/bundle",               "Export memory+prompts+config (shareable)"],
                    ["/save-session <n>",     "Save session to disk"],
                    ["/sessions",             "List saved sessions"],
                    ["/resume <name>",        "Resume a saved session"],
                    ["/branch <name>",        "Fork session at current point"],
                ]],
                ["Control", [
                    ["/retry",                "Retry last prompt"],
                    ["/retry --temp=0.9",     "Retry with custom temperature"],
                    ["/dry-run",              "Preview prompt without sending"],
                    ["/use <profile>",        "Switch provider profile"],
                    ["/config",               "Show active config"],
                    ["/init-config",          "Create .tasrc in project (TAS per-project config)"],
                    ["/security",             "Show where TAS stores data + credential safety"],
                    ["/members",              "List team members"],
                    ["/benchmark",            "Model cost comparison"],
                ]],
            ];
            for (const [section, cmds] of sections) {
                console.log(`\n  ${chalk.bold(section)}`);
                for (const [cmd, desc] of cmds) {
                    console.log(`  ${BRAND(cmd.padEnd(36))} ${DIM(desc)}`);
                }
            }
            console.log("");
            continue;
        }

        // ── /context ───────────────────────────────────────────────────────────
        if (task === "/context") {
            const ctx = buildProjectContext(scan);
            console.log("\n" + ctx.split("\n").map((l) => "  " + DIM(l)).join("\n") + "\n");
            continue;
        }

        // ── /clear ────────────────────────────────────────────────────────────
        if (task === "/clear") {
            history.length = 0;
            console.log(DIM("  History cleared.\n"));
            continue;
        }

        // ── /members ──────────────────────────────────────────────────────────
        if (task === "/members") {
            memberList.forEach((m, i) => {
                console.log(`  ${DIM((i + 1) + ".")} ${m.icon} ${m.color.bold(m.name)} ${DIM(m.title)}`);
            });
            console.log("");
            continue;
        }

        // ── /config ───────────────────────────────────────────────────────────
        if (task === "/config") {
            printConfig(config);
            continue;
        }

        // ── /cost ─────────────────────────────────────────────────────────────
        if (task === "/cost") {
            printCostSummary(sessionCost, sessionTokens, sessionMessages);
            continue;
        }

        // ── /compare-models ───────────────────────────────────────────────────
        if (task === "/compare-models") {
            const inTok = lastMessages.reduce((a, m) => a + estimateTokens(m.content), 0);
            printModelComparison(inTok, Math.ceil(inTok * 1.2));
            continue;
        }

        // ── /budget ───────────────────────────────────────────────────────────
        if (task.startsWith("/budget ")) {
            const args = task.slice(8);
            const daily   = parseFloat(args.match(/daily=([0-9.]+)/)?.[1]);
            const monthly = parseFloat(args.match(/monthly=([0-9.]+)/)?.[1]);
            if (!isNaN(daily) || !isNaN(monthly)) {
                config.budget = config.budget || {};
                if (!isNaN(daily))   config.budget.daily   = daily;
                if (!isNaN(monthly)) config.budget.monthly = monthly;
                console.log(`\n  ${chalk.green("✓")} Budget set: daily $${config.budget.daily || "—"} · monthly $${config.budget.monthly || "—"}\n`);
            } else {
                console.log(DIM("  Usage: /budget daily=1.00 monthly=20.00\n"));
            }
            continue;
        }

        // ── /fetch ────────────────────────────────────────────────────────────
        if (task.startsWith("/fetch ")) {
            const url = task.slice(7).trim();
            const spinner = require("ora")({ text: `  Fetching ${url}...`, color: "cyan" }).start();
            try {
                const content = await fetchURL(url);
                spinner.succeed(`  Fetched ${url} (${content.length} chars)`);
                pendingInjection = `\nWEBPAGE CONTENT (${url}):\n${content}\n`;
                console.log(DIM(`  Content will be injected into your next message.\n`));
            } catch (e) {
                spinner.fail(`  Fetch failed: ${e.message}`);
            }
            continue;
        }

        // ── /image ────────────────────────────────────────────────────────────
        if (task.startsWith("/image ")) {
            const imgPath = task.slice(7).trim();
            try {
                const img = loadImageAsBase64(imgPath);
                pendingInjection = `\n[IMAGE: ${imgPath} — ${img.mime}, ${Math.round(img.data.length * 0.75 / 1024)}KB]\n(Image loaded for vision-capable models)\n`;
                console.log(chalk.green(`  ✓ Image loaded: ${imgPath} (${img.mime})\n`));
                console.log(DIM("  Note: Image will be referenced in your next message. Vision support depends on provider/model.\n"));
            } catch (e) {
                console.log(chalk.red(`  ✗ ${e.message}\n`));
            }
            continue;
        }

        // ── /pin ──────────────────────────────────────────────────────────────
        if (task.startsWith("/pin ")) {
            pinned = task.slice(5).trim().replace(/^["']|["']$/g, "");
            console.log(`\n  ${chalk.green("✓")} Pinned: ${DIM(pinned)}\n`);
            continue;
        }
        if (task === "/unpin") {
            pinned = null;
            console.log(DIM("  Pinned message removed.\n"));
            continue;
        }

        // ── /save (prompt) ────────────────────────────────────────────────────
        if (task.startsWith("/save ") && !task.startsWith("/save-session")) {
            const name = task.slice(6).trim();
            if (!lastUserInput) { console.log(DIM("  No input to save yet.\n")); continue; }
            const p = savePrompt(name, lastUserInput);
            console.log(chalk.green(`  ✓ Saved prompt "${name}" → ${p}\n`));
            continue;
        }

        // ── /load ─────────────────────────────────────────────────────────────
        if (task.startsWith("/load ")) {
            const name = task.slice(6).trim();
            const text = loadPrompt(name);
            if (!text) { console.log(chalk.yellow(`  ✗ Prompt "${name}" not found.\n`)); continue; }
            console.log(`\n  ${DIM("Loaded:")} ${text.slice(0, 80)}...\n  ${DIM("Send it? (y/n)")} `);
            const ans = await askLine(rl, "  ");
            if (ans.trim().toLowerCase().startsWith("y")) {
                history.push({ role: "user", content: text });
                lastUserInput = text;
            }
            continue;
        }

        // ── /prompts ──────────────────────────────────────────────────────────
        if (task === "/prompts") { printPrompts(); continue; }

        // ── /export ───────────────────────────────────────────────────────────
        if (task.startsWith("/export ")) {
            const name = task.slice(8).trim();
            const prompts = listPrompts();
            if (!prompts.length) { console.log(DIM("  No saved prompts to export.\n")); continue; }
            const pack = { name, description: "Exported from tas-audit team", prompts: prompts.map((p) => ({ id: p.name, text: loadPrompt(p.name) || "", description: "" })) };
            const out = exportPack(pack);
            console.log(chalk.green(`  ✓ Exported ${prompts.length} prompts → ${out}\n`));
            continue;
        }

        // ── /import ───────────────────────────────────────────────────────────
        if (task.startsWith("/import ")) {
            const file = task.slice(8).trim();
            try {
                const pack = importPack(path.resolve(file));
                const count = installPack(pack);
                console.log(chalk.green(`  ✓ Imported ${count} prompts from "${pack.name}"\n`));
            } catch (e) { console.log(chalk.red(`  ✗ ${e.message}\n`)); }
            continue;
        }

        // ── /save-session ─────────────────────────────────────────────────────
        if (task.startsWith("/save-session ")) {
            const name = task.slice(14).trim();
            const p = saveSession(name, { member: member.name, provider: config.provider, model: config.model, pinned, history, totalCost: sessionCost, totalTokens: sessionTokens, messages: sessionMessages, dir });
            sessionName = name;
            console.log(chalk.green(`  ✓ Session saved: ${name} → ${p}\n`));
            continue;
        }

        // ── /sessions ─────────────────────────────────────────────────────────
        if (task === "/sessions") { printSessions(); continue; }

        // ── /resume ───────────────────────────────────────────────────────────
        if (task.startsWith("/resume ")) {
            const name = task.slice(8).trim();
            const s = resumeSession(name);
            if (!s) { console.log(chalk.yellow(`  ✗ Session "${name}" not found.\n`)); continue; }
            history.length = 0;
            history.push(...(s.history || []));
            if (s.pinned) pinned = s.pinned;
            sessionName = name;
            console.log(chalk.green(`  ✓ Resumed "${name}" (${history.length} messages)\n`));
            continue;
        }

        // ── /branch ───────────────────────────────────────────────────────────
        if (task.startsWith("/branch ")) {
            const name = task.slice(8).trim();
            const p = branchSession({ member: member.name, provider: config.provider, model: config.model, pinned, history, totalCost: sessionCost, totalTokens: sessionTokens, messages: sessionMessages, dir, name: sessionName }, name);
            console.log(chalk.green(`  ✓ Branch "${name}" created from message ${history.length}\n`));
            console.log(DIM(`  Use /resume ${name} to switch to it.\n`));
            continue;
        }

        // ── /retry ────────────────────────────────────────────────────────────
        if (task.startsWith("/retry")) {
            if (!lastMessages.length) { console.log(DIM("  Nothing to retry.\n")); continue; }
            const tempMatch = task.match(/--temp=([0-9.]+)/);
            if (tempMatch) config.temperature = parseFloat(tempMatch[1]);
            // Remove last assistant reply and re-send
            if (history.length >= 2 && history[history.length - 1].role === "assistant") {
                history.pop();
            }
            console.log(DIM(`  Retrying${tempMatch ? ` with temperature=${config.temperature}` : ""}...\n`));
            // Fall through to send — use lastMessages (system prompt already built)
        }

        // ── /dry-run ──────────────────────────────────────────────────────────
        else if (task === "/dry-run") {
            if (!lastMessages.length) { console.log(DIM("  Send a message first.\n")); continue; }
            printDryRun(lastMessages, config);
            continue;
        }

        // ── /use <profile> ────────────────────────────────────────────────────
        else if (task.startsWith("/use ")) {
            const profileName = task.slice(5).trim();
            const updated = applyProfile(config, profileName);
            if (!updated) {
                console.log(chalk.yellow(`  ✗ Profile "${profileName}" not found in .tasrc\n`));
                const profiles = listProfiles(config);
                if (profiles.length) console.log(DIM("  Available: " + profiles.map((p) => p.name).join(", ") + "\n"));
            } else {
                config = updated;
                console.log(`\n  ${chalk.green("✓")} Profile "${profileName}" active: ${config.provider} · ${config.model || "default"}\n`);
            }
            continue;
        }

        // ── /init-config ────────────────────────────────────────────────────────
        else if (task === "/init-config") {
            const rcPath = createTasRC(dir, config);
            console.log(chalk.green(`  ✓ Created ${rcPath}\n`));
            console.log(DIM("  Edit .tasrc to set model, budget, profiles, and pinned instructions.\n"));
            console.log(DIM("  Note: API keys are never stored in .tasrc — use env vars or ai-setup.\n"));
            continue;
        }

        // ── /security ────────────────────────────────────────────────────────
        else if (task === "/security") {
            printStoragePolicy();
            const { runGitignoreGuard: recheck } = require("../utils/gitignore");
            const { secretIssues } = recheck(dir);
            if (!secretIssues.length) {
                console.log(chalk.green("  ✓ No credential issues detected in project files.\n"));
            }
            continue;
        }

        // ── /benchmark ────────────────────────────────────────────────────────
        else if (task === "/benchmark") {
            if (!lastMessages.length) { console.log(DIM("  Send a message first to benchmark against.\n")); continue; }
            const inTok = lastMessages.reduce((a, m) => a + estimateTokens(m.content), 0);
            printModelComparison(inTok, Math.ceil(inTok * 1.5));
            continue;
        }

        // ── /remember ────────────────────────────────────────────────────────
        else if (task.startsWith("/remember ")) {
            const fact = task.slice(10).trim().replace(/^"|"$/g, "");
            const p = remember(dir, fact);
            console.log(chalk.green(`  ✓ Remembered: ${fact}`) + DIM(` → ${p}\n`));
            continue;
        }

        // ── /memory ───────────────────────────────────────────────────────────
        else if (task === "/memory") {
            printMemory(dir);
            continue;
        }

        // ── /forget ───────────────────────────────────────────────────────────
        else if (task.startsWith("/forget ")) {
            const match = task.slice(8).trim();
            const removed = forget(dir, match);
            console.log(removed ? chalk.green(`  ✓ Removed from memory\n`) : chalk.yellow(`  ✗ No match found\n`));
            continue;
        }

        // ── /anchor ───────────────────────────────────────────────────────────
        else if (task.startsWith("/anchor ")) {
            const fact = task.slice(8).trim().replace(/^"|"$/g, "");
            contextAnchors.push(fact);
            console.log(chalk.green(`  ✓ Anchored: ${fact}`) + DIM(` (survives compression)\n`));
            continue;
        }
        else if (task === "/anchors") {
            printAnchors(contextAnchors);
            continue;
        }

        // ── /compress ────────────────────────────────────────────────────────
        else if (task === "/compress") {
            const before = history.length;
            const result = compressContext(history, contextAnchors);
            if (result.compressed) {
                history.length = 0;
                history.push(...result.messages.filter(m => m.role !== "system"));
                console.log(chalk.green(`  ✓ Compressed ${before} → ${history.length} messages`) + DIM(` (saved ~${result.savedTokens} tokens)\n`));
            } else {
                console.log(DIM("  History too short to compress.\n"));
            }
            continue;
        }

        // ── /confidence ───────────────────────────────────────────────────────
        else if (task === "/confidence") {
            confidenceMode = !confidenceMode;
            console.log(`  ${confidenceMode ? chalk.green("✓ Confidence mode ON") : DIM("Confidence mode OFF")}\n`);
            continue;
        }

        // ── /verify ───────────────────────────────────────────────────────────
        else if (task === "/verify") {
            const lastAI = [...history].reverse().find(m => m.role === "assistant");
            const lastUser = [...history].reverse().find(m => m.role === "user");
            if (!lastAI) { console.log(DIM("  Nothing to verify.\n")); continue; }
            printVerifyHeader(config.provider);
            const verifyMsgs = buildVerifyMessages(lastUser?.content || "(unknown question)", lastAI.content);
            try {
                process.stdout.write("  ");
                await streamAI(verifyMsgs, { aiProvider: config.provider, aiKey: config.key, aiModel: config.model }, {
                    onToken: (t) => { const ls = t.split("\n"); ls.forEach((l, i) => { process.stdout.write(l); if (i < ls.length - 1) process.stdout.write("\n  "); }); },
                });
                process.stdout.write("\n\n");
            } catch (e) { logError(e, "/verify"); }
            continue;
        }

        // ── /disagree ────────────────────────────────────────────────────────
        else if (task === "/disagree") {
            const lastAI = [...history].reverse().find(m => m.role === "assistant");
            const lastUser = [...history].reverse().find(m => m.role === "user");
            if (!lastAI) { console.log(DIM("  Nothing to argue against.\n")); continue; }
            printDisagreeHeader(config.provider);
            const disaMs = buildDisagreeMessages(lastUser?.content || "(unknown question)", lastAI.content);
            try {
                process.stdout.write("  ");
                await streamAI(disaMs, { aiProvider: config.provider, aiKey: config.key, aiModel: config.model }, {
                    onToken: (t) => { const ls = t.split("\n"); ls.forEach((l, i) => { process.stdout.write(l); if (i < ls.length - 1) process.stdout.write("\n  "); }); },
                });
                process.stdout.write("\n\n");
            } catch (e) { logError(e, "/disagree"); }
            continue;
        }

        // ── /star ─────────────────────────────────────────────────────────────
        else if (task === "/star") {
            const lastAI = [...history].reverse().find(m => m.role === "assistant");
            if (!lastAI) { console.log(DIM("  Nothing to star.\n")); continue; }
            const id = starMessage(lastAI.content, sessionName, { tag: activeTag });
            console.log(chalk.green(`  ✓ Starred #${id}\n`));
            continue;
        }
        else if (task === "/starred") { printStarred(); continue; }
        else if (task === "/digest")  { printWeeklyDigest(); continue; }

        // ── /search ───────────────────────────────────────────────────────────
        else if (task.startsWith("/search ")) {
            const query = task.slice(8).trim();
            const results = search(query);
            printSearchResults(results, query);
            continue;
        }

        // ── /tag ──────────────────────────────────────────────────────────────
        else if (task.startsWith("/tag ")) {
            activeTag = task.slice(5).trim();
            console.log(`  ${chalk.cyan("🏷")} Next exchange tagged as: ${BRAND(activeTag)}\n`);
            continue;
        }
        else if (task === "/cost-tags") { printCostTags(); continue; }

        // ── /smart-route ──────────────────────────────────────────────────────
        else if (task === "/smart-route") {
            smartRoute = !smartRoute;
            console.log(`  ${smartRoute ? chalk.green("✓ Smart routing ON") : DIM("Smart routing OFF")} — ${DIM(smartRoute ? "simple→cheap, complex→powerful" : "always uses primary config")}\n`);
            continue;
        }

        // ── /failover ─────────────────────────────────────────────────────────
        else if (task.startsWith("/failover ")) {
            const parts = task.slice(10).trim().split(/\s+/);
            if (parts.length >= 2) {
                fallbackConfigs.push({ provider: parts[0], key: parts[1], model: parts[2] || "" });
                console.log(chalk.green(`  ✓ Failover added: ${parts[0]} ${parts[2] || ""}\n`));
            } else { console.log(DIM("  Usage: /failover <provider> <key> [model]\n")); }
            continue;
        }

        // ── /bundle ───────────────────────────────────────────────────────────
        else if (task === "/bundle") {
            const prompts = listPrompts().map(p => ({ id: p.name, text: loadPrompt(p.name) || "", description: "" }));
            const p = exportBundle(dir, config, prompts);
            console.log(chalk.green(`  ✓ tas-bundle.json → ${p}`) + DIM(" (share freely — no API keys included)\n"));
            continue;
        }

        // ── Regular task ───────────────────────────────────────────────────────
        let userContent = task;

        // Inject pending URL/image content
        if (pendingInjection) {
            userContent = task + pendingInjection;
            pendingInjection = null;
        }

        // Expand @file mentions
        const fileMentions = extractFileMentions(task, dir);
        if (fileMentions.length) {
            userContent += "\n\n" + fileMentions.map((f) => `FILE CONTENT (${f.path}):\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        }

        lastUserInput = task;
        history.push({ role: "user", content: userContent });

        // Build message array — inject project memory into system prompt
        const sysPrompt = buildSystemPrompt(member, scan, pinned, contextAnchors);
        let messages = [
            { role: "system", content: sysPrompt },
            ...history.slice(-10),
        ];
        messages = injectMemoryIntoMessages(messages, dir);
        lastMessages = messages;

        // ── Context window meter ───────────────────────────────────────────────
        const ctxUsage = getContextUsage(messages, config.model);
        if (ctxUsage.status !== "ok") {
            console.log(renderContextMeter(ctxUsage));
        }
        if (ctxUsage.status === "compress") {
            console.log(DIM("  Auto-compressing context..."));
            const compressed = compressContext(history, contextAnchors);
            if (compressed.compressed) {
                history.length = 0;
                history.push(...compressed.messages.filter(m => m.role !== "system"));
                messages = [{ role: "system", content: sysPrompt }, ...history.slice(-10)];
                messages = injectMemoryIntoMessages(messages, dir);
                lastMessages = messages;
                console.log(DIM(`  Saved ~${compressed.savedTokens} tokens\n`));
            }
        }
        if (ctxUsage.status === "danger") {
            const ans = await askLine(rl, `  ${chalk.red("⚠")} Context at ${Math.round(ctxUsage.pct * 100)}%. Continue anyway? ${DIM("(y/n)")} `);
            if (!ans.trim().toLowerCase().startsWith("y")) { history.pop(); continue; }
        }

        // ── Budget check ──────────────────────────────────────────────────────
        const estInputTok = messages.reduce((a, m) => a + estimateTokens(m.content), 0);
        const estCost = calcCost(config.model, estInputTok, estInputTok);
        const budgetCheck = checkBudget(config.budget, estCost);
        if (!budgetCheck.ok && budgetCheck.blocked) {
            console.log(`\n  ${chalk.red("✗")} ${budgetCheck.message}\n`);
            history.pop();
            continue;
        }
        if (budgetCheck.warnings?.length) {
            for (const w of budgetCheck.warnings) console.log(`  ${chalk.yellow(w)}`);
        }

        // ── Dry run mode (--dry-run flag) ─────────────────────────────────────
        if (opts.dryRun) {
            printDryRun(messages, config);
            history.pop();
            continue;
        }

        // ── Smart routing ─────────────────────────────────────────────────────
        let activeConfig = config;
        if (smartRoute && fallbackConfigs.length > 0) {
            const complexity = classifyQuery(userContent);
            activeConfig = routeByComplexity(complexity, config, fallbackConfigs);
            printRoutingInfo(complexity, activeConfig);
        }

        // Apply confidence request if mode is on
        let sendMessages = confidenceMode ? withConfidenceRequest(messages) : messages;

        // ── Stream response ───────────────────────────────────────────────────
        console.log(`\n  ${member.icon} ${member.color.bold(member.name)}:\n`);

        const streamOpts = {
            aiProvider: activeConfig.provider,
            aiKey:      activeConfig.key,
            aiModel:    activeConfig.model,
            temperature: config.temperature ?? 0.3,
        };

        let streamResult;
        const startTime = Date.now();

        const streamCallbacks = {
            onToken: (t) => {
                const lines = t.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    process.stdout.write(lines[i]);
                    if (i < lines.length - 1) process.stdout.write("\n  ");
                }
            },
            onInterrupt: () => { process.stdout.write("\n"); },
        };

        try {
            process.stdout.write("  ");
            if (fallbackConfigs.length > 0 && !smartRoute) {
                // Failover mode: try primary then fallbacks
                streamResult = await callWithFailover(streamAI, sendMessages, streamOpts,
                    fallbackConfigs.map(f => ({ ...f, temperature: config.temperature ?? 0.3 })),
                    streamCallbacks, streamOpts);
            } else {
                streamResult = await streamAI(sendMessages, streamOpts, streamCallbacks);
            }
        } catch (err) {
            logError(err, "stream");
            history.pop();
            continue;
        }

        process.stdout.write("\n");

        // ── Handle interruption ───────────────────────────────────────────────
        if (streamResult.interrupted) {
            history.pop();
            const redirect = await askLine(rl, `\n  ${chalk.yellow("↩  Redirected?")} ${DIM("(type new instruction or press Enter to skip)")} `);
            if (redirect.trim()) {
                history.push({ role: "user", content: redirect.trim() });
                lastUserInput = redirect.trim();
            }
            console.log("");
            continue;
        }

        // Strip confidence line from visible response
        let response = streamResult.text;
        let confidence = null;
        if (confidenceMode) {
            confidence = parseConfidence(response);
            response = stripConfidenceLine(response);
        }
        history.push({ role: "assistant", content: response });

        // ── Cost tracking ─────────────────────────────────────────────────────
        const inputTok  = streamResult.inputTokens  || estInputTok;
        const outputTok = streamResult.outputTokens || estimateTokens(response);
        const msgCost   = calcCost(config.model, inputTok, outputTok);
        const latencyMs = streamResult.totalMs || (Date.now() - startTime);
        const ttftMs    = streamResult.ttft;

        sessionCost    += msgCost;
        sessionTokens  += inputTok + outputTok;
        sessionMessages++;
        turn++;

        const totals = recordUsage(msgCost, inputTok + outputTok);

        // ── Log AI turn to file (verbose) ─────────────────────────────────────
        logAITurn(messages, response, { provider: activeConfig.provider, model: activeConfig.model, inputTokens: inputTok, outputTokens: outputTok, cost: msgCost, latencyMs, ttft: ttftMs });

        // ── Index message for /search ─────────────────────────────────────────
        indexMessage(sessionName, "assistant", response, { tag: activeTag, cost: msgCost });
        indexMessage(sessionName, "user", userContent, { tag: activeTag });

        // ── Tag cost tracking ─────────────────────────────────────────────────
        if (activeTag) {
            recordTagCost(activeTag, msgCost, inputTok + outputTok);
            activeTag = null; // tag consumed after one exchange
        }

        // ── Inline cost + context meter ───────────────────────────────────────
        const newCtx = getContextUsage([
            { role: "system", content: buildSystemPrompt(member, scan, pinned, contextAnchors) },
            ...history.slice(-10),
        ], config.model);

        console.log("\n  " + formatCostLine(msgCost, inputTok, outputTok, latencyMs, ttftMs));
        if (newCtx.status !== "ok") console.log(renderContextMeter(newCtx));

        // ── Confidence badge ──────────────────────────────────────────────────
        if (confidence) console.log(renderConfidenceBadge(confidence));

        // ── Hallucination risk flags ──────────────────────────────────────────
        const riskFlags = flagHighRiskContent(response);
        const riskLine  = renderRiskFlags(riskFlags);
        if (riskLine) console.log(riskLine);

        // Budget warning after spend
        if (config.budget) {
            const pct = config.budget.daily ? (totals.today.cost / config.budget.daily) * 100 : 0;
            if (pct >= 90) console.log(`  ${chalk.red("⚠")} Daily budget at ${pct.toFixed(0)}% ($${totals.today.cost.toFixed(4)} / $${config.budget.daily})`);
        }

        console.log("");

        // ── Apply code changes ────────────────────────────────────────────────
        if (member.canWrite) {
            const changes = parseCodeChanges(response);
            if (changes.length) await applyChanges(changes, dir, rl);
        }

        // ── Milestone nudges ──────────────────────────────────────────────────
        if (turn === 10) console.log(DIM("  ⭐ Enjoying tas-audit? Star us → github.com/Dushyant-Khoda/tryappstack-audit\n"));
        if (sessionCost > 0.50 && turn % 5 === 0) console.log(DIM(`  💡 /compare-models to find cheaper options · /smart-route to auto-route\n`));
    }

    // ── Exit ──────────────────────────────────────────────────────────────────
    rl.close();

    // Auto-save session if named
    if (sessionName) {
        saveSession(sessionName, { member: member.name, provider: config.provider, model: config.model, pinned, history, totalCost: sessionCost, totalTokens: sessionTokens, messages: sessionMessages, dir });
        console.log(DIM(`\n  Session auto-saved: ${sessionName}`));
    }

    // Show final context meter
    if (history.length > 0) {
        const finalCtx = getContextUsage([{ role: "system", content: "" }, ...history], config.model);
        console.log(renderContextMeter(finalCtx));
    }

    printCostSummary(sessionCost, sessionTokens, sessionMessages);
    closeSessionLog({ messages: sessionMessages, cost: sessionCost, turns: turn });
    console.log(`  ${BRAND("◆")} ${DIM("Built with ❤️ for developers who ship — tryappstack-audit")}\n`);
}

module.exports = teamCommand;
