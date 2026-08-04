import { spawn, execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const PROXY_PORT = Number(process.env.AGENT_RECOVERY_PROXY_PORT ?? 8787);
const METRO_PORT = Number(process.env.AGENT_RECOVERY_METRO_PORT ?? 8082);
const UPSTREAM_API_URL = process.env.EXPO_PUBLIC_GUMROAD_API_URL;
const APP_ID = process.env.IOS_BUNDLE_NAME;
const HOP_BY_HOP_HEADERS = new Set(["connection", "content-encoding", "content-length", "host", "transfer-encoding"]);

if (!UPSTREAM_API_URL) throw new Error("EXPO_PUBLIC_GUMROAD_API_URL is required");
if (!APP_ID) throw new Error("IOS_BUNDLE_NAME is required");

const state = { streamCut: false, turnId: undefined, statuses: [] };

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const requestHeaders = (request) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("accept-encoding", "identity");
  return headers;
};

const applyResponse = (source, destination) => {
  destination.statusCode = source.status;
  for (const [name, value] of source.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name)) destination.setHeader(name, value);
  }
};

const sendBufferedResponse = async (upstreamResponse, response, pathname) => {
  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  const match = pathname.match(/^\/mobile\/agent\/turns\/([^/]+)$/);
  if (match && decodeURIComponent(match[1]) === state.turnId) {
    const payload = JSON.parse(body.toString("utf8"));
    if (payload.status) {
      state.statuses.push(payload.status);
      process.stdout.write(`turn status: ${payload.status}\n`);
    }
  }
  applyResponse(upstreamResponse, response);
  response.end(body);
};

const relayInterruptedStream = async (upstreamResponse, response, turnId) => {
  if (!upstreamResponse.body) {
    await sendBufferedResponse(upstreamResponse, response, "");
    return;
  }

  applyResponse(upstreamResponse, response);
  response.flushHeaders();
  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  const interruptThisStream = !state.streamCut;
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      if (!interruptThisStream) {
        await new Promise((resolve) => response.write(`${frame}\n\n`, resolve));
      } else if (!state.streamCut) {
        await new Promise((resolve) => response.write(`${frame}\n\n`, resolve));
        if (/^event:\s*token$/m.test(frame)) {
          state.streamCut = true;
          state.turnId = turnId;
          process.stdout.write(`stream interrupted: ${turnId}\n`);
          response.destroy();
        }
      }
      separator = buffer.indexOf("\n\n");
    }
  }

  if (!response.destroyed) response.end(buffer);
};

const proxy = http.createServer((request, response) => {
  void (async () => {
    const body = await readBody(request);
    const url = new URL(request.url ?? "/", UPSTREAM_API_URL);
    const upstreamResponse = await fetch(url, {
      method: request.method,
      headers: requestHeaders(request),
      body: body.length > 0 ? body : undefined,
      redirect: "follow",
    });

    if (request.method === "POST" && url.pathname === "/mobile/agent/messages/stream") {
      const turnId = JSON.parse(body.toString("utf8")).client_turn_id;
      await relayInterruptedStream(upstreamResponse, response, turnId);
      return;
    }

    await sendBufferedResponse(upstreamResponse, response, url.pathname);
  })().catch((error) => {
    if (!response.destroyed) {
      response.statusCode = 502;
      response.end("Proxy request failed");
    }
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  });
});

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

const waitForPort = async (port) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for port ${port}`);
};

const run = (command, args, options = {}) => {
  const child = spawn(command, args, options);
  return {
    child,
    completion: new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    }),
  };
};

const stop = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) =>
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000),
    ),
  ]);
};

const bootedDevices = JSON.parse(
  execFileSync("xcrun", ["simctl", "list", "devices", "booted", "-j"], { encoding: "utf8" }),
);
const iPhone = Object.values(bootedDevices.devices)
  .flat()
  .find((device) => device.name.startsWith("iPhone"));
if (!iPhone) throw new Error("A booted iPhone Simulator is required");

if (await isPortOpen(METRO_PORT)) throw new Error(`Port ${METRO_PORT} is already in use`);

await new Promise((resolve, reject) => {
  proxy.once("error", reject);
  proxy.listen(PROXY_PORT, "127.0.0.1", resolve);
});

const artifacts = await mkdtemp(path.join(os.tmpdir(), "gumroad-agent-recovery-"));
const metro = run(
  path.join(process.cwd(), "node_modules", ".bin", "expo"),
  ["start", "--dev-client", "--clear", "--port", String(METRO_PORT)],
  {
    env: {
      ...process.env,
      CI: "1",
      EXPO_PUBLIC_GUMROAD_API_URL: `http://127.0.0.1:${PROXY_PORT}`,
    },
    stdio: "inherit",
  },
);

try {
  await waitForPort(METRO_PORT);
  process.stdout.write(`artifacts: ${artifacts}\n`);
  const maestro = run(
    process.env.MAESTRO_BIN ?? "maestro",
    [
      "test",
      "--no-ansi",
      "-p",
      "ios",
      "--udid",
      iPhone.udid,
      "--test-output-dir",
      artifacts,
      "-e",
      `APP_ID=${APP_ID}`,
      ".maestro/agent-turn-recovery.yaml",
    ],
    { stdio: "inherit" },
  );
  const result = await maestro.completion;
  if (result.code !== 0) throw new Error(`Maestro failed with exit code ${result.code}`);
  if (!state.streamCut) throw new Error("The proxy did not interrupt an agent stream");
  if (!state.statuses.includes("persisted"))
    throw new Error(`Turn recovery never reached persisted: ${state.statuses.join(", ")}`);
  process.stdout.write("agent turn recovery e2e passed\n");
} finally {
  await stop(metro.child);
  proxy.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
}
