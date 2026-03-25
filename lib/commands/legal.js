/**
 * tas-audit legal
 * Legal & Compliance Auditor — GDPR, CCPA, ToS, Privacy Policy, data handling
 *
 * ⚠️  NOT legal advice. Consult a qualified lawyer before publishing legal documents.
 *      This tool scans code structure only. No source code or env vars are sent to AI.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const { scanProject } = require("../core/scanner");
const { callAI, getProviderName } = require("../ai/runner");
const { loadAIConfig } = require("../utils/helpers");

const BRAND = chalk.hex("#c8ff00");

const LEGAL_DISCLAIMER =
    "\n  ⚠️  NOT LEGAL ADVICE. This is an AI-generated compliance checklist.\n" +
    "  Consult a qualified attorney before publishing legal documents or handling user data.\n";

// Static checks that don't need AI
function _staticLegalChecks(scan) {
    const checks = [];
    const { features, envVars, framework } = scan;
    const deps = scan.dependencies;

    // Data collection indicators
    const collectsEmail    = deps.includes("nodemailer") || deps.includes("resend") || deps.includes("@sendgrid/mail") ||
                             envVars.some((e) => e.name.includes("EMAIL") || e.name.includes("SMTP"));
    const collectsPayments = features.some((f) => f.name === "Payments");
    const hasAuth          = features.some((f) => f.name === "Authentication");
    const hasDB            = features.some((f) => f.name === "Database ORM");
    const hasAnalytics     = features.some((f) => f.name === "Analytics");
    const hasFileUploads   = features.some((f) => f.name === "File Uploads");
    const hasRealtime      = features.some((f) => f.name === "Real-time");
    const hasAI            = features.some((f) => f.name === "AI Integration");

    // Privacy Policy requirements
    const privacyNeeds = [];
    if (hasAuth)          privacyNeeds.push({ item: "User account data collection & retention policy", severity: "critical" });
    if (collectsEmail)    privacyNeeds.push({ item: "Email address collection and marketing consent (CAN-SPAM / GDPR)", severity: "critical" });
    if (collectsPayments) privacyNeeds.push({ item: "Payment data handling (PCI-DSS compliance reference)", severity: "critical" });
    if (hasDB)            privacyNeeds.push({ item: "Data storage location, retention period, deletion policy", severity: "critical" });
    if (hasAnalytics)     privacyNeeds.push({ item: "Analytics and tracking disclosure (GDPR cookie consent)", severity: "warning" });
    if (hasFileUploads)   privacyNeeds.push({ item: "User-uploaded content: ownership, storage, moderation policy", severity: "warning" });
    if (hasAI)            privacyNeeds.push({ item: "AI data processing disclosure — what data is sent to AI providers", severity: "critical" });
    if (hasRealtime)      privacyNeeds.push({ item: "Real-time data: what is logged, retained, monitored", severity: "warning" });

    // Missing legal files
    const missingFiles = [];
    if (!fs.existsSync(path.join(scan._dir || ".", "LICENSE"))) {
        missingFiles.push({ item: "LICENSE file missing — open source code needs explicit license", severity: "warning" });
    }

    // Cookie consent
    const needsCookieConsent = hasAnalytics || deps.includes("next-auth") || deps.includes("@clerk/nextjs");

    // GDPR indicators
    const euRelevant = hasAuth || collectsEmail || hasDB;

    return {
        privacyNeeds,
        missingFiles,
        needsCookieConsent,
        euRelevant,
        collectsPayments,
        hasAuth,
        collectsEmail,
        hasAI,
        hasAnalytics,
        hasDB,
    };
}

async function legalCommand(directory, opts) {
    const dir = path.resolve(directory);

    if (!fs.existsSync(path.join(dir, "package.json"))) {
        console.log(chalk.red("\n  ✗ No package.json found. Run inside a JS/TS project.\n"));
        process.exit(1);
    }

    const { key } = loadAIConfig(opts);
    const hasAI = !!key;
    const providerName = hasAI ? getProviderName(opts) : null;

    console.log(
        `\n  ${chalk.bold("⚖️  Legal & Compliance Audit")} ` +
        (hasAI ? chalk.dim(`· ${providerName}`) : chalk.dim("· static analysis (add AI key for full compliance report)"))
    );
    console.log(chalk.red.bold("  ⚠️  NOT LEGAL ADVICE. Consult a qualified attorney.\n"));

    const spinner = ora({ text: "  Scanning project...", color: "yellow" }).start();
    const scan = scanProject(dir);
    scan._dir = dir; // pass dir for file checks
    spinner.stop();

    const checks = _staticLegalChecks(scan);
    const { framework, tech, features } = scan;

    // Display static findings immediately
    console.log(`  ${chalk.bold("Framework:")} ${framework.name}  ${chalk.bold("Features:")} ${features.map((f) => f.name).join(", ") || "none"}\n`);

    if (checks.privacyNeeds.length > 0) {
        console.log(`  ${chalk.red.bold("📋 Privacy Policy Requirements")}`);
        for (const item of checks.privacyNeeds) {
            const icon = item.severity === "critical" ? chalk.red("✗") : chalk.yellow("!");
            console.log(`  ${icon} ${item.item}`);
        }
        console.log("");
    }

    const riskItems = [];
    if (checks.euRelevant)        riskItems.push(chalk.yellow("⚠ GDPR") + chalk.dim(" — collecting EU user data"));
    if (checks.collectsEmail)     riskItems.push(chalk.yellow("⚠ CAN-SPAM/CASL") + chalk.dim(" — email marketing consent needed"));
    if (checks.collectsPayments)  riskItems.push(chalk.yellow("⚠ PCI-DSS") + chalk.dim(" — payment data compliance"));
    if (checks.needsCookieConsent)riskItems.push(chalk.yellow("⚠ Cookie Consent") + chalk.dim(" — analytics/auth cookies"));
    if (checks.hasAI)             riskItems.push(chalk.yellow("⚠ AI Data Processing") + chalk.dim(" — disclosure required"));

    if (riskItems.length > 0) {
        console.log(`  ${chalk.bold("⚖️  Compliance Flags")}`);
        for (const item of riskItems) console.log("  " + item);
        console.log("");
    }

    // AI-enhanced report
    let aiSection = "";
    if (hasAI) {
        const aiSpinner = ora({ text: `  ${providerName} generating full compliance report...`, color: "yellow" }).start();

        const ctx = [
            `Framework: ${framework.name} | ${framework.isTypeScript ? "TypeScript" : "JavaScript"}`,
            `Tech: ${tech.join(", ")}`,
            `Features: ${features.map((f) => f.name + (f.detail ? ` (${f.detail})` : "")).join(", ")}`,
            `Collects emails: ${checks.collectsEmail}`,
            `Has auth/user accounts: ${checks.hasAuth}`,
            `Processes payments: ${checks.collectsPayments}`,
            `Has analytics: ${checks.hasAnalytics}`,
            `Uses AI: ${checks.hasAI}`,
            `Has file uploads: ${features.some((f) => f.name === "File Uploads")}`,
            `DB storage: ${checks.hasDB}`,
        ].join("\n");

        const prompt = `You are a legal compliance expert specialising in SaaS / tech startups.

⚠️ IMPORTANT: You are NOT providing legal advice. You are generating a compliance checklist and template starting points.
Always remind the user to consult a qualified attorney.

PROJECT CONTEXT (code structure only, no source code):
${ctx}

Generate a legal compliance report with EXACT sections:

---

## ✅ Legal Documents Required
Based on the detected features, list every legal document this product needs:
| Document | Priority | Why needed | Applies to |
|----------|----------|------------|------------|

## 🔐 GDPR Compliance Checklist (if EU users expected)
- [ ] Privacy policy in plain language
- [ ] Cookie consent mechanism
- [ ] Data deletion ("right to be forgotten") endpoint
- [ ] Data portability (export user data)
- [ ] ... (continue based on detected features)
Mark each as: ✅ Likely covered | ⚠️ Needs attention | ❌ Not detected

## 🇺🇸 US Compliance (CCPA / CAN-SPAM)
Relevant checkboxes based on detected features.

## 💳 Payment Compliance
${checks.collectsPayments ? "PCI-DSS requirements for Stripe integration. What Stripe handles vs what you must handle." : "No payment processing detected."}

## 🤖 AI Data Processing Disclosure
${checks.hasAI ? "Required disclosures when user data touches AI APIs. What to include in your privacy policy." : "No AI processing detected."}

## 📝 Terms of Service — Key Clauses
For this type of product, the ToS MUST include:
1. Acceptable use policy
2. ... (list all critical clauses specific to the detected features)

## 🚀 Quick Start — Privacy Policy Template
A minimal privacy policy template that covers the detected data collection.
(Mark all placeholder sections clearly with [YOUR COMPANY], [DATE], etc.)

---
⚠️ REMINDER: This is a starting point only. Have a qualified attorney review before publishing.`;

        try {
            aiSection = await callAI([{ role: "user", content: prompt }], opts);
            aiSpinner.stop();
            console.log(`\n  ${BRAND.bold("⚖️  Compliance Report")} ${chalk.dim(`· ${providerName}`)}\n`);
            console.log(aiSection.split("\n").map((l) => "  " + l).join("\n"));
        } catch (err) {
            aiSpinner.stop();
            if (!err.noKey) console.log(chalk.dim(`  AI unavailable: ${err.message}`));
        }
    }

    console.log(LEGAL_DISCLAIMER);

    // Save
    const timestamp = new Date().toISOString().slice(0, 10);
    const outputDir = path.join(dir, "audits");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `legal-${timestamp}.md`);

    const staticSection = [
        checks.privacyNeeds.length > 0
            ? "## 📋 Privacy Policy Requirements\n\n" + checks.privacyNeeds.map((i) => `- ${i.severity === "critical" ? "🔴" : "🟡"} ${i.item}`).join("\n")
            : "",
        riskItems.length > 0
            ? "\n\n## ⚖️ Compliance Flags\n\n" + [
                checks.euRelevant && "- ⚠️ **GDPR** — collecting EU user data requires compliance",
                checks.collectsEmail && "- ⚠️ **CAN-SPAM/CASL** — email marketing consent required",
                checks.collectsPayments && "- ⚠️ **PCI-DSS** — payment data compliance (handled by Stripe if using Stripe.js)",
                checks.needsCookieConsent && "- ⚠️ **Cookie Consent** — analytics/auth sessions require consent banner (EU)",
                checks.hasAI && "- ⚠️ **AI Data Processing** — disclose in privacy policy what data is sent to AI APIs",
            ].filter(Boolean).join("\n")
            : "",
    ].filter(Boolean).join("\n");

    const md = `# ⚖️ Legal & Compliance Report — ${scan.name}

> **Framework:** ${framework.name}
> **Features analysed:** ${features.map((f) => f.name).join(", ")}
> **AI Agent:** ${providerName || "static analysis only"}
> **Generated:** ${new Date().toISOString().slice(0, 19)}

> 🚨 **NOT LEGAL ADVICE.** This is an AI-generated compliance checklist.
> **Consult a qualified attorney before publishing legal documents or handling user data.**

---

${staticSection}

${aiSection ? "\n## 🤖 AI Compliance Analysis\n\n" + aiSection : ""}

---

*Generated by [tryappstack-audit](https://tryappstack.vercel.app) · \`npx tryappstack-audit legal\`*
`;

    fs.writeFileSync(outputFile, md);
    console.log("  " + chalk.green("✓") + " Saved: " + chalk.dim(outputFile) + "\n");
}

module.exports = legalCommand;
