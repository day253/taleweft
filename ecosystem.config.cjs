const { join, dirname } = require("node:path");
const { realpathSync } = require("node:fs");
const { homedir } = require("node:os");

const bridge = process.env.TALEWEFT_BRIDGE_DIR || join(__dirname, ".taleweft", "bridge");
const shared = {
  cwd: __dirname,
  interpreter: process.execPath,
  autorestart: true,
  restart_delay: 3000,
  kill_timeout: 10000,
  time: true,
};

module.exports = {
  apps: [
    {
      ...shared,
      name: "taleweft",
      script: join(__dirname, "node_modules/next/dist/bin/next"),
      args: ["start", "--hostname", "0.0.0.0", "--port", "3000"],
      env: { NODE_ENV: "production", TALEWEFT_BRIDGE_DIR: bridge },
    },
    {
      ...shared,
      name: "taleweft-dsh",
      // dsh guards its CLI with import.meta.main; launch Node directly instead of PM2's import wrapper.
      script: process.execPath,
      interpreter: "none",
      args: [realpathSync(process.env.DSH_BIN || join(dirname(process.execPath), "dsh")), "web", "--no-open", "--host", "127.0.0.1", "--port", "3080"],
      env: { DSH_HOME: process.env.DSH_HOME || join(homedir(), ".dsh"), TALEWEFT_BRIDGE_DIR: bridge },
    },
  ],
};
