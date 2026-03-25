const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { DOCTOR, PREFIX } = require("../constants");

function doctorCommand() {
    console.log(`\n  ${chalk.bold("🩺 " + DOCTOR.TITLE)}\n`);
    const checks = [
        ["Node.js", "node", true], ["npm", "npm", true], ["Git", "git", true],
        ["Bash", "bash", false], ["jq", "jq", false], ["cloc", "cloc", false],
    ];
    let ok = 0, warn = 0, fail = 0;
    for (const [name, cmd, required] of checks) {
        try {
            const ver = execSync(`${cmd} --version 2>/dev/null || ${cmd} -v 2>/dev/null`, { encoding: "utf8" }).trim().split("\n")[0].slice(0, 40);
            console.log(`  ${chalk.green("✓")} ${name} ${chalk.dim(ver)}`); ok++;
        } catch {
            if (required) { console.log(`  ${chalk.red("✗")} ${name} — ${chalk.red(DOCTOR.REQUIRED)}`); fail++; }
            else { console.log(`  ${chalk.yellow("○")} ${name} — ${chalk.yellow(DOCTOR.OPTIONAL)}`); warn++; }
        }
    }
    const cfgPath = path.join(os.homedir(), ".tryappstack", "config");
    if (fs.existsSync(cfgPath)) {
        const c = fs.readFileSync(cfgPath, "utf8");
        const p = c.match(/AI_PROVIDER="(\w+)"/);
        console.log(`\n  ${chalk.green("✓")} ${DOCTOR.AI_CONFIGURED(p ? p[1] : "configured")}`);
    } else {
        console.log(`\n  ${chalk.yellow("○")} ${DOCTOR.AI_NOT_CONFIGURED}`);
    }
    try { execSync("npx tryappstack --version 2>/dev/null"); console.log(`  ${chalk.green("✓")} ${DOCTOR.TAS_INSTALLED}`); }
    catch { console.log(`  ${chalk.yellow("○")} ${chalk.dim(DOCTOR.TAS_HINT)}`); }
    console.log(`\n  ${chalk.bold("Summary:")} ${chalk.green(ok + " ok")}, ${chalk.yellow(warn + " optional")}, ${chalk.red(fail + " missing")}\n`);
    process.exit(fail > 0 ? 1 : 0);
}

module.exports = doctorCommand;
