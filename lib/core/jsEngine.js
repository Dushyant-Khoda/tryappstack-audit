/**
 * Pure JS audit engine — runs when bash 4+ is not available (Windows, macOS stock bash)
 * Implements all 16 modules in JavaScript for cross-platform compatibility
 */

const fs = require("fs");
const path = require("path");

const MOD_FLAG_MAP = {
    loc: "loc",
    unusedPackages: "unusedPackages",
    deadCode: "deadCode",
    structure: "structure",
    bundle: "bundle",
    deps: "deps",
    complexity: "complexity",
    security: "security",
    performance: "performance",
    bestPractices: "bestPractices",
    alternatives: "alternatives",
    env: "env",
    gitHealth: "gitHealth",
    tests: "tests",
    a11y: "a11y",
    docs: "docs",
};

class JSEngine {
    constructor(dir, opts = {}) {
        this.dir = path.resolve(dir);
        this.opts = opts;
        this.scores = {};
        this.issues = {};
        this.report = "";
        this.pkg = this._readJSON(path.join(this.dir, "package.json"));
        this.framework = this._detectFramework();
        this.srcDir = this._findSrcDir();
    }

    run() {
        const allModules = [
            ["loc", "📏", "LOC Health", () => this.auditLOC()],
            ["unusedPackages", "📦", "Unused Pkgs", () => this.auditUnusedPackages()],
            ["deadCode", "💀", "Dead Code", () => this.auditDeadCode()],
            ["structure", "🏗️", "Structure", () => this.auditStructure()],
            ["deps", "🔗", "Dep Health", () => this.auditDeps()],
            ["complexity", "🧠", "Complexity", () => this.auditComplexity()],
            ["security", "🔒", "Security", () => this.auditSecurity()],
            ["bundle", "📦", "Bundle", () => this.auditBundle()],
            ["performance", "⚡", "Performance", () => this.auditPerformance()],
            ["bestPractices", "📐", "Best Practices", () => this.auditBestPractices()],
            ["alternatives", "🔄", "Alternatives", () => this.auditAlternatives()],
            ["env", "🛠️", "Environment", () => this.auditEnv()],
            ["gitHealth", "🔀", "Git Health", () => this.auditGitHealth()],
            ["tests", "🧪", "Tests", () => this.auditTests()],
            ["a11y", "♿", "A11y", () => this.auditA11y()],
            ["docs", "📝", "Docs", () => this.auditDocs()],
        ];

        const hasSpecific = Object.keys(MOD_FLAG_MAP).some((k) => this.opts[k]);

        for (const [key, icon, name, fn] of allModules) {
            if (hasSpecific && !this.opts[key]) continue;
            try {
                this.report += `## ${icon} ${name}\n\n`;
                this.report += fn() + "\n\n";
            } catch (e) {
                this.report += `> Module error: ${e.message}\n\n`;
            }
        }

        return {
            scores: this.scores,
            issues: this.issues,
            report: this.report,
            framework: this.framework,
        };
    }

    _score(name, val) {
        val = Math.max(0, Math.min(100, val));
        this.scores[name] = val;
    }

    _readJSON(p) {
        try {
            return JSON.parse(fs.readFileSync(p, "utf8"));
        } catch {
            return {};
        }
    }

    _detectFramework() {
        const d = this.pkg.dependencies || {};
        const dd = this.pkg.devDependencies || {};
        const all = { ...d, ...dd };
        if (all.next) return { name: "nextjs", display: "Next.js" };
        if (all["@angular/core"]) return { name: "angular", display: "Angular" };
        if (all.vue) return { name: "vue", display: "Vue.js" };
        if (all.nuxt) return { name: "nuxt", display: "Nuxt.js" };
        if (all["@nestjs/core"]) return { name: "nestjs", display: "NestJS" };
        if (all.express) return { name: "express", display: "Express.js" };
        if (all.fastify) return { name: "fastify", display: "Fastify" };
        if (all.react && all.vite) return { name: "react-vite", display: "React + Vite" };
        if (all.react) return { name: "react", display: "React" };
        return { name: "node", display: "Node.js" };
    }

    _findSrcDir() {
        for (const d of ["src", "app", "lib"]) {
            if (fs.existsSync(path.join(this.dir, d))) return path.join(this.dir, d);
        }
        return this.dir;
    }

    _walk(
        dir,
        exts = [".ts", ".tsx", ".js", ".jsx", ".vue"],
        exclude = ["node_modules", ".git", "dist", ".next", "build", "coverage"]
    ) {
        const results = [];
        const _walk = (d) => {
            let entries;
            try {
                entries = fs.readdirSync(d, { withFileTypes: true });
            } catch {
                return;
            }
            for (const e of entries) {
                if (exclude.includes(e.name)) continue;
                const full = path.join(d, e.name);
                if (e.isDirectory()) _walk(full);
                else if (exts.some((x) => e.name.endsWith(x))) results.push(full);
            }
        };
        _walk(dir);
        return results;
    }

    _norm(filepath) {
        return filepath.replace(/\\/g, "/");
    }

    _getCategory(filepath) {
        const name = path.basename(filepath);
        const dir = this._norm(path.dirname(filepath));
        if (dir.includes("/pages") || dir.includes("/views")) return "Page";
        if (dir.includes("/components")) return "Component";
        if (dir.includes("/hooks") || name.startsWith("use")) return "Hook";
        if (dir.includes("/utils") || dir.includes("/helpers") || dir.includes("/lib"))
            return "Utility";
        if (dir.includes("/ui")) return "UI";
        if (dir.includes("/routes")) return "Route";
        if (dir.includes("/controllers")) return "Controller";
        if (dir.includes("/services")) return "Service";
        if (dir.includes("/models")) return "Model";
        if (dir.includes("/middleware")) return "Middleware";
        if (name.startsWith("index.")) return "Barrel";
        if (name.includes(".test.") || name.includes(".spec.")) return "Test";
        if (name.includes(".config.")) return "Config";
        if (name.endsWith(".d.ts")) return "Types";
        return "Source";
    }

    _isBackend() {
        return ["express", "nestjs", "fastify", "node"].includes(this.framework.name);
    }

    _isFrontend() {
        return ["react", "react-vite", "nextjs", "angular", "vue", "nuxt", "svelte"].includes(
            this.framework.name
        );
    }

    // ── Modules ──

    auditLOC() {
        const files = this._walk(this.dir);
        let crit = 0,
            warn = 0,
            good = 0,
            clean = 0;
        let rows =
            "| File | Lines | Type | Status | Action |\n|------|-------|------|--------|--------|\n";

        for (const f of files) {
            const rel = path.relative(this.dir, f);
            const cat = this._getCategory(f);
            if (["Test", "Barrel", "Config", "Types"].includes(cat)) continue;

            let lines;
            try {
                lines = fs.readFileSync(f, "utf8").split("\n").length;
            } catch {
                continue;
            }

            const thresholds =
                cat === "Page"
                    ? [300, 500]
                    : cat === "Component"
                      ? [200, 400]
                      : cat === "Hook"
                        ? [150, 999]
                        : [150, 300];
            let status, action, emoji;

            if (lines > thresholds[1]) {
                emoji = "🔴";
                status = "Critical";
                action = "Split immediately";
                crit++;
            } else if (lines > thresholds[0]) {
                emoji = "🟡";
                status = "Reduce";
                action = "Extract logic";
                warn++;
            } else if (lines > 100) {
                emoji = "🟢";
                status = "OK";
                action = "—";
                good++;
            } else {
                emoji = "✅";
                status = "Clean";
                action = "—";
                clean++;
            }

            if (emoji === "🔴" || emoji === "🟡") {
                rows += `| \`${rel}\` | ${lines} | ${cat} | ${emoji} ${status} | ${action} |\n`;
            }
        }

        const total = crit + warn + good + clean;
        const score =
            total > 0 ? Math.round((clean * 100 + good * 75 + warn * 40 + crit * 10) / total) : 100;
        this._score("LOC Health", score);
        return rows + `\n**Summary:** 🔴 ${crit} · 🟡 ${warn} · 🟢 ${good} · ✅ ${clean}\n`;
    }

    auditUnusedPackages() {
        const deps = Object.keys(this.pkg.dependencies || {});
        const files = this._walk(this.dir);
        const implicit =
            /^(@types\/|typescript|vite|tailwindcss|postcss|autoprefixer|eslint|prettier|vitest|@vitejs\/|@eslint\/|tsx|ts-node|nodemon|sass|dotenv|husky|lint-staged)/;

        const MAX = 64 * 1024;
        let imports = "";
        for (const f of files) {
            try {
                const content = fs.readFileSync(f, "utf8");
                imports += content.length > MAX ? content.slice(0, MAX) : content;
            } catch {
                /* ignore */
            }
        }

        let unused = 0;
        let rows = "| Package | Status |\n|---------|--------|\n";

        for (const dep of deps) {
            if (implicit.test(dep)) continue;
            if (imports.includes(dep)) continue;
            rows += `| \`${dep}\` | 🔴 Unused |\n`;
            unused++;
        }

        if (unused === 0) rows += "| ✅ | All packages in use |\n";
        const score =
            deps.length > 0 ? Math.round(((deps.length - unused) * 100) / deps.length) : 100;
        this._score("Unused Pkgs", score);
        return rows + `\n**${unused}** potentially unused\n`;
    }

    auditDeadCode() {
        const files = this._walk(this.srcDir);
        const contents = files.map((f) => {
            try {
                return fs.readFileSync(f, "utf8");
            } catch {
                return "";
            }
        });
        const combined = contents.join("\n");

        let dead = 0,
            total = 0;
        let rows = "| File | Type | Status |\n|------|------|--------|\n";

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const name = path.basename(f).replace(/\.[^.]+$/, "");
            const cat = this._getCategory(f);
            if (["Test", "Barrel", "Config", "Types"].includes(cat)) continue;
            if (["main", "index", "App", "app.module", "vite-env.d", "setup"].includes(name))
                continue;
            total++;

            const occurrences = (
                combined.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []
            ).length;
            if (occurrences <= 1) {
                rows += `| \`${path.relative(this.dir, f)}\` | ${cat} | 🔴 Unused |\n`;
                dead++;
            }
        }

        const score = total > 0 ? Math.round(((total - dead) * 100) / total) : 100;
        this._score("Dead Code", score);
        return rows + `\n**${dead}** potentially dead files\n`;
    }

    auditStructure() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";

        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        check(fs.existsSync(path.join(this.dir, "src")), "src/ directory exists");
        check(fs.existsSync(path.join(this.dir, ".gitignore")), ".gitignore exists");
        check(fs.existsSync(path.join(this.dir, "tsconfig.json")), "TypeScript configured");
        check(fs.existsSync(path.join(this.dir, "README.md")), "README.md exists");

        const files = this._walk(this.srcDir);
        const names = files.map((f) => path.basename(f)).filter((n) => !n.startsWith("index."));
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        check(
            dupes.length === 0,
            dupes.length === 0
                ? "No duplicate filenames"
                : `Duplicate: ${[...new Set(dupes)].join(", ")}`
        );

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Structure", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditDeps() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        check(
            fs.existsSync(path.join(this.dir, "package-lock.json")) ||
                fs.existsSync(path.join(this.dir, "yarn.lock")) ||
                fs.existsSync(path.join(this.dir, "pnpm-lock.yaml")),
            "Lock file exists"
        );
        check(
            fs.existsSync(path.join(this.dir, ".nvmrc")) ||
                fs.existsSync(path.join(this.dir, ".node-version")),
            "Node version pinned"
        );

        const tsconfig = this._readJSON(path.join(this.dir, "tsconfig.json"));
        if (tsconfig.compilerOptions) {
            check(tsconfig.compilerOptions.strict === true, "TypeScript strict mode");
        }

        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        check(!!allDeps.eslint || !!allDeps["@eslint/js"], "ESLint configured");
        check(!!allDeps.prettier, "Prettier configured");
        check(!!allDeps.husky || fs.existsSync(path.join(this.dir, ".husky")), "Git hooks");

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Dep Health", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditComplexity() {
        const files = this._walk(this.srcDir);
        let issues = 0;
        let rows = "| File | Issue | Action |\n|------|-------|--------|\n";

        for (const f of files) {
            if (f.includes(".test.") || f.includes(".spec.")) continue;
            let content;
            try {
                content = fs.readFileSync(f, "utf8");
            } catch {
                continue;
            }
            const rel = path.relative(this.dir, f);

            const effects = (content.match(/useEffect|watchEffect|watch\(/g) || []).length;
            if (effects > 3) {
                rows += `| \`${rel}\` | ${effects} effects | Extract to hooks |\n`;
                issues++;
            }

            const states = (content.match(/useState|ref\(|reactive\(/g) || []).length;
            if (states > 6) {
                rows += `| \`${rel}\` | ${states} state vars | Use reducer |\n`;
                issues++;
            }

            const anys = (content.match(/:\s*any\b|<any>|as any/g) || []).length;
            if (anys > 3) {
                rows += `| \`${rel}\` | ${anys} \`any\` types | Add types |\n`;
                issues++;
            }

            const consoles = (content.match(/console\.(log|warn|debug)/g) || []).length;
            if (consoles > 0) {
                rows += `| \`${rel}\` | ${consoles} console.log | Remove |\n`;
                issues++;
            }
        }

        if (issues === 0) rows += "| ✅ | No issues | — |\n";
        this._score("Complexity", Math.max(0, 100 - issues * 8));
        return rows + `\n**${issues}** complexity issues\n`;
    }

    auditSecurity() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🔴"} | ${msg} |\n`;
        };

        if (fs.existsSync(path.join(this.dir, ".env"))) {
            const gi = fs.existsSync(path.join(this.dir, ".gitignore"))
                ? fs.readFileSync(path.join(this.dir, ".gitignore"), "utf8")
                : "";
            check(gi.includes(".env"), ".env is gitignored");
        }

        check(
            fs.existsSync(path.join(this.dir, ".env.example")) ||
                fs.existsSync(path.join(this.dir, ".env.template")),
            ".env.example exists"
        );

        const files = this._walk(this.srcDir);
        let secretFiles = 0;
        for (const f of files) {
            try {
                const c = fs.readFileSync(f, "utf8");
                if (/(?:api_key|secret|password|token)\s*[=:]\s*["'][^"']{8,}/i.test(c))
                    secretFiles++;
            } catch {
                /* ignore */
            }
        }
        check(
            secretFiles === 0,
            secretFiles === 0 ? "No hardcoded secrets" : `Possible secrets in ${secretFiles} files`
        );

        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        if (this._isBackend()) {
            check(
                !!allDeps.helmet,
                allDeps.helmet ? "helmet installed" : "No helmet — add security headers"
            );
            const hasRateLimit =
                !!allDeps["express-rate-limit"] ||
                !!allDeps["@nestjs/throttler"] ||
                !!allDeps["rate-limiter-flexible"];
            check(hasRateLimit, hasRateLimit ? "Rate limiting" : "No rate limiting");
        }

        let xssFiles = 0;
        let evalFiles = 0;
        for (const f of files) {
            try {
                const c = fs.readFileSync(f, "utf8");
                if (/dangerouslySetInnerHTML/.test(c)) xssFiles++;
                if (/\beval\s*\(/.test(c)) evalFiles++;
            } catch {
                /* ignore */
            }
        }
        if (this._isFrontend()) {
            check(
                xssFiles === 0,
                xssFiles === 0
                    ? "No dangerouslySetInnerHTML"
                    : `dangerouslySetInnerHTML in ${xssFiles} files`
            );
        }
        check(
            evalFiles === 0,
            evalFiles === 0 ? "No eval() usage" : `eval() in ${evalFiles} files`
        );

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Security", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditBundle() {
        const deps = this.pkg.dependencies || {};
        let sug = 0;
        let rows = "| Current | Alternative | Why |\n|---------|------------|-----|\n";

        const swaps = {
            moment: ["dayjs", "97% smaller"],
            axios: ["native fetch", "Zero bundle"],
            lodash: ["lodash-es", "Tree-shakeable"],
            uuid: ["crypto.randomUUID()", "Native"],
            classnames: ["clsx", "14x smaller"],
            nodemon: ["node --watch", "Native"],
            dotenv: ["node --env-file", "Native Node 20+"],
            chalk: ["picocolors", "14x smaller"],
            webpack: ["Vite", "10-100x faster"],
            formik: ["react-hook-form", "Better performance"],
            sequelize: ["Drizzle ORM", "Type-safe, lighter"],
            typeorm: ["Drizzle ORM", "Type-safe, lighter"],
            request: ["native fetch", "Deprecated"],
            jquery: ["Remove", "Not needed"],
            "node-fetch": ["native fetch", "Node 18+"],
            "body-parser": ["express.json()", "Built-in"],
        };

        for (const [pkg, [alt, why]] of Object.entries(swaps)) {
            if (deps[pkg]) {
                rows += `| \`${pkg}\` | **${alt}** | ${why} |\n`;
                sug++;
            }
        }

        if (sug === 0) rows += "| ✅ | Modern stack | No swaps |\n";
        this._score("Bundle", Math.max(0, 100 - sug * 7));
        return rows + `\n**${sug}** suggestions\n`;
    }

    auditPerformance() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        const files = this._walk(this.srcDir);
        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        const fw = this.framework.name;

        if (fw.startsWith("react") || fw.startsWith("next")) {
            let memoCount = 0,
                lazyCount = 0,
                suspCount = 0;
            for (const f of files) {
                try {
                    const c = fs.readFileSync(f, "utf8");
                    if (/React\.memo\b|memo\(/.test(c)) memoCount++;
                    if (/React\.lazy\b|lazy\(/.test(c)) lazyCount++;
                    if (/Suspense/.test(c)) suspCount++;
                } catch {
                    /* ignore */
                }
            }
            check(
                memoCount > 0,
                memoCount > 0 ? `React.memo: ${memoCount} components` : "No React.memo usage"
            );
            check(
                lazyCount > 0,
                lazyCount > 0 ? `Lazy loading: ${lazyCount}` : "No code splitting"
            );
            check(
                suspCount > 0,
                suspCount > 0 ? `Suspense: ${suspCount}` : "No Suspense boundaries"
            );
        }

        if (fw === "angular") {
            let onPushCount = 0;
            for (const f of files) {
                try {
                    if (/OnPush/.test(fs.readFileSync(f, "utf8"))) onPushCount++;
                } catch {
                    /* ignore */
                }
            }
            check(
                onPushCount > 0,
                onPushCount > 0 ? `OnPush: ${onPushCount} components` : "No OnPush change detection"
            );
        }

        if (fw.startsWith("vue") || fw === "nuxt") {
            let asyncCount = 0;
            for (const f of files) {
                try {
                    if (/defineAsyncComponent|import\(/.test(fs.readFileSync(f, "utf8")))
                        asyncCount++;
                } catch {
                    /* ignore */
                }
            }
            check(
                asyncCount > 0,
                asyncCount > 0 ? `Async components: ${asyncCount}` : "No async components"
            );
        }

        if (this._isBackend()) {
            const hasCache = !!allDeps.redis || !!allDeps["lru-cache"] || !!allDeps["node-cache"];
            check(hasCache, hasCache ? "Caching solution" : "No caching");
            check(!!allDeps.compression, allDeps.compression ? "Compression" : "No compression");
        }

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Performance", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditBestPractices() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };
        const files = this._walk(this.srcDir);
        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        const fw = this.framework.name;

        if (fw.startsWith("react") || fw.startsWith("next")) {
            let errBoundary = 0,
                hookCount = 0;
            for (const f of files) {
                try {
                    const c = fs.readFileSync(f, "utf8");
                    if (/ErrorBoundary|componentDidCatch/.test(c)) errBoundary++;
                    if (this._norm(f).includes("/hooks/") && path.basename(f).startsWith("use"))
                        hookCount++;
                } catch {
                    /* ignore */
                }
            }
            check(
                errBoundary > 0,
                errBoundary > 0 ? `Error boundaries: ${errBoundary}` : "No ErrorBoundary"
            );
            check(
                hookCount >= 3,
                hookCount >= 3 ? `Custom hooks: ${hookCount}` : `Few custom hooks (${hookCount})`
            );
            const hasStateMgmt =
                !!allDeps.zustand ||
                !!allDeps["@reduxjs/toolkit"] ||
                !!allDeps.redux ||
                !!allDeps.recoil ||
                !!allDeps.jotai;
            check(hasStateMgmt, hasStateMgmt ? "State management" : "No state management");
        }

        if (fw === "angular") {
            let standalone = 0;
            for (const f of files) {
                try {
                    if (/standalone.*true/.test(fs.readFileSync(f, "utf8"))) standalone++;
                } catch {
                    /* ignore */
                }
            }
            check(
                standalone > 0,
                standalone > 0 ? `Standalone components: ${standalone}` : "No standalone components"
            );
        }

        if (fw.startsWith("vue") || fw === "nuxt") {
            let compositionAPI = 0;
            for (const f of files) {
                try {
                    if (/<script setup/.test(fs.readFileSync(f, "utf8"))) compositionAPI++;
                } catch {
                    /* ignore */
                }
            }
            check(
                compositionAPI > 0,
                compositionAPI > 0
                    ? `Composition API: ${compositionAPI} files`
                    : "Use Composition API"
            );
            check(!!allDeps.pinia, allDeps.pinia ? "Pinia installed" : "No Pinia");
        }

        if (this._isBackend()) {
            const hasValidation =
                !!allDeps.zod || !!allDeps.joi || !!allDeps.yup || !!allDeps["class-validator"];
            check(hasValidation, hasValidation ? "Input validation" : "No validation library");
            const hasLogging = !!allDeps.winston || !!allDeps.pino || !!allDeps.morgan;
            check(hasLogging, hasLogging ? "Logging library" : "No logging");
        }

        const testFiles = this._walk(this.dir).filter(
            (f) => f.includes(".test.") || f.includes(".spec.")
        );
        check(
            testFiles.length >= 5,
            testFiles.length >= 5
                ? `Tests: ${testFiles.length} files`
                : `Only ${testFiles.length} test files`
        );

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Best Practices", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditAlternatives() {
        const deps = this.pkg.dependencies || {};
        let sug = 0;
        let rows =
            "| Current | Better Alternative | Why |\n|---------|-------------------|-----|\n";

        const swaps = {
            moment: ["dayjs", "97% smaller, same API"],
            axios: ["native fetch", "Zero bundle cost"],
            lodash: ["lodash-es", "Tree-shakeable"],
            uuid: ["crypto.randomUUID()", "Native, zero bundle"],
            classnames: ["clsx", "14x smaller"],
            redux: ["zustand", "Less boilerplate"],
            vuex: ["pinia", "Official Vue recommendation"],
            formik: ["react-hook-form", "Better performance"],
            jest: ["vitest", "Faster, native ESM"],
            webpack: ["Vite", "10-100x faster"],
            nodemon: ["node --watch", "Native Node 18+"],
            dotenv: ["node --env-file", "Native Node 20+"],
            chalk: ["picocolors", "14x smaller"],
            "ts-node": ["tsx", "Faster, ESM support"],
            "styled-components": ["Tailwind CSS", "Zero runtime"],
            sequelize: ["Drizzle ORM", "Type-safe, lighter"],
        };

        for (const [pkg, [alt, why]] of Object.entries(swaps)) {
            if (deps[pkg]) {
                rows += `| \`${pkg}\` | **${alt}** | ${why} |\n`;
                sug++;
            }
        }

        if (sug === 0) rows += "| ✅ | Your stack is modern | No swaps needed |\n";
        this._score("Alternatives", Math.max(0, 100 - sug * 5));
        return rows + `\n**${sug}** suggestions\n`;
    }

    auditEnv() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        check(fs.existsSync(path.join(this.dir, "README.md")), "README.md");
        check(fs.existsSync(path.join(this.dir, "LICENSE")), "LICENSE");
        check(fs.existsSync(path.join(this.dir, ".editorconfig")), ".editorconfig");
        check(
            fs.existsSync(path.join(this.dir, "Dockerfile")) ||
                fs.existsSync(path.join(this.dir, "docker-compose.yml")),
            "Docker config"
        );
        check(fs.existsSync(path.join(this.dir, ".github", "workflows")), "CI/CD pipeline");

        const scripts = this.pkg.scripts || {};
        for (const s of ["dev", "build", "test", "lint"]) {
            check(!!scripts[s], `Script: ${s}`);
        }

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Environment", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditGitHealth() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        if (!fs.existsSync(path.join(this.dir, ".git"))) {
            this._score("Git Health", 50);
            return "Not a git repository.\n";
        }

        const { execSync } = require("child_process");

        try {
            const branches = execSync("git branch", {
                cwd: this.dir,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            })
                .trim()
                .split("\n").length;
            check(
                branches <= 20,
                branches <= 20
                    ? `${branches} local branches`
                    : `${branches} local branches — cleanup stale ones`
            );
        } catch {
            /* git not available */
        }

        try {
            const dirty = execSync("git status --porcelain", {
                cwd: this.dir,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            }).trim();
            const dirtyCount = dirty ? dirty.split("\n").length : 0;
            check(
                dirtyCount === 0,
                dirtyCount === 0 ? "Clean working tree" : `${dirtyCount} uncommitted changes`
            );
        } catch {
            /* ignore */
        }

        check(fs.existsSync(path.join(this.dir, ".gitignore")), ".gitignore exists");

        try {
            const last5 = execSync("git log --oneline -5", {
                cwd: this.dir,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            }).trim();
            const conventional = (
                last5.match(
                    /^[a-f0-9]+ (feat|fix|chore|docs|style|refactor|test|build|ci|perf)(\(.+\))?:/gm
                ) || []
            ).length;
            check(
                conventional >= 3,
                conventional >= 3 ? "Conventional commits used" : "Not using conventional commits"
            );
        } catch {
            /* ignore */
        }

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Git Health", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditTests() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        const srcFiles = this._walk(this.srcDir).filter(
            (f) =>
                !f.includes(".test.") &&
                !f.includes(".spec.") &&
                !path.basename(f).startsWith("index.") &&
                !f.endsWith(".d.ts")
        );
        const testFiles = this._walk(this.dir).filter(
            (f) => f.includes(".test.") || f.includes(".spec.")
        );

        const srcCount = srcFiles.length;
        const testCount = testFiles.length;
        const ratio = srcCount > 0 ? Math.round((testCount * 100) / srcCount) : 0;

        rows += `\n**Source files:** ${srcCount} · **Test files:** ${testCount} · **Ratio:** ${ratio}%\n\n`;

        check(
            testCount >= 1,
            testCount >= 1 ? `Tests exist (${testCount} files)` : "No test files found"
        );
        check(
            ratio >= 50,
            ratio >= 50
                ? `Good test ratio (${ratio}%)`
                : `Low test ratio (${ratio}%) — aim for 50%+`
        );

        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        const runners = [
            "vitest",
            "jest",
            "mocha",
            "cypress",
            "playwright",
            "@testing-library/react",
        ];
        const hasRunner = runners.some((r) => !!allDeps[r]);
        check(hasRunner, hasRunner ? `Test runner installed` : "No test runner installed");

        const scripts = this.pkg.scripts || {};
        check(
            !!scripts.test,
            scripts.test ? "npm test script configured" : "No test script in package.json"
        );

        check(
            fs.existsSync(path.join(this.dir, "coverage")),
            fs.existsSync(path.join(this.dir, "coverage"))
                ? "Coverage report exists"
                : "No coverage report"
        );

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Tests", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditA11y() {
        if (!this._isFrontend()) {
            this._score("A11y", 100);
            return "Skipped — backend project.\n";
        }

        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };

        const files = this._walk(this.srcDir);
        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
        let imgNoAlt = 0,
            semanticFiles = 0,
            ariaFiles = 0;

        for (const f of files) {
            try {
                const c = fs.readFileSync(f, "utf8");
                if (/<img\b/.test(c) && !/alt\s*=/.test(c)) imgNoAlt++;
                if (/<main|<nav|<header|<footer|<section|<article|<aside/.test(c)) semanticFiles++;
                if (/aria-|role=/.test(c)) ariaFiles++;
            } catch {
                /* ignore */
            }
        }

        check(
            imgNoAlt === 0,
            imgNoAlt === 0
                ? "All <img> have alt attributes"
                : `${imgNoAlt} files: <img> without alt`
        );
        check(
            ariaFiles > 0,
            ariaFiles > 0
                ? `ARIA attributes used in ${ariaFiles} files`
                : "No ARIA attributes found"
        );
        check(
            semanticFiles > 0,
            semanticFiles > 0
                ? `Semantic HTML used (${semanticFiles} files)`
                : "No semantic HTML (<main>, <nav>, etc.)"
        );

        const hasA11yTool =
            !!allDeps["axe-core"] ||
            !!allDeps["@axe-core/react"] ||
            !!allDeps["jest-axe"] ||
            !!allDeps["eslint-plugin-jsx-a11y"];
        check(
            hasA11yTool,
            hasA11yTool
                ? "A11y testing tool installed"
                : "No a11y testing (add eslint-plugin-jsx-a11y or axe-core)"
        );

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("A11y", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }

    auditDocs() {
        let checks = 0,
            issues = 0;
        let rows = "| Status | Check |\n|--------|-------|\n";
        const check = (pass, msg) => {
            checks++;
            if (!pass) issues++;
            rows += `| ${pass ? "✅" : "🟡"} | ${msg} |\n`;
        };
        const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };

        if (fs.existsSync(path.join(this.dir, "README.md"))) {
            let readmeLines = 0;
            try {
                readmeLines = fs
                    .readFileSync(path.join(this.dir, "README.md"), "utf8")
                    .split("\n").length;
            } catch {
                /* ignore */
            }
            check(
                readmeLines >= 30,
                readmeLines >= 30
                    ? `README.md (${readmeLines} lines)`
                    : `README.md is thin (${readmeLines} lines)`
            );

            try {
                const readme = fs
                    .readFileSync(path.join(this.dir, "README.md"), "utf8")
                    .toLowerCase();
                check(readme.includes("install"), "README has install instructions");
                check(
                    readme.includes("usage") ||
                        readme.includes("getting started") ||
                        readme.includes("quick start"),
                    "README has usage section"
                );
            } catch {
                /* ignore */
            }
        } else {
            check(false, "No README.md");
        }

        check(
            fs.existsSync(path.join(this.dir, "CHANGELOG.md")) ||
                fs.existsSync(path.join(this.dir, "HISTORY.md")),
            "CHANGELOG exists"
        );

        if (this._isBackend()) {
            const hasDocs =
                !!allDeps["@nestjs/swagger"] ||
                !!allDeps["swagger-jsdoc"] ||
                !!allDeps["swagger-ui-express"] ||
                !!allDeps["@fastify/swagger"];
            check(hasDocs, hasDocs ? "Swagger/OpenAPI documentation" : "No API documentation tool");
        }

        const srcFiles = this._walk(this.srcDir).filter(
            (f) =>
                !f.includes(".test.") &&
                !f.includes(".spec.") &&
                !f.endsWith(".d.ts") &&
                !path.basename(f).startsWith("index.")
        );
        let documented = 0;
        for (const f of srcFiles) {
            try {
                if (fs.readFileSync(f, "utf8").includes("/**")) documented++;
            } catch {
                /* ignore */
            }
        }
        if (srcFiles.length > 0) {
            const pct = Math.round((documented * 100) / srcFiles.length);
            check(
                pct >= 30,
                pct >= 30 ? `JSDoc/TSDoc: ${pct}% of files` : `Low JSDoc/TSDoc coverage: ${pct}%`
            );
        }

        check(fs.existsSync(path.join(this.dir, "CONTRIBUTING.md")), "CONTRIBUTING.md exists");

        const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
        this._score("Docs", score);
        return rows + `\n**${checks}** checks, **${issues}** issues\n`;
    }
}

module.exports = { JSEngine };
