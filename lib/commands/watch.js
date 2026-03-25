const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const { ensureInsideProject } = require("../utils/helpers");

function watchCommand(directory, opts) {
    const dir = path.resolve(directory);
    ensureInsideProject(dir);
    const debounce = parseInt(opts.debounce) || 3000;
    console.log(`\n  ${chalk.bold("👁  Watch Mode")}`);
    console.log(chalk.dim(`  Debounce: ${debounce}ms · Ctrl+C to stop\n`));
    let timer = null;
    const srcDir = fs.existsSync(path.join(dir, "src")) ? path.join(dir, "src") : dir;
    const run = () => {
        console.log(chalk.dim(`\n  ─── Re-running (${new Date().toLocaleTimeString()}) ───\n`));
        try { execSync(`node "${path.join(__dirname, "../../bin/cli.js")}" "${dir}" -n "watch-latest"`, { stdio: "inherit" }); } catch {}
    };
    run();
    try {
        fs.watch(srcDir, { recursive: true }, (_, f) => {
            if (!f || f.includes("node_modules") || f.includes(".git") || f.includes("audits")) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(run, debounce);
        });
    } catch { setInterval(run, Math.max(debounce, 10000)); }
}

module.exports = watchCommand;
