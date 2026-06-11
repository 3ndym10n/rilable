#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { buildAndroidWrapper } from "./android-wrapper";

type BuildRequest = {
  projectId?: string;
  appName?: string;
  packageId?: string;
  previewUrl?: string;
  artifactName?: string;
};

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function html(res: ServerResponse, body: string): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function demoStopwatchHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Forge Stopwatch</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:linear-gradient(135deg,#111827,#312e81); color:white; }
    main { width:min(34rem, calc(100vw - 2rem)); padding:2rem; border:1px solid rgba(255,255,255,.18); border-radius:28px; background:rgba(17,24,39,.72); box-shadow:0 24px 80px rgba(0,0,0,.35); text-align:center; }
    h1 { margin:0 0 .5rem; font-size:2rem; }
    p { margin:.25rem 0 1.5rem; color:#c7d2fe; }
    #time { font-variant-numeric:tabular-nums; font-size:4rem; font-weight:800; letter-spacing:.04em; margin:1.5rem 0; }
    .buttons { display:flex; gap:.75rem; justify-content:center; flex-wrap:wrap; }
    button { border:0; border-radius:999px; padding:.9rem 1.2rem; font-weight:800; color:#111827; background:#a7f3d0; }
    button.secondary { background:#bfdbfe; }
    button.danger { background:#fecaca; }
    footer { margin-top:1.5rem; color:#9ca3af; font-size:.85rem; }
  </style>
</head>
<body>
  <main>
    <h1>Forge Stopwatch</h1>
    <p>Real APK wrapper smoke test. Placeholder page removed. Tiny mercy.</p>
    <div id="time">00:00.0</div>
    <div class="buttons">
      <button id="start">Start</button>
      <button id="stop" class="secondary">Stop</button>
      <button id="reset" class="danger">Reset</button>
    </div>
    <footer>Served from the Virgil builder and wrapped by Capacitor.</footer>
  </main>
  <script>
    let startedAt = 0, elapsed = 0, timer = null;
    const time = document.getElementById('time');
    function render(ms) {
      const totalTenths = Math.floor(ms / 100);
      const tenths = totalTenths % 10;
      const seconds = Math.floor(totalTenths / 10) % 60;
      const minutes = Math.floor(totalTenths / 600);
      time.textContent = String(minutes).padStart(2,'0') + ':' + String(seconds).padStart(2,'0') + '.' + tenths;
    }
    function tick() { render(elapsed + Date.now() - startedAt); }
    document.getElementById('start').onclick = () => { if (timer) return; startedAt = Date.now(); timer = setInterval(tick, 50); tick(); };
    document.getElementById('stop').onclick = () => { if (!timer) return; elapsed += Date.now() - startedAt; clearInterval(timer); timer = null; render(elapsed); };
    document.getElementById('reset').onclick = () => { elapsed = 0; startedAt = Date.now(); render(0); };
    render(0);
  </script>
</body>
</html>`;
}

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolveBody(body));
    req.on("error", reject);
  });
}

function requireToken(req: IncomingMessage): boolean {
  const token = process.env.FORGE_ANDROID_APK_BUILDER_TOKEN;
  if (!token) return true;
  return req.headers.authorization === `Bearer ${token}`;
}

export function artifactRoot(): string {
  return resolve(process.env.FORGE_ANDROID_APK_ARTIFACT_DIR ?? "/home/v0id/.hermes/run/forge-android-apks");
}

export function publicBaseUrl(req: Pick<IncomingMessage, "headers">): string {
  const configured = process.env.FORGE_ANDROID_APK_BUILDER_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const host = req.headers.host ?? `127.0.0.1:${process.env.PORT ?? "8787"}`;
  return `http://${host}`;
}

function safeArtifactName(input: string | undefined, fallback: string): string {
  const name = basename(input || fallback).replace(/[^a-z0-9_.-]/gi, "-");
  return name.endsWith(".apk") ? name : `${name}.apk`;
}

async function handleBuild(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!requireToken(req)) return json(res, 401, { error: "Unauthorized" });
  const payload = JSON.parse(await collectBody(req)) as BuildRequest;
  if (!payload.appName || !payload.previewUrl) {
    return json(res, 400, { error: "appName and previewUrl are required" });
  }

  const outputDir = artifactRoot();
  await mkdir(outputDir, { recursive: true });
  const artifactName = safeArtifactName(payload.artifactName, `${payload.packageId ?? "forge-app"}-debug.apk`);
  const output = join(outputDir, artifactName);
  const result = await buildAndroidWrapper({
    appName: payload.appName,
    packageId: payload.packageId,
    previewUrl: payload.previewUrl,
    output,
  });
  const size = (await stat(result.apkPath)).size;
  const downloadUrl = `${publicBaseUrl(req)}/artifacts/${encodeURIComponent(artifactName)}`;
  return json(res, 200, {
    downloadUrl,
    artifactName,
    size,
    packageId: result.spec.packageId,
    appName: result.spec.appName,
    previewUrl: result.spec.previewUrl,
  });
}

async function handleArtifact(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const encoded = req.url?.replace(/^\/artifacts\//, "") ?? "";
  const artifactName = basename(decodeURIComponent(encoded));
  if (!artifactName.endsWith(".apk")) return json(res, 404, { error: "Not found" });
  const file = join(artifactRoot(), artifactName);
  let info;
  try {
    info = await stat(file);
  } catch {
    return json(res, 404, { error: "Not found" });
  }
  res.writeHead(200, {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Length": info.size,
    "Content-Disposition": `attachment; filename=\"${artifactName}\"`,
  });
  createReadStream(file).pipe(res);
}

export function createAndroidBuilderServer() {
  return createServer((req, res) => {
    Promise.resolve()
      .then(async () => {
        if (req.method === "POST" && req.url === "/build") return await handleBuild(req, res);
        if (req.method === "GET" && req.url?.startsWith("/artifacts/")) return await handleArtifact(req, res);
        if (req.method === "GET" && req.url === "/demo/stopwatch") return html(res, demoStopwatchHtml());
        if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
        return json(res, 404, { error: "Not found" });
      })
      .catch((err) => json(res, 500, { error: err instanceof Error ? err.message : String(err) }));
  });
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? "8787");
  await mkdir(artifactRoot(), { recursive: true });
  const server = createAndroidBuilderServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Forge Android APK builder listening on :${port}`);
  });
}

if (process.argv[1]?.endsWith("android-builder-service.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
