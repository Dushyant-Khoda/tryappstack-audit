/**
 * Project Intelligence Scanner
 * Framework-aware: Next.js · Nuxt · SvelteKit · Angular · Vue · React · Express · NestJS · Fastify
 * Zero extra dependencies — built-in fs, path only.
 */

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
    "node_modules", ".git", ".next", ".nuxt", ".svelte-kit", "dist", "build",
    "coverage", ".turbo", "out", ".cache", ".vercel", ".output", "storybook-static",
]);
const MAX_FILE_SIZE = 150 * 1024; // 150KB per file
const MAX_FILES = 2500;

// ── File system helpers ───────────────────────────────────────────────────────

function walkDir(dir, callback, depth = 0, counter = { n: 0 }) {
    if (depth > 9 || counter.n > MAX_FILES) return;
    if (!fs.existsSync(dir)) return;
    let items;
    try { items = fs.readdirSync(dir); } catch { return; }

    for (const item of items) {
        if (SKIP_DIRS.has(item)) continue;
        const full = path.join(dir, item);
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }

        if (stat.isDirectory()) {
            walkDir(full, callback, depth + 1, counter);
        } else if (stat.isFile()) {
            counter.n++;
            callback(full, stat.size);
        }
    }
}

function readFile(filePath, maxSize = MAX_FILE_SIZE) {
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > maxSize) return null;
        return fs.readFileSync(filePath, "utf8");
    } catch { return null; }
}

function readJSON(filePath) {
    const content = readFile(filePath, 500 * 1024);
    if (!content) return null;
    try { return JSON.parse(content); } catch { return null; }
}

function hasFile(dir, ...segments) {
    return fs.existsSync(path.join(dir, ...segments));
}

// ── Framework detection ───────────────────────────────────────────────────────

function detectFramework(dir, pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const d = (name) => !!deps[name];
    const f = (...p) => hasFile(dir, ...p);

    const isNextJs  = d("next") || f("next.config.js") || f("next.config.ts") || f("next.config.mjs");
    const isNuxt    = d("nuxt") || f("nuxt.config.js") || f("nuxt.config.ts");
    const isAngular = d("@angular/core") || f("angular.json");
    const isSvelteKit = d("@sveltejs/kit") || f("svelte.config.js") || f("svelte.config.ts");
    const isVue     = d("vue") && !isNuxt;
    const isReact   = d("react") && !isNextJs;
    const isExpress = d("express");
    const isFastify = d("fastify");
    const isNestJs  = d("@nestjs/core");
    const isTrpc    = d("@trpc/server") || d("@trpc/client");
    const isPrisma  = d("prisma") || d("@prisma/client") || f("prisma", "schema.prisma");
    const isDrizzle = d("drizzle-orm");
    const isMongoose = d("mongoose");
    const isTypeORM  = d("typeorm");
    const isSequelize = d("sequelize");
    const isTypeScript = d("typescript") || f("tsconfig.json");
    const isNextAuth   = d("next-auth") || d("@auth/nextjs");
    const isClerk      = d("@clerk/nextjs") || d("@clerk/clerk-sdk-node");
    const isStripe     = d("stripe") || d("@stripe/stripe-js");
    const isTailwind   = d("tailwindcss");
    const isShadcn     = f("components.json");

    let name = "Node.js";
    if (isNextJs)    name = "Next.js";
    else if (isNuxt) name = "Nuxt";
    else if (isSvelteKit) name = "SvelteKit";
    else if (isAngular)   name = "Angular";
    else if (isNestJs)    name = "NestJS";
    else if (isVue)       name = "Vue";
    else if (isReact)     name = "React";
    else if (isFastify)   name = "Fastify";
    else if (isExpress)   name = "Express";

    return {
        name,
        isNextJs, isNuxt, isSvelteKit, isAngular, isVue, isReact,
        isExpress, isFastify, isNestJs, isTrpc,
        isPrisma, isDrizzle, isMongoose, isTypeORM, isSequelize,
        isTypeScript, isNextAuth, isClerk, isStripe, isTailwind, isShadcn,
        isFullStack: isNextJs || isNuxt || isSvelteKit,
        isFrontendOnly: (isReact || isVue || isAngular || isSvelteKit) && !isExpress && !isFastify && !isNestJs && !isNextJs && !isNuxt,
        isBackendOnly: (isExpress || isFastify || isNestJs) && !isNextJs && !isNuxt,
    };
}

// ── Tech stack ────────────────────────────────────────────────────────────────

function detectTechStack(dir, pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const d = (name) => !!deps[name];
    const stack = [];

    const checks = [
        // UI
        ["tailwindcss", "Tailwind CSS"], ["@mui/material", "Material UI"],
        ["antd", "Ant Design"], ["@chakra-ui/react", "Chakra UI"],
        ["styled-components", "Styled Components"], ["framer-motion", "Framer Motion"],
        // shadcn detected separately
        // State
        ["zustand", "Zustand"], ["jotai", "Jotai"], ["recoil", "Recoil"],
        ["redux", "Redux"], ["@reduxjs/toolkit", "Redux Toolkit"],
        ["mobx", "MobX"],
        // Data fetching
        ["@tanstack/react-query", "React Query"], ["react-query", "React Query"],
        ["swr", "SWR"], ["@apollo/client", "Apollo Client"], ["graphql", "GraphQL"],
        ["@trpc/client", "tRPC"],
        // Auth
        ["next-auth", "NextAuth.js"], ["@auth/nextjs", "Auth.js"],
        ["@clerk/nextjs", "Clerk"], ["passport", "Passport.js"],
        ["jsonwebtoken", "JWT"], ["@supabase/supabase-js", "Supabase Auth"],
        // ORM / DB
        ["@prisma/client", "Prisma"], ["drizzle-orm", "Drizzle ORM"],
        ["mongoose", "Mongoose"], ["typeorm", "TypeORM"],
        ["sequelize", "Sequelize"], ["knex", "Knex"],
        // Infrastructure
        ["stripe", "Stripe"], ["@stripe/stripe-js", "Stripe.js"],
        ["nodemailer", "Nodemailer"], ["resend", "Resend"], ["@sendgrid/mail", "SendGrid"],
        ["ioredis", "Redis (ioredis)"], ["redis", "Redis"],
        ["socket.io", "Socket.io"], ["ws", "WebSockets"],
        ["aws-sdk", "AWS SDK"], ["@aws-sdk/client-s3", "AWS S3"],
        ["uploadthing", "UploadThing"], ["multer", "Multer"],
        ["openai", "OpenAI SDK"], ["@anthropic-ai/sdk", "Anthropic SDK"], ["ai", "Vercel AI SDK"],
        // Monitoring
        ["@sentry/nextjs", "Sentry"], ["@sentry/node", "Sentry"],
        ["@vercel/analytics", "Vercel Analytics"], ["posthog-js", "PostHog"],
        // Validation
        ["zod", "Zod"], ["yup", "Yup"], ["joi", "Joi"],
        // Testing
        ["vitest", "Vitest"], ["jest", "Jest"],
        ["@playwright/test", "Playwright"], ["cypress", "Cypress"],
    ];

    const added = new Set();
    for (const [pkg, label] of checks) {
        if (d(pkg) && !added.has(label)) {
            stack.push(label);
            added.add(label);
        }
    }
    if (fs.existsSync(path.join(dir, "components.json")) && !added.has("shadcn/ui")) {
        stack.push("shadcn/ui");
    }

    return stack;
}

// ── Feature detection ─────────────────────────────────────────────────────────

function detectFeatures(dir, pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const d = (name) => !!deps[name];
    const features = [];

    if (d("next-auth") || d("@auth/nextjs") || d("@clerk/nextjs") || d("passport") || d("jsonwebtoken") || d("@supabase/supabase-js")) {
        const detail = d("@clerk/nextjs") ? "Clerk" : d("next-auth") || d("@auth/nextjs") ? "NextAuth.js" : d("@supabase/supabase-js") ? "Supabase" : "JWT/Passport";
        features.push({ name: "Authentication", icon: "🔐", detail });
    }
    if (d("stripe") || d("@stripe/stripe-js") || d("@lemonsqueezy/lemonsqueezy.js")) {
        features.push({ name: "Payments", icon: "💳", detail: d("stripe") ? "Stripe" : "LemonSqueezy" });
    }
    if (d("nodemailer") || d("resend") || d("@sendgrid/mail") || d("@mailchimp/mailchimp_transactional")) {
        const detail = d("resend") ? "Resend" : d("@sendgrid/mail") ? "SendGrid" : "Nodemailer";
        features.push({ name: "Email", icon: "📧", detail });
    }
    if (d("ioredis") || d("redis") || d("@upstash/redis")) {
        features.push({ name: "Caching", icon: "⚡", detail: d("@upstash/redis") ? "Upstash Redis" : "Redis" });
    }
    if (d("socket.io") || d("ws") || d("pusher") || d("ably")) {
        const detail = d("socket.io") ? "Socket.io" : d("pusher") ? "Pusher" : d("ably") ? "Ably" : "WebSockets";
        features.push({ name: "Real-time", icon: "🔌", detail });
    }
    if (d("aws-sdk") || d("@aws-sdk/client-s3") || d("uploadthing") || d("multer") || d("cloudinary")) {
        const detail = d("uploadthing") ? "UploadThing" : d("cloudinary") ? "Cloudinary" : "S3/Multer";
        features.push({ name: "File Uploads", icon: "📁", detail });
    }
    if (d("@prisma/client") || d("mongoose") || d("drizzle-orm") || d("typeorm") || d("sequelize")) {
        const detail = d("@prisma/client") ? "Prisma" : d("mongoose") ? "Mongoose" : d("drizzle-orm") ? "Drizzle" : d("typeorm") ? "TypeORM" : "Sequelize";
        features.push({ name: "Database ORM", icon: "🗄️", detail });
    }
    if (d("@trpc/server") || d("graphql")) {
        features.push({ name: "Type-safe API", icon: "🔷", detail: d("@trpc/server") ? "tRPC" : "GraphQL" });
    }
    if (d("openai") || d("@anthropic-ai/sdk") || d("ai") || d("@google/generative-ai")) {
        const detail = d("openai") ? "OpenAI" : d("@anthropic-ai/sdk") ? "Anthropic" : "AI SDK";
        features.push({ name: "AI Integration", icon: "🤖", detail });
    }
    if (d("@vercel/analytics") || d("posthog-js") || d("mixpanel-browser") || d("@segment/analytics-next")) {
        features.push({ name: "Analytics", icon: "📊" });
    }
    if (d("@sentry/nextjs") || d("@sentry/node") || d("@sentry/react")) {
        features.push({ name: "Error Monitoring", icon: "🔍", detail: "Sentry" });
    }
    if (d("zod") || d("yup") || d("joi") || d("express-validator")) {
        const detail = d("zod") ? "Zod" : d("yup") ? "Yup" : "Joi";
        features.push({ name: "Schema Validation", icon: "✅", detail });
    }
    if (d("i18next") || d("react-i18next") || d("next-intl") || d("@formatjs/intl")) {
        features.push({ name: "Internationalisation", icon: "🌍" });
    }
    if (d("@testing-library/react") || d("vitest") || d("jest") || d("@playwright/test")) {
        features.push({ name: "Testing", icon: "🧪" });
    }

    return features;
}

// ── Route extraction ──────────────────────────────────────────────────────────

function extractRoutes(dir, framework) {
    const routes = [];
    const counter = { n: 0 };

    if (framework.isNextJs) {
        _extractNextJsRoutes(dir, routes);
    } else if (framework.isNuxt) {
        _extractNuxtRoutes(dir, routes);
    } else if (framework.isSvelteKit) {
        _extractSvelteKitRoutes(dir, routes);
    }

    if (framework.isExpress || framework.isFastify) {
        _extractExpressRoutes(dir, routes, counter);
    }
    if (framework.isNestJs) {
        _extractNestJsRoutes(dir, routes, counter);
    }

    // Deduplicate
    const seen = new Set();
    return routes.filter((r) => {
        const key = `${r.type}:${r.path}:${r.method || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function _fileToRoute(rel, base) {
    return rel
        .replace(/\\/g, "/")
        .replace(/\/index\.(js|jsx|ts|tsx|vue|svelte)$/, "/")
        .replace(/\.(js|jsx|ts|tsx|vue|svelte)$/, "")
        .replace(/\[([^\]]+)\]/g, ":$1") // [slug] → :slug
        .replace(/\(([^)]+)\)\//g, "") || "/"; // Next.js route groups
}

function _extractNextJsRoutes(dir, routes) {
    // Pages router
    const pagesDir = path.join(dir, "pages");
    if (fs.existsSync(pagesDir)) {
        const apiDir = path.join(pagesDir, "api");
        walkDir(pagesDir, (file) => {
            if (!file.match(/\.(js|jsx|ts|tsx)$/)) return;
            const rel = file.replace(pagesDir, "");
            if (rel.includes("_app.") || rel.includes("_document.") || rel.includes("_error.")) return;

            if (file.startsWith(apiDir)) {
                const routePath = "/api" + _fileToRoute(file.replace(apiDir, ""), dir);
                routes.push({ path: routePath, type: "api", file: file.replace(dir, "") });
            } else {
                const routePath = _fileToRoute(rel, dir);
                routes.push({ path: routePath, type: "page", file: file.replace(dir, "") });
            }
        });
    }

    // App router (Next.js 13+)
    for (const appBase of [path.join(dir, "src", "app"), path.join(dir, "app")]) {
        if (!fs.existsSync(appBase)) continue;
        walkDir(appBase, (file) => {
            const rel = file.replace(appBase, "").replace(/\\/g, "/");
            if (file.match(/page\.(js|jsx|ts|tsx)$/)) {
                const routePath = rel.replace(/\/page\.(js|jsx|ts|tsx)$/, "").replace(/\(([^)]+)\)\//g, "") || "/";
                routes.push({ path: routePath, type: "page", file: file.replace(dir, "") });
            }
            if (file.match(/route\.(js|ts)$/)) {
                const routePath = rel.replace(/\/route\.(js|ts)$/, "").replace(/\(([^)]+)\)\//g, "") || "/";
                const content = readFile(file) || "";
                const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"].filter((m) =>
                    new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(content)
                );
                routes.push({ path: routePath, type: "api", methods: methods.length ? methods : ["GET"], file: file.replace(dir, "") });
            }
        });
        break; // only use first found
    }
}

function _extractNuxtRoutes(dir, routes) {
    const pagesDir = path.join(dir, "pages");
    if (fs.existsSync(pagesDir)) {
        walkDir(pagesDir, (file) => {
            if (!file.match(/\.(vue|js|ts)$/)) return;
            routes.push({ path: _fileToRoute(file.replace(pagesDir, ""), dir), type: "page", file: file.replace(dir, "") });
        });
    }
    for (const apiBase of [path.join(dir, "server", "api"), path.join(dir, "server", "routes")]) {
        if (!fs.existsSync(apiBase)) continue;
        walkDir(apiBase, (file) => {
            if (!file.match(/\.(js|ts)$/)) return;
            routes.push({ path: "/api" + _fileToRoute(file.replace(apiBase, ""), dir), type: "api", file: file.replace(dir, "") });
        });
    }
}

function _extractSvelteKitRoutes(dir, routes) {
    const routesDir = path.join(dir, "src", "routes");
    if (!fs.existsSync(routesDir)) return;
    walkDir(routesDir, (file) => {
        const rel = file.replace(routesDir, "").replace(/\\/g, "/");
        if (file.match(/\+page\.(svelte|ts|js)$/)) {
            routes.push({ path: rel.replace(/\/\+page\.(svelte|ts|js)$/, "") || "/", type: "page", file: file.replace(dir, "") });
        }
        if (file.match(/\+server\.(ts|js)$/)) {
            routes.push({ path: rel.replace(/\/\+server\.(ts|js)$/, "") || "/", type: "api", file: file.replace(dir, "") });
        }
    });
}

function _extractExpressRoutes(dir, routes, counter) {
    const RE = /(?:app|router|server)\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    walkDir(dir, (file) => {
        if (!file.match(/\.(js|ts)$/)) return;
        const content = readFile(file, 80 * 1024);
        if (!content) return;
        let m;
        const re = new RegExp(RE.source, "gi");
        while ((m = re.exec(content))) {
            routes.push({ method: m[1].toUpperCase(), path: m[2], type: "api", file: file.replace(dir, "") });
        }
    }, 0, counter);
}

function _extractNestJsRoutes(dir, routes, counter) {
    const CTRL_RE = /@Controller\s*\(\s*['"`]([^'"`]*)['"`]/;
    const METHOD_RE = /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*['"`]?([^'"`)]*)['"`]?\)/gi;
    walkDir(dir, (file) => {
        if (!file.match(/\.(ts|js)$/) || !file.includes(".controller.")) return;
        const content = readFile(file, 80 * 1024);
        if (!content) return;
        const ctrlMatch = content.match(CTRL_RE);
        const base = ctrlMatch ? "/" + ctrlMatch[1] : "";
        let m;
        const re = new RegExp(METHOD_RE.source, "gi");
        while ((m = re.exec(content))) {
            routes.push({ method: m[1].toUpperCase(), path: base + (m[2] ? "/" + m[2] : ""), type: "api", file: file.replace(dir, "") });
        }
    }, 0, counter);
}

// ── Component extraction ──────────────────────────────────────────────────────

function extractComponents(dir) {
    const components = [];
    const COMP_DIRS = [
        "components", "src/components", "app/components",
        "src/ui", "src/shared/components", "src/features",
    ].map((d) => path.join(dir, d));

    for (const compDir of COMP_DIRS) {
        if (!fs.existsSync(compDir)) continue;
        walkDir(compDir, (file) => {
            if (!file.match(/\.(jsx|tsx|vue|svelte)$/)) return;
            if (file.match(/\.(test|spec|stories)\./)) return;

            const content = readFile(file);
            if (!content) return;

            const name = path.basename(file, path.extname(file));
            const rel  = file.replace(dir, "");
            const lines = content.split("\n").length;

            let type = "component";
            const relLower = rel.toLowerCase();
            if (relLower.includes("/ui/") || relLower.includes("/atoms/") || relLower.includes("/primitives/")) type = "ui";
            else if (relLower.includes("layout") || name.toLowerCase().includes("layout")) type = "layout";
            else if (relLower.includes("page") || name.toLowerCase().includes("page")) type = "page";
            else if (relLower.includes("provider") || name.toLowerCase().includes("provider")) type = "provider";

            const hooks = [];
            if (content.includes("useState"))  hooks.push("useState");
            if (content.includes("useEffect")) hooks.push("useEffect");
            if (content.includes("useContext")) hooks.push("useContext");
            if (content.includes("useMemo") || content.includes("useCallback")) hooks.push("useMemo/useCallback");
            if (content.includes("useRef"))    hooks.push("useRef");

            const hasProps = /(?:interface|type)\s+\w*[Pp]rops[\s={<]/.test(content);
            const hasMemo  = content.includes("React.memo") || content.includes("memo(");
            const hasDirectFetch = /(?:fetch|axios)\s*\(/.test(content) && !content.includes("use");

            components.push({ name, file: rel, lines, type, hasProps, hooks, hasMemo, hasDirectFetch, large: lines > 300 });
        });
    }

    return components;
}

// ── Environment variables ─────────────────────────────────────────────────────

function extractEnvVars(dir) {
    const envVars = new Map();

    // Parse .env.example / .env.sample
    for (const envFile of [".env.example", ".env.sample", ".env.local.example", ".env.template"]) {
        const content = readFile(path.join(dir, envFile));
        if (!content) continue;

        const lines = content.split("\n");
        let lastComment = "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#")) { lastComment = trimmed.slice(1).trim(); continue; }
            if (!trimmed) { lastComment = ""; continue; }
            const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/);
            if (match) {
                envVars.set(match[1], {
                    name: match[1],
                    example: match[2].replace(/['"]/g, "").trim(),
                    comment: lastComment,
                    required: !match[2].trim(),
                    fromExample: true,
                });
                lastComment = "";
            }
        }
    }

    // Scan source for process.env usage
    const counter = { n: 0 };
    walkDir(dir, (file) => {
        if (!file.match(/\.(js|ts|jsx|tsx|mjs)$/)) return;
        const content = readFile(file, 60 * 1024);
        if (!content) return;
        const re = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
        let m;
        while ((m = re.exec(content))) {
            if (!envVars.has(m[1])) {
                envVars.set(m[1], { name: m[1], example: "", comment: "", required: true, fromCode: true });
            }
        }
    }, 0, counter);

    return [...envVars.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Database model extraction ─────────────────────────────────────────────────

function extractModels(dir) {
    const models = [];

    // Prisma
    const prismaContent = readFile(path.join(dir, "prisma", "schema.prisma"));
    if (prismaContent) {
        const re = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
        let m;
        while ((m = re.exec(prismaContent))) {
            const fields = m[2].split("\n")
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@") && !l.startsWith("@"))
                .map((l) => l.split(/\s+/)[0])
                .filter(Boolean)
                .slice(0, 8);
            models.push({ name: m[1], source: "Prisma", fields });
        }
        return models;
    }

    // Drizzle (look for table definitions)
    const counter = { n: 0 };
    walkDir(path.join(dir, "db"), (file) => {
        if (!file.match(/\.(ts|js)$/)) return;
        const content = readFile(file);
        if (!content || !content.includes("pgTable") && !content.includes("sqliteTable") && !content.includes("mysqlTable")) return;
        const re = /export\s+const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable|mysqlTable)/g;
        let m;
        while ((m = re.exec(content))) {
            models.push({ name: m[1], source: "Drizzle", fields: [] });
        }
    }, 0, counter);

    // Mongoose
    for (const modelDir of ["models", "src/models", "server/models"].map((d) => path.join(dir, d))) {
        if (!fs.existsSync(modelDir)) continue;
        walkDir(modelDir, (file) => {
            if (!file.match(/\.(js|ts)$/)) return;
            const content = readFile(file);
            if (!content || !content.includes("Schema")) return;
            const name = path.basename(file, path.extname(file));
            const capName = name.charAt(0).toUpperCase() + name.slice(1);
            if (!models.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
                models.push({ name: capName, source: "Mongoose", fields: [] });
            }
        }, 0, counter);
    }

    return models;
}

// ── Issue / hidden problem detection ─────────────────────────────────────────

function detectIssues(dir, pkg) {
    const issues = [];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const d = (name) => !!deps[name];

    // ── Missing files ────────────────────────────────────────────────────────
    if (!hasFile(dir, ".env.example") && !hasFile(dir, ".env.sample")) {
        issues.push({ severity: "warning", category: "Security", message: "Missing .env.example — team members have no reference for required env vars" });
    }
    if (!hasFile(dir, "README.md")) {
        issues.push({ severity: "info", category: "Documentation", message: "Missing README.md" });
    }
    if (!hasFile(dir, "LICENSE") && !hasFile(dir, "LICENSE.md")) {
        issues.push({ severity: "info", category: "Documentation", message: "Missing LICENSE file" });
    }

    // ── Dependency-level checks ──────────────────────────────────────────────
    if (d("express")) {
        if (!d("helmet")) {
            issues.push({ severity: "warning", category: "Security", message: "Express missing `helmet` — no security headers (X-Frame-Options, HSTS, etc.)" });
        }
        if (!d("express-rate-limit") && !d("rate-limiter-flexible") && !d("@upstash/ratelimit")) {
            issues.push({ severity: "warning", category: "Security", message: "No rate limiting — API endpoints vulnerable to abuse and DDoS" });
        }
        if (!d("cors")) {
            issues.push({ severity: "info", category: "Security", message: "No CORS middleware detected — may cause issues in production" });
        }
        if (!d("zod") && !d("joi") && !d("yup") && !d("express-validator")) {
            issues.push({ severity: "warning", category: "API Quality", message: "No input validation library (zod/joi/yup) — unvalidated user input is a security risk" });
        }
    }
    if (!d("typescript") && (d("react") || d("express") || d("next"))) {
        issues.push({ severity: "info", category: "TypeScript", message: "Not using TypeScript — consider migrating for type safety and better DX" });
    }
    if ((d("@prisma/client") || d("mongoose") || d("drizzle-orm")) && !d("zod") && !d("yup")) {
        issues.push({ severity: "info", category: "API Quality", message: "ORM used but no schema validation at API boundary — validate inputs before hitting the DB" });
    }

    // ── Source file scanning ─────────────────────────────────────────────────
    const counter = { n: 0 };
    const consoleLogs = [];
    const todoIssues = [];
    const anyTypeFiles = new Set();

    walkDir(dir, (file) => {
        if (!file.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/)) return;
        if (file.match(/\.(test|spec|stories)\./)) return;
        if (file.includes("__tests__") || file.includes("__mocks__")) return;

        const content = readFile(file, 100 * 1024);
        if (!content) return;

        const relFile = file.replace(dir, "");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
            const ln = idx + 1;
            const t = line.trim();
            if (!t || t.startsWith("//") || t.startsWith("*")) return;

            // Hardcoded secrets
            if (/(?:api_key|apikey|api_secret|jwt_secret|db_password|database_url)\s*(?:=|:)\s*['"][A-Za-z0-9_\-#$!@%^&*./]{8,}['"]/i.test(t) &&
                !t.includes("process.env") && !relFile.includes("example") && !relFile.includes("sample")) {
                issues.push({ severity: "critical", category: "Security", file: relFile, line: ln, message: "Possible hardcoded secret — move to environment variable" });
            }

            // eval()
            if (/\beval\s*\(/.test(t)) {
                issues.push({ severity: "critical", category: "Security", file: relFile, line: ln, message: "eval() usage — code injection risk" });
            }

            // SQL injection via template literal
            if (/(?:\.query|\.execute|\.raw|db\.run)\s*\(\s*[`][^`]*\$\{/.test(t)) {
                issues.push({ severity: "critical", category: "Security", file: relFile, line: ln, message: "SQL injection risk — template literal in raw query" });
            }

            // dangerouslySetInnerHTML
            if (/dangerouslySetInnerHTML/.test(t) && !content.includes("DOMPurify") && !content.includes("sanitize")) {
                issues.push({ severity: "critical", category: "Security", file: relFile, line: ln, message: "dangerouslySetInnerHTML without sanitization (DOMPurify) — XSS risk" });
            }

            // Empty catch
            if (/catch\s*\(\w*\)\s*\{\s*\}/.test(t) || /catch\s*\{\s*\}/.test(t)) {
                issues.push({ severity: "warning", category: "Error Handling", file: relFile, line: ln, message: "Empty catch block — errors silently swallowed" });
            }

            // Hardcoded localhost
            if (/(?:fetch|axios|http|https)\s*\(\s*['"`]https?:\/\/localhost/.test(t)) {
                issues.push({ severity: "warning", category: "Config", file: relFile, line: ln, message: "Hardcoded localhost URL — use environment variable" });
            }

            // console.log (collect, report summary)
            if (/console\.(log|debug)\s*\(/.test(t)) {
                consoleLogs.push({ file: relFile, line: ln });
            }

            // TODOs
            if (/\/\/\s*(?:TODO|FIXME|HACK|XXX)\b/i.test(t)) {
                todoIssues.push({ file: relFile, line: ln, message: t.slice(0, 80) });
            }

            // TypeScript `any`
            if (file.match(/\.ts$/) && /:\s*any[\s,;<>)[\]]/.test(t) && !t.includes("// eslint")) {
                anyTypeFiles.add(relFile);
            }
        });

        // File-level: large component
        if (lines.length > 300 && file.match(/\.(jsx|tsx|vue|svelte)$/)) {
            issues.push({ severity: "warning", category: "Component Quality", file: relFile, message: `God component (${lines.length} lines) — split into smaller components` });
        }

        // Async without error handling
        if ((content.includes("async function") || content.includes("async (")) &&
            !content.includes("try {") && !content.includes("try{") &&
            !content.includes(".catch(") && file.match(/\.(js|ts)$/) && !file.includes(".config.")) {
            issues.push({ severity: "warning", category: "Error Handling", file: relFile, message: "Async code without try/catch or .catch() — unhandled rejections crash Node.js" });
        }

        // Direct fetch/axios inside React components (should use hooks/services)
        if (file.match(/\.(jsx|tsx)$/) && /(?:fetch|axios)\s*\(/.test(content) && content.includes("useEffect")) {
            issues.push({ severity: "info", category: "Architecture", file: relFile, message: "Direct fetch/axios call inside component — move to custom hook or service layer" });
        }
    }, 0, counter);

    // Summarise console.logs (avoid 50+ individual entries)
    if (consoleLogs.length > 0) {
        const files = [...new Set(consoleLogs.map((l) => l.file))];
        issues.push({
            severity: "info",
            category: "Code Quality",
            message: `${consoleLogs.length} console.log() calls across ${files.length} file(s) — remove before production`,
            files: files.slice(0, 5),
        });
    }

    // Summarise TODOs
    if (todoIssues.length > 0) {
        issues.push({
            severity: "info",
            category: "Code Quality",
            message: `${todoIssues.length} unresolved TODO/FIXME comment(s)`,
            examples: todoIssues.slice(0, 3).map((t) => t.message),
        });
    }

    // Summarise TypeScript `any`
    if (anyTypeFiles.size > 0) {
        issues.push({
            severity: "info",
            category: "TypeScript",
            message: `\`any\` type used in ${anyTypeFiles.size} file(s) — weakens TypeScript safety`,
            files: [...anyTypeFiles].slice(0, 5),
        });
    }

    return issues;
}

// ── Main export ───────────────────────────────────────────────────────────────

function scanProject(dir) {
    const absDir = path.resolve(dir);
    const pkg = readJSON(path.join(absDir, "package.json")) || {};
    const counter = { n: 0 };
    const framework = detectFramework(absDir, pkg);

    // Count files for reporting
    walkDir(absDir, () => {}, 0, counter);

    return {
        name: pkg.name || path.basename(absDir),
        version: pkg.version || "0.0.0",
        description: pkg.description || "",
        framework,
        tech: detectTechStack(absDir, pkg),
        routes: extractRoutes(absDir, framework),
        components: extractComponents(absDir),
        features: detectFeatures(absDir, pkg),
        envVars: extractEnvVars(absDir),
        models: extractModels(absDir),
        issues: detectIssues(absDir, pkg),
        scripts: pkg.scripts || {},
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scannedFiles: counter.n,
    };
}

module.exports = { scanProject };
