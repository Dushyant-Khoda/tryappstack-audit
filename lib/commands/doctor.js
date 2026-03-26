const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { DOCTOR } = require("../constants");

function getBashMajorVersion() {
    try {
        const ver = execSync("bash --version", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        const m = ver.match(/version\s+(\d+)/);
        return m ? parseInt(m[1]) : 0;
    } catch {
        return 0;
    }
}

function doctorCommand() {
    console.log(`\n  ${chalk.bold("🩺 " + DOCTOR.TITLE)}\n`);
    const checks = [
        ["Node.js", "node", true, "--version"],
        ["npm", "npm", true, "-v"],
        ["Git", "git", true, "--version"],
        ["Bash", "bash", false, "--version"],
        ["jq", "jq", false, "--version"],
        ["cloc", "cloc", false, "--version"],
    ];
    let ok = 0,
        warn = 0,
        fail = 0;
    for (const [name, cmd, required, flag] of checks) {
        try {
            const ver = execSync(`${cmd} ${flag}`, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            })
                .trim()
                .split("\n")[0]
                .slice(0, 40);
            console.log(`  ${chalk.green("✓")} ${name} ${chalk.dim(ver)}`);
            ok++;
        } catch {
            if (required) {
                console.log(`  ${chalk.red("✗")} ${name} — ${chalk.red(DOCTOR.REQUIRED)}`);
                fail++;
            } else {
                console.log(`  ${chalk.yellow("○")} ${name} — ${chalk.yellow(DOCTOR.OPTIONAL)}`);
                warn++;
            }
        }
    }

    const bashVer = getBashMajorVersion();
    if (bashVer >= 4) {
        console.log(`  ${chalk.green("✓")} Bash ${bashVer}.x ${chalk.dim("(engine compatible)")}`);
        ok++;
    } else if (bashVer > 0) {
        console.log(
            `  ${chalk.yellow("⚠")} Bash ${bashVer}.x — ${chalk.yellow("upgrade to 4+ for full engine")}`
        );
        if (os.platform() === "darwin") {
            console.log(`    ${chalk.dim("brew install bash")}`);
        }
        warn++;
    } else {
        console.log(
            `  ${chalk.yellow("○")} Bash version — ${chalk.dim("JS engine will be used as fallback")}`
        );
        warn++;
    }

    console.log(
        `\n  ${chalk.dim(`Platform: ${process.platform} (${os.arch()}) · Node ${process.version}`)}`
    );

    const cfgPath = path.join(os.homedir(), ".tryappstack", "config");
    if (fs.existsSync(cfgPath)) {
        const c = fs.readFileSync(cfgPath, "utf8");
        const p = c.match(/AI_PROVIDER="(\w+)"/);
        console.log(`\n  ${chalk.green("✓")} ${DOCTOR.AI_CONFIGURED(p ? p[1] : "configured")}`);
    } else {
        console.log(`\n  ${chalk.yellow("○")} ${DOCTOR.AI_NOT_CONFIGURED}`);
    }
    try {
        execSync("npx tryappstack --version", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        });
        console.log(`  ${chalk.green("✓")} ${DOCTOR.TAS_INSTALLED}`);
    } catch {
        console.log(`  ${chalk.yellow("○")} ${chalk.dim(DOCTOR.TAS_HINT)}`);
    }
    console.log(
        `\n  ${chalk.bold("Summary:")} ${chalk.green(ok + " ok")}, ${chalk.yellow(warn + " optional")}, ${chalk.red(fail + " missing")}\n`
    );
    process.exit(fail > 0 ? 1 : 0);
}

module.exports = doctorCommand;
