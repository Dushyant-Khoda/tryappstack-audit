/**
 * Centralized CLI log messages for TryAppStack Audit.
 *
 * Every user-facing string lives here. Commands import what they need
 * instead of scattering inline strings across the codebase.
 */

// ── Prefixes ────────────────────────────────────────────────────────
const PREFIX = {
    SUCCESS: "  + ",
    WARN: "  warn ",
    ERROR: "  error ",
    INFO: "  > ",
    ITEM: "    - ",
};

// ── Generic ─────────────────────────────────────────────────────────
const GENERIC = {
    NOT_A_PROJECT: "No package.json found. Run inside a JS/TS project.",
    NOT_A_GIT_REPO: "Not a git repository.",
    BASH_NOT_FOUND: "Bash not available. Using JS engine fallback.",
    FILE_NOT_FOUND: (name) => `${name} not found.`,
};

// ── Audit ───────────────────────────────────────────────────────────
const AUDIT = {
    DETECTING: "Detecting framework...",
    RUNNING_MODULE: (name) => `Auditing ${name}...`,
    AI_ANALYZING: "Running AI analysis...",
    GENERATING_REPORT: "Generating report...",
    REPORT_SAVED: (path) => `Report saved: ${path}`,
    STRICT_PASS: (score, threshold) => `PASSED: ${score} ≥ ${threshold}`,
    STRICT_FAIL: (score, threshold) => `FAILED: ${score} < ${threshold}`,
    PRE_PUSH_BLOCKED: "Push blocked. Fix issues and try again.",
    PRE_PUSH_HINT: "Run 'npx tas-audit' for full report. Skip: git push --no-verify",
};

// ── Init ────────────────────────────────────────────────────────────
const INIT = {
    CREATED_CONFIG: "Created .auditrc",
    CREATED_AUDITS: "Created audits/",
    SETUP_COMPLETE: "Setup complete!",
    RUN_HINT: "npx tas-audit",
};

// ── AI ──────────────────────────────────────────────────────────────
const AI = {
    TITLE: "AI Agent Setup",
    DESCRIPTION: "AI analyzes your audit scores and gives specific refactoring advice.",
    SECURITY_NOTE: "Only scores & issue names are sent — never your source code.",
    SAVED: "Saved to ~/.tryappstack/config (chmod 600)",
    RUN_HINT: "npx tryappstack-audit --ai",
    NO_KEY: "AI skipped — no API key. Run: npx tryappstack-audit ai-setup",
    REQUIRES_CURL: "curl required for AI features.",
    REQUIRES_JQ: "jq required for AI features. Install: sudo apt install jq",
    UNAVAILABLE: "AI analysis unavailable. Check your API key and provider.",
};

// ── Providers ───────────────────────────────────────────────────────
const PROVIDERS = [
    { name: "🟣 Claude (Anthropic)    — best for code analysis", value: "claude", url: "https://console.anthropic.com/settings/keys" },
    { name: "🟢 GPT-4o (OpenAI)      — strong all-rounder", value: "openai", url: "https://platform.openai.com/api-keys" },
    { name: "🔵 Grok (xAI)           — fast & uncensored", value: "grok", url: "https://console.x.ai/team/default/api-keys" },
    { name: "🟡 Gemini (Google)      — good for large context", value: "gemini", url: "https://aistudio.google.com/apikey" },
    { name: "🔴 DeepSeek             — budget-friendly", value: "deepseek", url: "https://platform.deepseek.com/api_keys" },
];

// ── Fix ─────────────────────────────────────────────────────────────
const FIX = {
    TITLE: "Auto-Fix",
    CREATED_BARREL: (path, count) => `Created ${path} (${count} exports)`,
    CREATED_FILE: (name) => `Created ${name}`,
    ADDED_GITIGNORE: (pattern) => `Added ${pattern} to .gitignore`,
    SUMMARY: (count) => `${count} fixes applied.`,
    REVIEW_HINT: "Review: git diff",
};

// ── Doctor ──────────────────────────────────────────────────────────
const DOCTOR = {
    TITLE: "TryAppStack Doctor",
    REQUIRED: "required",
    OPTIONAL: "optional",
    AI_CONFIGURED: (provider) => `AI agent: ${provider}`,
    AI_NOT_CONFIGURED: "AI not configured — run: npx tryappstack-audit ai-setup",
    TAS_INSTALLED: "tryappstack (boilerplate CLI)",
    TAS_HINT: "npm i -g tryappstack for boilerplates",
};

// ── AI-powered commands (require AI key) ────────────────────────────
const AI_COMMANDS = {
    PLAN: {
        cmd: "npx tryappstack-audit ai-plan",
        short: "ai-plan",
        description: "2-week sprint refactoring plan saved to audits/",
    },
    CHAT: {
        cmd: "npx tryappstack-audit ai-chat",
        short: "ai-chat",
        description: "Interactive Q&A about your audit — ask anything",
    },
    ESTIMATE: {
        cmd: "npx tryappstack-audit ai-estimate",
        short: "ai-estimate",
        description: "Tech debt hours & cost breakdown by module",
    },
    REVIEW: {
        cmd: "npx tryappstack-audit ai-review <file>",
        short: "ai-review",
        description: "Deep review of a specific file with before/after code",
    },
};

// ── Comparison table ────────────────────────────────────────────────
const AI_COMPARISON = {
    WITHOUT: [
        "✓ 16 audit modules",
        "✓ Scores & grades",
        "✓ .md report auto-saved",
        "✓ Pre-push git gate",
        "✓ Auto-fix + watch mode",
        "✓ Score trend history",
        "Free forever",
    ],
    WITH: [
        "✓ Everything in free",
        "✓ ai-plan → sprint roadmap",
        "✓ ai-chat → ask your audit",
        "✓ ai-estimate → hours & cost",
        "✓ ai-review → file deep dive",
        "✓ Score improvement roadmap",
        "~$0.01/run, your key",
    ],
};

module.exports = {
    PREFIX,
    GENERIC,
    AUDIT,
    INIT,
    AI,
    PROVIDERS,
    FIX,
    DOCTOR,
    AI_COMMANDS,
    AI_COMPARISON,
};
