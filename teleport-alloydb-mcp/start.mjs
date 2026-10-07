import { spawn } from "node:child_process";

const {
  TELEPORT_PROXY = "teleport.glomopay-eng.com:443",
  TELEPORT_TOKEN = "render-agent",
  TELEPORT_DB_URI,
  MCP_PROXY_API_KEY,
  PORT = "8080",
} = process.env;

if (!TELEPORT_DB_URI) {
  console.error("TELEPORT_DB_URI is required, e.g.:");
  console.error(
    "  teleport://clusters/prod-teleport/databases/alloydb-production?dbName=glomopay_service&dbUser=teleport-token-v2@glomopay-production.iam",
  );
  process.exit(1);
}
if (!MCP_PROXY_API_KEY) {
  console.error("MCP_PROXY_API_KEY is required (clients must send X-API-Key)");
  process.exit(1);
}

const dataDir = "/tmp/teleport-data";
const identityDir = "/tmp/teleport-identity";

console.log("Starting tbot (bound_keypair join)...");
const tbot = spawn(
  "tbot",
  [
    "start",
    "identity",
    `--storage=file://${dataDir}`,
    `--destination=file://${identityDir}`,
    `--proxy-server=${TELEPORT_PROXY}`,
    `--token=${TELEPORT_TOKEN}`,
    "--join-method=bound_keypair",
    "--allow-reissue",
  ],
  { stdio: "inherit" },
);

tbot.on("exit", (code) => {
  console.error(`tbot exited unexpectedly with code ${code}`);
  process.exit(1);
});

// Wait for tbot's first successful join before starting the MCP bridge.
async function waitForIdentity() {
  const { existsSync } = await import("node:fs");
  const identityFile = `${identityDir}/identity`;
  for (let i = 0; i < 60; i++) {
    if (existsSync(identityFile)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for tbot to write identity file");
}

await waitForIdentity();
console.log("tbot identity ready, starting MCP proxy...");

// `tsh mcp db start` reads the identity file once at startup and keeps
// running indefinitely — it never notices tbot rewriting that file every
// 20 minutes, so its in-memory Teleport cert eventually hits the 1h TTL
// and every query starts failing with "Teleport session expired". Restart
// the child process on a cadence shorter than the TTL so it always picks
// up a fresh identity.
const RESTART_INTERVAL_MS = 35 * 60 * 1000;

const dbUriEscaped = TELEPORT_DB_URI.replace(/'/g, `'\\''`);
const childCommand = `tsh mcp db start -i '${identityDir}/identity' --proxy '${TELEPORT_PROXY}' '${dbUriEscaped}'`;

function startProxy() {
  const proxy = spawn(
    "npx",
    [
      "mcp-proxy",
      "--port",
      PORT,
      "--apiKey",
      MCP_PROXY_API_KEY,
      "--shell",
      childCommand,
    ],
    { stdio: "inherit" },
  );

  const restartTimer = setTimeout(() => {
    console.log("Restarting MCP proxy to refresh Teleport credentials...");
    proxy.kill();
  }, RESTART_INTERVAL_MS);

  proxy.on("exit", (code, signal) => {
    clearTimeout(restartTimer);
    if (signal) {
      startProxy();
      return;
    }
    process.exit(code ?? 1);
  });
}

startProxy();
