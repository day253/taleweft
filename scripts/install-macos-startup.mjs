import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin") throw new Error("This installer is for macOS; use pm2 startup on other systems.");
const pm2 = join(dirname(process.execPath), "../lib/node_modules/pm2/bin/pm2");
await access(pm2);
const directory = join(homedir(), "Library/LaunchAgents");
const label = "com.taleweft.pm2";
const file = join(directory, `${label}.plist`);
const pm2Home = process.env.PM2_HOME || join(homedir(), ".pm2");
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
execFileSync(process.execPath, [pm2, "save"], { stdio: "inherit" });
await mkdir(directory, { recursive: true });
await writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(pm2)}</string><string>resurrect</string></array>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${escape(dirname(process.execPath))}:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PM2_HOME</key><string>${escape(pm2Home)}</string>
  </dict>
  <key>StandardOutPath</key><string>${escape(join(pm2Home, "launchd-out.log"))}</string>
  <key>StandardErrorPath</key><string>${escape(join(pm2Home, "launchd-error.log"))}</string>
</dict></plist>
`, { mode: 0o600 });
execFileSync("plutil", ["-lint", file], { stdio: "inherit" });
const domain = `gui/${process.getuid()}`;
try { execFileSync("launchctl", ["bootout", `${domain}/${label}`], { stdio: "ignore" }); } catch { /* First installation. */ }
execFileSync("launchctl", ["bootstrap", domain, file], { stdio: "inherit" });
execFileSync("launchctl", ["enable", `${domain}/${label}`], { stdio: "inherit" });
console.log(`Installed ${file}. PM2 will restore saved services after this user logs in.`);
