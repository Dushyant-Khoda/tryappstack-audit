/**
 * Pure JS audit engine — runs when bash is not available (Windows without WSL)
 * Implements core modules in JavaScript for cross-platform compatibility
 */

const fs = require('fs');
const path = require('path');

class JSEngine {
  constructor(dir, opts = {}) {
    this.dir = path.resolve(dir);
    this.opts = opts;
    this.scores = {};
    this.issues = {};
    this.report = '';
    this.pkg = this._readJSON(path.join(this.dir, 'package.json'));
    this.framework = this._detectFramework();
    this.srcDir = this._findSrcDir();
  }

  run() {
    const modules = [
      ['📏', 'LOC Health', () => this.auditLOC()],
      ['📦', 'Unused Pkgs', () => this.auditUnusedPackages()],
      ['💀', 'Dead Code', () => this.auditDeadCode()],
      ['🏗️', 'Structure', () => this.auditStructure()],
      ['🔗', 'Dep Health', () => this.auditDeps()],
      ['🧠', 'Complexity', () => this.auditComplexity()],
      ['🔒', 'Security', () => this.auditSecurity()],
      ['📦', 'Bundle', () => this.auditBundle()],
      ['🛠️', 'Environment', () => this.auditEnv()],
    ];

    for (const [icon, name, fn] of modules) {
      try {
        this.report += `## ${icon} ${name}\n\n`;
        this.report += fn() + '\n\n';
      } catch (e) {
        this.report += `> Module error: ${e.message}\n\n`;
      }
    }

    return { scores: this.scores, issues: this.issues, report: this.report, framework: this.framework };
  }

  _score(name, val) {
    val = Math.max(0, Math.min(100, val));
    this.scores[name] = val;
  }

  _readJSON(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
  }

  _detectFramework() {
    const d = this.pkg.dependencies || {};
    const dd = this.pkg.devDependencies || {};
    const all = { ...d, ...dd };
    if (all.next) return { name: 'nextjs', display: 'Next.js' };
    if (all['@angular/core']) return { name: 'angular', display: 'Angular' };
    if (all.vue) return { name: 'vue', display: 'Vue.js' };
    if (all.nuxt) return { name: 'nuxt', display: 'Nuxt.js' };
    if (all['@nestjs/core']) return { name: 'nestjs', display: 'NestJS' };
    if (all.express) return { name: 'express', display: 'Express.js' };
    if (all.fastify) return { name: 'fastify', display: 'Fastify' };
    if (all.react && all.vite) return { name: 'react-vite', display: 'React + Vite' };
    if (all.react) return { name: 'react', display: 'React' };
    return { name: 'node', display: 'Node.js' };
  }

  _findSrcDir() {
    for (const d of ['src', 'app', 'lib']) {
      if (fs.existsSync(path.join(this.dir, d))) return path.join(this.dir, d);
    }
    return this.dir;
  }

  _walk(dir, exts = ['.ts', '.tsx', '.js', '.jsx', '.vue'], exclude = ['node_modules', '.git', 'dist', '.next', 'build', 'coverage']) {
    const results = [];
    const _walk = (d) => {
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (exclude.includes(e.name)) continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) _walk(full);
        else if (exts.some(x => e.name.endsWith(x))) results.push(full);
      }
    };
    _walk(dir);
    return results;
  }

  _getCategory(filepath) {
    const name = path.basename(filepath);
    const dir = path.dirname(filepath);
    if (dir.includes('/pages') || dir.includes('/views')) return 'Page';
    if (dir.includes('/components')) return 'Component';
    if (dir.includes('/hooks') || name.startsWith('use')) return 'Hook';
    if (dir.includes('/utils') || dir.includes('/helpers') || dir.includes('/lib')) return 'Utility';
    if (dir.includes('/ui')) return 'UI';
    if (name.startsWith('index.')) return 'Barrel';
    if (name.includes('.test.') || name.includes('.spec.')) return 'Test';
    return 'Source';
  }

  // ── Modules ──

  auditLOC() {
    const files = this._walk(this.dir);
    let crit = 0, warn = 0, good = 0, clean = 0;
    let rows = '| File | Lines | Type | Status | Action |\n|------|-------|------|--------|--------|\n';

    for (const f of files) {
      const rel = path.relative(this.dir, f);
      const cat = this._getCategory(f);
      if (['Test', 'Barrel', 'Config'].includes(cat)) continue;

      let lines;
      try { lines = fs.readFileSync(f, 'utf8').split('\n').length; } catch { continue; }

      const thresholds = cat === 'Page' ? [300, 500] : cat === 'Component' ? [200, 400] : cat === 'Hook' ? [150, 999] : [150, 300];
      let status, action, emoji;

      if (lines > thresholds[1]) { emoji = '🔴'; status = 'Critical'; action = 'Split immediately'; crit++; }
      else if (lines > thresholds[0]) { emoji = '🟡'; status = 'Reduce'; action = 'Extract logic'; warn++; }
      else if (lines > 100) { emoji = '🟢'; status = 'OK'; action = '—'; good++; }
      else { emoji = '✅'; status = 'Clean'; action = '—'; clean++; }

      if (emoji === '🔴' || emoji === '🟡') {
        rows += `| \`${rel}\` | ${lines} | ${cat} | ${emoji} ${status} | ${action} |\n`;
      }
    }

    const total = crit + warn + good + clean;
    const score = total > 0 ? Math.round((clean * 100 + good * 75 + warn * 40 + crit * 10) / total) : 100;
    this._score('LOC Health', score);
    return rows + `\n**Summary:** 🔴 ${crit} · 🟡 ${warn} · 🟢 ${good} · ✅ ${clean}\n`;
  }

  auditUnusedPackages() {
    const deps = Object.keys(this.pkg.dependencies || {});
    const files = this._walk(this.dir);
    const implicit = /^(@types\/|typescript|vite|tailwindcss|postcss|autoprefixer|eslint|prettier|vitest|@vitejs\/|@eslint\/|tsx|ts-node|nodemon|sass|dotenv|husky|lint-staged)/;

    let imports = '';
    for (const f of files) {
      try { imports += fs.readFileSync(f, 'utf8'); } catch {}
    }

    let unused = 0;
    let rows = '| Package | Status |\n|---------|--------|\n';

    for (const dep of deps) {
      if (implicit.test(dep)) continue;
      if (imports.includes(dep)) continue;
      rows += `| \`${dep}\` | 🔴 Unused |\n`;
      unused++;
    }

    if (unused === 0) rows += '| ✅ | All packages in use |\n';
    const score = deps.length > 0 ? Math.round(((deps.length - unused) * 100) / deps.length) : 100;
    this._score('Unused Pkgs', score);
    return rows + `\n**${unused}** potentially unused\n`;
  }

  auditDeadCode() {
    const files = this._walk(this.srcDir);
    let imports = '';
    for (const f of files) { try { imports += fs.readFileSync(f, 'utf8'); } catch {} }

    let dead = 0, total = 0;
    let rows = '| File | Type | Status |\n|------|------|--------|\n';

    for (const f of files) {
      const name = path.basename(f).replace(/\.[^.]+$/, '');
      const cat = this._getCategory(f);
      if (['Test', 'Barrel', 'Config'].includes(cat)) continue;
      if (['main', 'index', 'App', 'app.module', 'vite-env.d', 'setup'].includes(name)) continue;
      total++;

      // Simple check: is the filename referenced in other files?
      const otherImports = files.filter(o => o !== f).map(o => { try { return fs.readFileSync(o, 'utf8'); } catch { return ''; } }).join('');
      if (!otherImports.includes(name)) {
        rows += `| \`${path.relative(this.dir, f)}\` | ${cat} | 🔴 Unused |\n`;
        dead++;
      }
    }

    const score = total > 0 ? Math.round(((total - dead) * 100) / total) : 100;
    this._score('Dead Code', score);
    return rows + `\n**${dead}** potentially dead files\n`;
  }

  auditStructure() {
    let checks = 0, issues = 0;
    let rows = '| Status | Check |\n|--------|-------|\n';

    const check = (pass, msg) => { checks++; if (!pass) issues++; rows += `| ${pass ? '✅' : '🟡'} | ${msg} |\n`; };

    check(fs.existsSync(path.join(this.dir, 'src')), 'src/ directory exists');
    check(fs.existsSync(path.join(this.dir, '.gitignore')), '.gitignore exists');
    check(fs.existsSync(path.join(this.dir, 'tsconfig.json')), 'TypeScript configured');
    check(fs.existsSync(path.join(this.dir, 'README.md')), 'README.md exists');

    // Duplicate filenames
    const files = this._walk(this.srcDir);
    const names = files.map(f => path.basename(f)).filter(n => !n.startsWith('index.'));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    check(dupes.length === 0, dupes.length === 0 ? 'No duplicate filenames' : `Duplicate: ${[...new Set(dupes)].join(', ')}`);

    const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
    this._score('Structure', score);
    return rows + `\n**${checks}** checks, **${issues}** issues\n`;
  }

  auditDeps() {
    let checks = 0, issues = 0;
    let rows = '| Status | Check |\n|--------|-------|\n';
    const check = (pass, msg) => { checks++; if (!pass) issues++; rows += `| ${pass ? '✅' : '🟡'} | ${msg} |\n`; };

    check(fs.existsSync(path.join(this.dir, 'package-lock.json')) || fs.existsSync(path.join(this.dir, 'yarn.lock')) || fs.existsSync(path.join(this.dir, 'pnpm-lock.yaml')), 'Lock file exists');
    check(fs.existsSync(path.join(this.dir, '.nvmrc')) || fs.existsSync(path.join(this.dir, '.node-version')), 'Node version pinned');

    const tsconfig = this._readJSON(path.join(this.dir, 'tsconfig.json'));
    if (tsconfig.compilerOptions) {
      check(tsconfig.compilerOptions.strict === true, 'TypeScript strict mode');
    }

    const allDeps = { ...(this.pkg.dependencies || {}), ...(this.pkg.devDependencies || {}) };
    check(!!allDeps.eslint || !!allDeps['@eslint/js'], 'ESLint configured');
    check(!!allDeps.prettier, 'Prettier configured');

    const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
    this._score('Dep Health', score);
    return rows + `\n**${checks}** checks, **${issues}** issues\n`;
  }

  auditComplexity() {
    const files = this._walk(this.srcDir);
    let issues = 0;
    let rows = '| File | Issue | Action |\n|------|-------|--------|\n';

    for (const f of files) {
      if (f.includes('.test.') || f.includes('.spec.')) continue;
      let content;
      try { content = fs.readFileSync(f, 'utf8'); } catch { continue; }
      const rel = path.relative(this.dir, f);

      const effects = (content.match(/useEffect|watchEffect|watch\(/g) || []).length;
      if (effects > 3) { rows += `| \`${rel}\` | ${effects} effects | Extract to hooks |\n`; issues++; }

      const states = (content.match(/useState|ref\(|reactive\(/g) || []).length;
      if (states > 6) { rows += `| \`${rel}\` | ${states} state vars | Use reducer |\n`; issues++; }

      const anys = (content.match(/:\s*any\b|<any>|as any/g) || []).length;
      if (anys > 3) { rows += `| \`${rel}\` | ${anys} \`any\` types | Add types |\n`; issues++; }

      const consoles = (content.match(/console\.(log|warn|debug)/g) || []).length;
      if (consoles > 0) { rows += `| \`${rel}\` | ${consoles} console.log | Remove |\n`; issues++; }
    }

    if (issues === 0) rows += '| ✅ | No issues | — |\n';
    this._score('Complexity', Math.max(0, 100 - issues * 8));
    return rows + `\n**${issues}** complexity issues\n`;
  }

  auditSecurity() {
    let checks = 0, issues = 0;
    let rows = '| Status | Check |\n|--------|-------|\n';
    const check = (pass, msg) => { checks++; if (!pass) issues++; rows += `| ${pass ? '✅' : '🔴'} | ${msg} |\n`; };

    // .env gitignored
    if (fs.existsSync(path.join(this.dir, '.env'))) {
      const gi = fs.existsSync(path.join(this.dir, '.gitignore')) ? fs.readFileSync(path.join(this.dir, '.gitignore'), 'utf8') : '';
      check(gi.includes('.env'), '.env is gitignored');
    }

    check(fs.existsSync(path.join(this.dir, '.env.example')) || fs.existsSync(path.join(this.dir, '.env.template')), '.env.example exists');

    // Hardcoded secrets
    const files = this._walk(this.srcDir);
    let secretFiles = 0;
    for (const f of files) {
      try {
        const c = fs.readFileSync(f, 'utf8');
        if (/(?:api_key|secret|password|token)\s*[=:]\s*["'][^"']{8,}/i.test(c)) secretFiles++;
      } catch {}
    }
    check(secretFiles === 0, secretFiles === 0 ? 'No hardcoded secrets' : `Possible secrets in ${secretFiles} files`);

    const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
    this._score('Security', score);
    return rows + `\n**${checks}** checks, **${issues}** issues\n`;
  }

  auditBundle() {
    const deps = this.pkg.dependencies || {};
    let sug = 0;
    let rows = '| Current | Alternative | Why |\n|---------|------------|-----|\n';

    const swaps = {
      moment: ['dayjs', '97% smaller'], axios: ['native fetch', 'Zero bundle'],
      lodash: ['lodash-es', 'Tree-shakeable'], uuid: ['crypto.randomUUID()', 'Native'],
      classnames: ['clsx', '14x smaller'], nodemon: ['node --watch', 'Native'],
      dotenv: ['node --env-file', 'Native Node 20+'], chalk: ['picocolors', '14x smaller'],
    };

    for (const [pkg, [alt, why]] of Object.entries(swaps)) {
      if (deps[pkg]) { rows += `| \`${pkg}\` | **${alt}** | ${why} |\n`; sug++; }
    }

    if (sug === 0) rows += '| ✅ | Modern stack | No swaps |\n';
    this._score('Bundle', Math.max(0, 100 - sug * 7));
    return rows + `\n**${sug}** suggestions\n`;
  }

  auditEnv() {
    let checks = 0, issues = 0;
    let rows = '| Status | Check |\n|--------|-------|\n';
    const check = (pass, msg) => { checks++; if (!pass) issues++; rows += `| ${pass ? '✅' : '🟡'} | ${msg} |\n`; };

    check(fs.existsSync(path.join(this.dir, 'README.md')), 'README.md');
    check(fs.existsSync(path.join(this.dir, 'LICENSE')), 'LICENSE');
    check(fs.existsSync(path.join(this.dir, '.editorconfig')), '.editorconfig');
    check(fs.existsSync(path.join(this.dir, 'Dockerfile')) || fs.existsSync(path.join(this.dir, 'docker-compose.yml')), 'Docker config');
    check(fs.existsSync(path.join(this.dir, '.github', 'workflows')), 'CI/CD pipeline');

    const scripts = this.pkg.scripts || {};
    for (const s of ['dev', 'build', 'test', 'lint']) {
      check(!!scripts[s], `Script: ${s}`);
    }

    const score = checks > 0 ? Math.round(((checks - issues) * 100) / checks) : 100;
    this._score('Environment', score);
    return rows + `\n**${checks}** checks, **${issues}** issues\n`;
  }
}

module.exports = { JSEngine };
