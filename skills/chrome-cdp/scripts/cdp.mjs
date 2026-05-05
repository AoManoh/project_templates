#!/usr/bin/env node
// cdp - lightweight Chrome DevTools Protocol CLI
// Uses raw CDP over WebSocket, no Puppeteer dependency.
// Requires Node 22+ (built-in WebSocket).
//
// Per-tab persistent daemon: page commands go through a daemon that holds
// the CDP session open. Chrome's "Allow debugging" modal fires once per
// daemon (= once per tab). Daemons stay alive by default; run "stop" when
// finished or set CDP_IDLE_TIMEOUT_MS to a positive value for auto-exit.

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { execFileSync, spawn } from 'child_process';
import net from 'net';

const TIMEOUT = 15000;
const NAVIGATION_TIMEOUT = 30000;
const rawConnectTimeout = Number(process.env.CDP_CONNECT_TIMEOUT_MS ?? 15000);
const CONNECT_TIMEOUT = Number.isFinite(rawConnectTimeout) && rawConnectTimeout > 0
  ? rawConnectTimeout
  : 15000;
const rawEndpointTimeout = Number(process.env.CDP_ENDPOINT_TIMEOUT_MS ?? 5000);
const ENDPOINT_TIMEOUT = Number.isFinite(rawEndpointTimeout) && rawEndpointTimeout > 0
  ? rawEndpointTimeout
  : 5000;
const rawEndpointRetries = Number(process.env.CDP_ENDPOINT_RETRIES ?? 2);
const ENDPOINT_RETRIES = Number.isInteger(rawEndpointRetries) && rawEndpointRetries > 0
  ? rawEndpointRetries
  : 2;
const rawAttachApprovalTimeout = Number(process.env.CDP_ATTACH_APPROVAL_TIMEOUT_MS ?? 60000);
const ATTACH_APPROVAL_TIMEOUT = Number.isFinite(rawAttachApprovalTimeout) && rawAttachApprovalTimeout > 0
  ? rawAttachApprovalTimeout
  : 60000;
const DEFAULT_APPROVAL_COOLDOWN = 30000;
const rawApprovalCooldown = Number(process.env.CDP_APPROVAL_COOLDOWN_MS ?? DEFAULT_APPROVAL_COOLDOWN);
const APPROVAL_COOLDOWN = Number.isFinite(rawApprovalCooldown) && rawApprovalCooldown >= 0
  ? rawApprovalCooldown
  : DEFAULT_APPROVAL_COOLDOWN;
const PENDING_GRACE_MS = 1000;
const BROWSER_PROBE_PENDING_TTL = ENDPOINT_TIMEOUT + PENDING_GRACE_MS;
const BROWSER_CONNECT_PENDING_TTL = CONNECT_TIMEOUT + TIMEOUT + PENDING_GRACE_MS;
const DEFAULT_IDLE_TIMEOUT = 0;
const rawIdleTimeout = Number(process.env.CDP_IDLE_TIMEOUT_MS ?? DEFAULT_IDLE_TIMEOUT);
const IDLE_TIMEOUT = Number.isFinite(rawIdleTimeout) && rawIdleTimeout >= 0
  ? rawIdleTimeout
  : DEFAULT_IDLE_TIMEOUT;
const DAEMON_CONNECT_DELAY = 300;
const rawDaemonConnectTimeout = Number(process.env.CDP_DAEMON_CONNECT_TIMEOUT_MS ?? Math.max(80000, CONNECT_TIMEOUT + ATTACH_APPROVAL_TIMEOUT + 5000));
const DAEMON_CONNECT_TIMEOUT = Number.isFinite(rawDaemonConnectTimeout) && rawDaemonConnectTimeout > 0
  ? rawDaemonConnectTimeout
  : Math.max(80000, CONNECT_TIMEOUT + ATTACH_APPROVAL_TIMEOUT + 5000);
const TARGET_ATTACH_PENDING_TTL = DAEMON_CONNECT_TIMEOUT + PENDING_GRACE_MS;
const DAEMON_CONNECT_RETRIES = Math.ceil(DAEMON_CONNECT_TIMEOUT / DAEMON_CONNECT_DELAY);
const MIN_TARGET_PREFIX_LEN = 8;
const IS_WINDOWS = process.platform === 'win32';
const IS_WSL = !IS_WINDOWS && existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
const LOCALHOST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const CHROME_EXEC_RE = /^(chrome|google-chrome|google-chrome-beta|google-chrome-stable|chromium|chromium-browser|msedge|brave|brave-browser|vivaldi|vivaldi-bin)(\.exe)?$/i;

function sanitizeInstanceName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

const INSTANCE_NAME = sanitizeInstanceName(process.env.CDP_INSTANCE_NAME);
if (!IS_WINDOWS) process.umask(0o077);
const BASE_RUNTIME_DIR = process.env.CDP_RUNTIME_DIR
  ? resolve(process.env.CDP_RUNTIME_DIR)
  : IS_WINDOWS
    ? resolve(process.env.LOCALAPPDATA || resolve(homedir(), 'AppData', 'Local'), 'cdp')
    : process.env.XDG_RUNTIME_DIR
      ? resolve(process.env.XDG_RUNTIME_DIR, 'cdp')
      : resolve(homedir(), '.cache', 'cdp');
const RUNTIME_DIR = INSTANCE_NAME ? resolve(BASE_RUNTIME_DIR, INSTANCE_NAME) : BASE_RUNTIME_DIR;
try { mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 }); } catch {}
const PAGES_CACHE = resolve(RUNTIME_DIR, 'pages.json');

function sockPath(targetId) {
  return IS_WINDOWS
    ? `\\\\.\\pipe\\cdp-${INSTANCE_NAME || 'default'}-${targetId}`
    : resolve(RUNTIME_DIR, `cdp-${targetId}.sock`);
}

function pendingKey(value) {
  const key = String(value || 'global').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (key || 'global').slice(0, 180);
}

function approvalPendingPath(scope) {
  return resolve(RUNTIME_DIR, `approval-pending-${pendingKey(scope)}.json`);
}

function browserApprovalScope(wsUrl) {
  return `browser-${wsUrl}`;
}

function browserApprovalLabel(wsUrl) {
  try {
    const parsed = new URL(wsUrl);
    return `browser WebSocket ${parsed.hostname}:${parsed.port || (parsed.protocol === 'wss:' ? '443' : '80')}`;
  } catch {
    return 'browser WebSocket';
  }
}

function getWslWindowsPortCandidates() {
  if (!IS_WSL) return [];
  const windowsUsersRoot = '/mnt/c/Users';
  if (!existsSync(windowsUsersRoot)) return [];
  const browserBases = ['Google/Chrome', 'BraveSoftware/Brave-Browser', 'Microsoft/Edge'];
  try {
    return readdirSync(windowsUsersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const localBase = resolve(windowsUsersRoot, entry.name, 'AppData', 'Local');
        return browserBases.flatMap((browserBase) => [
          resolve(localBase, browserBase, 'User Data', 'DevToolsActivePort'),
          resolve(localBase, browserBase, 'User Data', 'Default', 'DevToolsActivePort'),
        ]);
      });
  } catch {
    return [];
  }
}

function isChromiumBrowserExecutable(value) {
  const base = String(value || '').replace(/\\/g, '/').split('/').pop();
  return CHROME_EXEC_RE.test(base);
}

function maybeBypassProxyForLocalChrome(host) {
  if (!LOCALHOST_HOSTS.has(host)) return;
  for (const key of ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) {
    delete process.env[key];
  }
}

function endpointUrl(host, port, pathname) {
  const hostname = host === '::1' ? '[::1]' : host;
  return `http://${hostname}:${port}${pathname}`;
}

function normalizeDebugHost(host) {
  const explicit = process.env.CDP_HOST?.trim();
  if (explicit) return explicit;
  const value = String(host || '').trim().replace(/^['"]|['"]$/g, '');
  if (!value || value === '0.0.0.0' || value === '::') return '127.0.0.1';
  return value;
}

function parsePortValue(value, source) {
  const text = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!/^\d+$/.test(text)) throw new Error(`${source}: invalid remote debugging port: ${value}`);
  const port = Number(text);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${source}: invalid remote debugging port: ${value}`);
  }
  return port;
}

function readDevToolsActivePort(portFile) {
  const raw = readFileSync(portFile, 'utf8').trim();
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error(`Invalid DevToolsActivePort file: ${portFile}`);
  const port = parsePortValue(lines[0], portFile);
  return { port, browserPath: lines[1] };
}

function wsUrlFromPortFileData({ port, browserPath }, host = process.env.CDP_HOST || '127.0.0.1') {
  if (/^wss?:\/\//i.test(browserPath)) return browserPath;
  const resolvedHost = normalizeDebugHost(host);
  const hostname = resolvedHost === '::1' ? '[::1]' : resolvedHost;
  const path = browserPath.startsWith('/') ? browserPath : `/${browserPath}`;
  return `ws://${hostname}:${port}${path}`;
}

function probeWebSocketEndpoint(wsUrl, source) {
  return new Promise((resolve, reject) => {
    const approvalScope = browserApprovalScope(wsUrl);
    const approvalLabel = browserApprovalLabel(wsUrl);
    const pending = readApprovalPending(approvalScope);
    if (pending) {
      reject(new Error(approvalPendingMessage(approvalScope, pending)));
      return;
    }
    writeApprovalPending(approvalScope, 'browser-websocket-probe-sent', {
      kind: 'browser',
      label: approvalLabel,
      source,
      wsUrl,
      ttlMs: BROWSER_PROBE_PENDING_TTL,
    });
    let settled = false;
    let ws;
    const timer = setTimeout(() => {
      const timedOut = writeApprovalPending(approvalScope, 'timed-out-waiting-for-browser-approval', {
        kind: 'browser',
        label: approvalLabel,
        source,
        wsUrl,
        ttlMs: APPROVAL_COOLDOWN,
      });
      finish(false, new Error(approvalTimeoutMessage(
        approvalScope,
        timedOut,
        `${source}: WebSocket probe timed out after ${ENDPOINT_TIMEOUT}ms.`
      )));
    }, ENDPOINT_TIMEOUT);

    function finish(ok, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch {}
      if (ok) {
        clearApprovalPending(approvalScope);
        resolve(value);
      }
      else reject(value);
    }

    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      clearApprovalPending(approvalScope);
      finish(false, new Error(`${source}: invalid WebSocket endpoint: ${error.message}`));
      return;
    }

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ id: 1, method: 'Browser.getVersion' }));
      } catch (error) {
        finish(false, new Error(`${source}: WebSocket send failed: ${error.message}`));
      }
    };
    ws.onerror = (event) => {
      if (settled) return;
      const failed = writeApprovalPending(approvalScope, 'browser-websocket-error', {
        kind: 'browser',
        label: approvalLabel,
        source,
        wsUrl,
        ttlMs: APPROVAL_COOLDOWN,
      });
      finish(false, new Error(approvalTimeoutMessage(
        approvalScope,
        failed,
        `${source}: WebSocket error: ${event.message || event.type || 'unknown error'}.`
      )));
    };
    ws.onclose = () => {
      if (settled) return;
      const failed = writeApprovalPending(approvalScope, 'browser-websocket-closed-before-response', {
        kind: 'browser',
        label: approvalLabel,
        source,
        wsUrl,
        ttlMs: APPROVAL_COOLDOWN,
      });
      finish(false, new Error(approvalTimeoutMessage(
        approvalScope,
        failed,
        `${source}: WebSocket closed before CDP response.`
      )));
    };
    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        clearApprovalPending(approvalScope);
        finish(false, new Error(`${source}: WebSocket response is not CDP JSON`));
        return;
      }
      if (message.id !== 1) return;
      if (message.result || message.error) finish(true, message.result || { cdpError: message.error.message || 'CDP error response' });
      else {
        clearApprovalPending(approvalScope);
        finish(false, new Error(`${source}: WebSocket response is not a CDP command result`));
      }
    };
  });
}

async function validateWebSocketEndpoint(wsUrl, { host = '', port = '', source, portFile = '', httpDiscoveryError = null }) {
  let version = {};
  let lastError;
  for (let attempt = 1; attempt <= ENDPOINT_RETRIES; attempt++) {
    try {
      version = await probeWebSocketEndpoint(wsUrl, `${source} WebSocket attempt ${attempt}/${ENDPOINT_RETRIES}`);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < ENDPOINT_RETRIES) await sleep(300);
    }
  }
  if (lastError) {
    throw new Error(`${source}: direct WebSocket probe failed after ${ENDPOINT_RETRIES} attempt(s): ${lastError.message}`);
  }
  return {
    wsUrl,
    host,
    port,
    portFile,
    source,
    browser: version.product || '',
    protocolVersion: version.protocolVersion || '',
    httpDiscoveryError: httpDiscoveryError?.message || '',
  };
}

async function fetchJson(url, source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENDPOINT_TIMEOUT);
  let response;
  let body = '';
  try {
    response = await fetch(url, { signal: controller.signal });
    body = await response.text();
  } catch (error) {
    const reason = error?.name === 'AbortError' ? `timed out after ${ENDPOINT_TIMEOUT}ms` : error.message;
    throw new Error(`${source}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = body.trim() ? ` body=${JSON.stringify(body.slice(0, 160))}` : ' with empty body';
    throw new Error(`${source}: HTTP ${response.status}${detail}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${source}: response is not JSON`);
  }
}

async function validateHttpEndpoint({ host, port, source, portFile = '' }) {
  const resolvedHost = normalizeDebugHost(host);
  maybeBypassProxyForLocalChrome(resolvedHost);
  const versionUrl = endpointUrl(resolvedHost, port, '/json/version');
  const version = await fetchJson(versionUrl, `${source} /json/version`);
  const wsUrl = version?.webSocketDebuggerUrl;
  if (!wsUrl || typeof wsUrl !== 'string' || !wsUrl.startsWith('ws')) {
    throw new Error(`${source}: /json/version does not expose webSocketDebuggerUrl`);
  }
  return {
    wsUrl,
    host: resolvedHost,
    port,
    portFile,
    source,
    browser: version.Browser || '',
    protocolVersion: version['Protocol-Version'] || '',
  };
}

function endpointFromDirectWsUrl(wsUrl, source = 'CDP_WS_URL') {
  let parsed;
  try {
    parsed = new URL(wsUrl);
  } catch {
    throw new Error(`Invalid ${source}: ${wsUrl}`);
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error(`${source} must start with ws:// or wss://, got: ${wsUrl}`);
  }
  if (parsed.hostname) maybeBypassProxyForLocalChrome(parsed.hostname);
  return {
    wsUrl,
    host: parsed.hostname || '',
    port: parsed.port || '',
    source,
    portFile: '',
    browser: '',
    protocolVersion: '',
  };
}

function validateDirectWsUrl(wsUrl) {
  const endpoint = endpointFromDirectWsUrl(wsUrl, 'CDP_WS_URL');
  return validateWebSocketEndpoint(wsUrl, endpoint);
}

function getFlagValueFromArgs(args, flag) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flag) return args[i + 1] || '';
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return '';
}

function getFlagValueFromCommandLine(commandLine, flag) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const equals = new RegExp(`${escaped}=(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'i').exec(commandLine);
  if (equals) return equals[1] || equals[2] || equals[3] || '';
  const spaced = new RegExp(`${escaped}\\s+(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'i').exec(commandLine);
  if (spaced) return spaced[1] || spaced[2] || spaced[3] || '';
  return '';
}

function windowsPathToWslPath(value) {
  const text = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!IS_WSL) return text;
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(text);
  if (!match) return text.replace(/\\/g, '/');
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
}

function endpointCandidateFromFlags({ source, portValue, addressValue, userDataDir }) {
  const port = parsePortValue(portValue, source);
  const host = normalizeDebugHost(addressValue);
  const normalizedUserDataDir = windowsPathToWslPath(userDataDir);
  if (port === 0) {
    if (!normalizedUserDataDir) {
      throw new Error(`${source}: --remote-debugging-port=0 requires --user-data-dir to locate DevToolsActivePort`);
    }
    return {
      kind: 'portFile',
      portFile: resolve(normalizedUserDataDir, 'DevToolsActivePort'),
      source,
    };
  }
  return {
    kind: 'port',
    host,
    port,
    portFile: normalizedUserDataDir ? resolve(normalizedUserDataDir, 'DevToolsActivePort') : '',
    source,
  };
}

function getLinuxProcessCandidates() {
  if (IS_WINDOWS || !existsSync('/proc')) return [];
  const candidates = [];
  let entries = [];
  try {
    entries = readdirSync('/proc', { withFileTypes: true });
  } catch {
    return candidates;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const cmdlinePath = `/proc/${entry.name}/cmdline`;
    let args;
    try {
      const raw = readFileSync(cmdlinePath);
      args = raw.toString('utf8').split('\0').filter(Boolean);
    } catch {
      continue;
    }
    if (args.length === 0 || !isChromiumBrowserExecutable(args[0])) continue;
    const portValue = getFlagValueFromArgs(args, '--remote-debugging-port');
    if (!portValue) continue;
    try {
      candidates.push(endpointCandidateFromFlags({
        source: `process ${entry.name} ${args[0]}`,
        portValue,
        addressValue: getFlagValueFromArgs(args, '--remote-debugging-address'),
        userDataDir: getFlagValueFromArgs(args, '--user-data-dir'),
      }));
    } catch (error) {
      candidates.push({ kind: 'invalid', source: `process ${entry.name} ${args[0]}`, error: error.message });
    }
  }
  return candidates;
}

function decodeProcessOutput(buffer) {
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('\u0000')) return utf8;
  return buffer.toString('utf16le').replace(/\u0000/g, '');
}

function findPowerShell() {
  const configured = process.env.CDP_POWERSHELL_EXE;
  if (configured) return configured;
  for (const candidate of [
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    '/mnt/c/Program Files/PowerShell/7/pwsh.exe',
    'powershell.exe',
  ]) {
    try {
      if (candidate.includes('/')) {
        if (existsSync(candidate)) return candidate;
      } else if (IS_WINDOWS) {
        return candidate;
      }
    } catch {}
  }
  return '';
}

function getWindowsProcessCandidates() {
  if (!IS_WSL && !IS_WINDOWS) return [];
  const ps = findPowerShell();
  if (!ps) return [];
  const script = `
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match '--remote-debugging-port' -and
        $_.Name -match '^(chrome|google-chrome|chromium|chromium-browser|msedge|brave|brave-browser|vivaldi)(\\.exe)?$'
      } |
      Select-Object ProcessId,Name,CommandLine |
      ConvertTo-Json -Compress
  `;
  let parsed;
  try {
    const raw = execFileSync(ps, ['-NoProfile', '-Command', script], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const text = decodeProcessOutput(raw).trim();
    if (!text) return [];
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const candidates = [];
  for (const row of rows) {
    const commandLine = row.CommandLine || '';
    const source = `Windows process ${row.ProcessId} ${row.Name}`;
    const portValue = getFlagValueFromCommandLine(commandLine, '--remote-debugging-port');
    if (!portValue) continue;
    try {
      candidates.push(endpointCandidateFromFlags({
        source,
        portValue,
        addressValue: getFlagValueFromCommandLine(commandLine, '--remote-debugging-address'),
        userDataDir: getFlagValueFromCommandLine(commandLine, '--user-data-dir'),
      }));
    } catch (error) {
      candidates.push({ kind: 'invalid', source, error: error.message });
    }
  }
  return candidates;
}

function summarizeBrowserArgs({ pid, name, args, commandLine = '' }) {
  const joined = commandLine || args.join(' ');
  const remotePort = args.length
    ? getFlagValueFromArgs(args, '--remote-debugging-port')
    : getFlagValueFromCommandLine(joined, '--remote-debugging-port');
  const userDataDir = args.length
    ? getFlagValueFromArgs(args, '--user-data-dir')
    : getFlagValueFromCommandLine(joined, '--user-data-dir');
  const processType = args.length
    ? getFlagValueFromArgs(args, '--type')
    : getFlagValueFromCommandLine(joined, '--type');
  return {
    pid,
    name,
    remotePort,
    userDataDir,
    isChild: Boolean(processType),
  };
}

function getLinuxBrowserProcessSummaries() {
  if (IS_WINDOWS || !existsSync('/proc')) return [];
  const summaries = [];
  let entries = [];
  try {
    entries = readdirSync('/proc', { withFileTypes: true });
  } catch {
    return summaries;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    let args;
    try {
      const raw = readFileSync(`/proc/${entry.name}/cmdline`);
      args = raw.toString('utf8').split('\0').filter(Boolean);
    } catch {
      continue;
    }
    if (args.length === 0 || !isChromiumBrowserExecutable(args[0])) continue;
    summaries.push(summarizeBrowserArgs({
      pid: entry.name,
      name: args[0],
      args,
    }));
  }
  return summaries;
}

function getWindowsBrowserProcessSummaries() {
  if (!IS_WSL && !IS_WINDOWS) return [];
  const ps = findPowerShell();
  if (!ps) return [];
  const script = `
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.CommandLine -and
        $_.Name -match '^(chrome|google-chrome|chromium|chromium-browser|msedge|brave|brave-browser|vivaldi)(\\.exe)?$'
      } |
      Select-Object ProcessId,Name,CommandLine |
      ConvertTo-Json -Compress
  `;
  let parsed;
  try {
    const raw = execFileSync(ps, ['-NoProfile', '-Command', script], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const text = decodeProcessOutput(raw).trim();
    if (!text) return [];
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map(row => summarizeBrowserArgs({
    pid: String(row.ProcessId),
    name: row.Name,
    args: [],
    commandLine: row.CommandLine || '',
  }));
}

function getBrowserProcessSummaries() {
  const merged = [...getLinuxBrowserProcessSummaries(), ...getWindowsBrowserProcessSummaries()];
  const seen = new Set();
  return merged.filter(item => {
    const key = `${item.pid}|${item.name}|${item.remotePort}|${item.userDataDir}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPortFileCandidates() {
  const home = homedir();
  // macOS: ~/Library/Application Support/<name>/DevToolsActivePort
  const macBrowsers = [
    'Google/Chrome', 'Google/Chrome Beta', 'Google/Chrome for Testing',
    'Chromium', 'BraveSoftware/Brave-Browser', 'Microsoft Edge',
  ];
  // Linux: ~/.config/<name>/DevToolsActivePort
  const linuxBrowsers = [
    'google-chrome', 'google-chrome-beta', 'chromium',
    'vivaldi', 'vivaldi-snapshot',
    'BraveSoftware/Brave-Browser', 'microsoft-edge',
  ];
  // Linux Flatpak: ~/.var/app/<app-id>/config/<name>/DevToolsActivePort
  const flatpakBrowsers = [
    ['org.chromium.Chromium', 'chromium'],
    ['com.google.Chrome', 'google-chrome'],
    ['com.brave.Browser', 'BraveSoftware/Brave-Browser'],
    ['com.microsoft.Edge', 'microsoft-edge'],
    ['com.vivaldi.Vivaldi', 'vivaldi'],
  ];
  const candidates = [
    ...macBrowsers.flatMap(b => [
      resolve(home, 'Library/Application Support', b, 'DevToolsActivePort'),
      resolve(home, 'Library/Application Support', b, 'Default/DevToolsActivePort'),
    ]),
    ...linuxBrowsers.flatMap(b => [
      resolve(home, '.config', b, 'DevToolsActivePort'),
      resolve(home, '.config', b, 'Default/DevToolsActivePort'),
    ]),
    ...flatpakBrowsers.flatMap(([appId, name]) => [
      resolve(home, '.var/app', appId, 'config', name, 'DevToolsActivePort'),
      resolve(home, '.var/app', appId, 'config', name, 'Default/DevToolsActivePort'),
    ]),
    // Windows: %LOCALAPPDATA%/<name>/User Data/DevToolsActivePort
    ...(IS_WINDOWS ? ['Google/Chrome', 'BraveSoftware/Brave-Browser', 'Microsoft/Edge'].flatMap(b => {
      const base = process.env.LOCALAPPDATA || resolve(home, 'AppData/Local');
      return [
        resolve(base, b, 'User Data/DevToolsActivePort'),
        resolve(base, b, 'User Data/Default/DevToolsActivePort'),
      ];
    }) : []),
    ...getWslWindowsPortCandidates(),
  ].filter(Boolean);
  return [...new Set(candidates.filter(p => existsSync(p)))]
    .map(portFile => ({ kind: 'portFile', portFile, source: `DevToolsActivePort ${portFile}` }));
}

async function endpointFromCandidate(candidate) {
  if (candidate.kind === 'invalid') throw new Error(candidate.error);
  if (candidate.kind === 'portFile') {
    if (!existsSync(candidate.portFile)) throw new Error(`${candidate.source}: port file not found: ${candidate.portFile}`);
    const portFileData = readDevToolsActivePort(candidate.portFile);
    const wsUrl = wsUrlFromPortFileData(portFileData);
    return {
      ...endpointFromDirectWsUrl(wsUrl, `${candidate.source} direct WebSocket`),
      host: process.env.CDP_HOST || '127.0.0.1',
      port: portFileData.port,
      portFile: candidate.portFile,
    };
  }
  if (candidate.kind === 'port') {
    try {
      return await validateHttpEndpoint(candidate);
    } catch (httpDiscoveryError) {
      if (!candidate.portFile || !existsSync(candidate.portFile)) throw httpDiscoveryError;
      const portFileData = readDevToolsActivePort(candidate.portFile);
      const wsUrl = wsUrlFromPortFileData(portFileData, candidate.host);
      return {
        ...endpointFromDirectWsUrl(wsUrl, candidate.source),
        host: candidate.host,
        port: candidate.port,
        portFile: candidate.portFile,
        httpDiscoveryError,
      };
    }
  }
  throw new Error(`${candidate.source || 'candidate'}: unknown endpoint candidate`);
}

async function endpointDiagnosticsFromCandidate(candidate) {
  if (candidate.kind === 'invalid') throw new Error(candidate.error);
  if (candidate.kind === 'portFile') {
    if (!existsSync(candidate.portFile)) throw new Error(`${candidate.source}: port file not found: ${candidate.portFile}`);
    const portFileData = readDevToolsActivePort(candidate.portFile);
    try {
      const wsUrl = wsUrlFromPortFileData(portFileData);
      return await validateWebSocketEndpoint(wsUrl, {
        host: process.env.CDP_HOST || '127.0.0.1',
        port: portFileData.port,
        source: `${candidate.source} direct WebSocket`,
        portFile: candidate.portFile,
      });
    } catch (error) {
      throw new Error(`direct WebSocket failed: ${error.message}`);
    }
  }
  if (candidate.kind === 'port') {
    const errors = [];
    try {
      return await validateHttpEndpoint(candidate);
    } catch (error) {
      errors.push(`/json/version failed: ${error.message}`);
    }
    if (candidate.portFile && existsSync(candidate.portFile)) {
      try {
        const wsUrl = wsUrlFromPortFileData(readDevToolsActivePort(candidate.portFile), candidate.host);
        return await validateWebSocketEndpoint(wsUrl, {
          host: candidate.host,
          port: candidate.port,
          source: candidate.source,
          portFile: candidate.portFile,
        });
      } catch (error) {
        errors.push(`direct WebSocket failed: ${error.message}`);
      }
    }
    throw new Error(errors.join('; '));
  }
  throw new Error(`${candidate.source || 'candidate'}: unknown endpoint candidate`);
}

function endpointIdentity(endpoint) {
  return `${endpoint.wsUrl}|${endpoint.portFile || ''}`;
}

async function discoverAutoEndpoints({ probeDirectWs = false } = {}) {
  const candidates = [
    ...getPortFileCandidates(),
    ...getLinuxProcessCandidates(),
    ...getWindowsProcessCandidates(),
  ];
  const valid = [];
  const invalid = [];
  const seenCandidates = new Set();

  for (const candidate of candidates) {
    const candidateKey = JSON.stringify(candidate);
    if (seenCandidates.has(candidateKey)) continue;
    seenCandidates.add(candidateKey);
    try {
      valid.push(await (probeDirectWs ? endpointDiagnosticsFromCandidate(candidate) : endpointFromCandidate(candidate)));
    } catch (error) {
      invalid.push({ candidate, error: error.message });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const endpoint of valid) {
    const key = endpointIdentity(endpoint);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(endpoint);
  }

  return { valid: unique, invalid, candidates };
}

function formatEndpoint(endpoint) {
  const details = [
    endpoint.source,
    endpoint.browser ? `browser=${endpoint.browser}` : '',
    endpoint.protocolVersion ? `protocol=${endpoint.protocolVersion}` : '',
    endpoint.portFile ? `portFile=${endpoint.portFile}` : '',
  ].filter(Boolean);
  return `- ${endpoint.wsUrl}\n  ${details.join(' | ')}`;
}

function formatInvalidEndpoint(item) {
  const source = item.candidate?.source || item.candidate?.portFile || 'candidate';
  return `- ${source}: ${item.error}`;
}

function formatBrowserProcess(item) {
  return `- pid=${item.pid} ${item.name} remoteDebugging=${item.remotePort || 'no'} userDataDir=${item.userDataDir || '(default/unknown)'}`;
}

function hasExplicitEndpointBinding() {
  return Boolean(
    process.env.CDP_WS_URL ||
    process.env.CDP_BROWSER_WS_URL ||
    process.env.CDP_PORT_FILE ||
    process.env.CDP_PORT
  );
}

function browserPresenceHint() {
  const browserProcesses = getBrowserProcessSummaries();
  if (!browserProcesses.length) return '';
  const mainProcesses = browserProcesses.filter(item => !item.isChild);
  const lines = [
    '',
    `Browser processes detected: ${browserProcesses.length}. This is not a missing-window condition.`,
    'The failure means no reusable CDP WebSocket endpoint was validated for the current binding.',
  ];
  if (mainProcesses.length) {
    lines.push('Main/window process candidates:');
    lines.push(mainProcesses.slice(0, 8).map(formatBrowserProcess).join('\n'));
  }
  return lines.join('\n');
}

async function resolveBrowserEndpoint({ probeDirectWs = false } = {}) {
  const directWsUrl = process.env.CDP_WS_URL || process.env.CDP_BROWSER_WS_URL || '';
  if (directWsUrl) return probeDirectWs ? validateDirectWsUrl(directWsUrl) : endpointFromDirectWsUrl(directWsUrl, 'CDP_WS_URL');

  if (process.env.CDP_PORT_FILE) {
    const portFile = resolve(process.env.CDP_PORT_FILE);
    if (!existsSync(portFile)) {
      throw new Error(`CDP_PORT_FILE is set but file not found: ${portFile}`);
    }
    try {
      const candidate = { kind: 'portFile', portFile, source: `CDP_PORT_FILE ${portFile}` };
      return await (probeDirectWs ? endpointDiagnosticsFromCandidate(candidate) : endpointFromCandidate(candidate));
    } catch (error) {
      throw new Error(`CDP_PORT_FILE does not point to a valid Chrome DevTools endpoint: ${error.message}`);
    }
  }

  if (process.env.CDP_PORT) {
    const port = parsePortValue(process.env.CDP_PORT, 'CDP_PORT');
    try {
      return await validateHttpEndpoint({
        host: process.env.CDP_HOST || '127.0.0.1',
        port,
        source: `CDP_PORT ${port}`,
      });
    } catch (error) {
      throw new Error(`CDP_PORT is not a valid Chrome DevTools endpoint: ${error.message}`);
    }
  }

  const { valid, invalid } = await discoverAutoEndpoints({ probeDirectWs });
  if (valid.length === 1) return valid[0];
  if (valid.length > 1) {
    throw new Error(
      `Multiple valid Chrome DevTools endpoints found. Set CDP_PORT_FILE or CDP_WS_URL explicitly.\n` +
      valid.slice(0, 8).map(formatEndpoint).join('\n')
    );
  }

  const invalidHint = invalid.length
    ? `\nRejected candidates:\n${invalid.slice(0, 8).map(formatInvalidEndpoint).join('\n')}`
    : '';
  throw new Error(
    'No reusable Chrome DevTools endpoint was validated. This does not mean Chrome is not open. ' +
    'A port that returns empty 404 from /json/version is only a failed HTTP discovery endpoint; ' +
    'for shared-session, set CDP_PORT_FILE to the intended DevToolsActivePort or set CDP_WS_URL ' +
    'to a known browser WebSocket URL. Do not launch a new isolated/headless browser unless the user explicitly asked for one.' +
    invalidHint
  );
}

async function doctorReport() {
  const lines = [
    'CDP endpoint diagnostics',
    `Runtime dir: ${RUNTIME_DIR}`,
    `Instance: ${INSTANCE_NAME || '(default)'}`,
    `CDP_PORT_FILE: ${process.env.CDP_PORT_FILE || '(unset)'}`,
    `CDP_WS_URL: ${process.env.CDP_WS_URL || process.env.CDP_BROWSER_WS_URL || '(unset)'}`,
    `CDP_PORT: ${process.env.CDP_PORT || '(unset)'}`,
    `CDP_HOST: ${process.env.CDP_HOST || '127.0.0.1'}`,
    '',
  ];

  let discovery = null;
  let selectedEndpoint = null;
  const explicitBinding = hasExplicitEndpointBinding();
  try {
    let selected;
    if (explicitBinding) {
      selected = await resolveBrowserEndpoint({ probeDirectWs: true });
    } else {
      discovery = await discoverAutoEndpoints({ probeDirectWs: false });
      if (discovery.valid.length === 1) {
        const candidate = discovery.valid[0];
        selected = await validateWebSocketEndpoint(candidate.wsUrl, {
          ...candidate,
          source: `${candidate.source} explicit single-candidate validation`,
        });
      }
      else if (discovery.valid.length > 1) {
        throw new Error(
          `Multiple Chrome DevTools endpoint candidates found. Set CDP_PORT_FILE or CDP_WS_URL explicitly before WebSocket probing.\n` +
          'No browser WebSocket handshake was sent because probing multiple candidates could attach to the wrong browser.\n' +
          discovery.valid.slice(0, 8).map(formatEndpoint).join('\n')
        );
      } else {
        const invalidHint = discovery.invalid.length
          ? `\nRejected candidates:\n${discovery.invalid.slice(0, 8).map(formatInvalidEndpoint).join('\n')}`
          : '';
        throw new Error(
          'No reusable Chrome DevTools endpoint was validated. This does not mean Chrome is not open. ' +
          'A port that returns empty 404 from /json/version is only a failed HTTP discovery endpoint; ' +
          'for shared-session, set CDP_PORT_FILE to the intended DevToolsActivePort or set CDP_WS_URL ' +
          'to a known browser WebSocket URL. Do not launch a new isolated/headless browser unless the user explicitly asked for one.' +
          invalidHint
        );
      }
    }
    selectedEndpoint = selected;
    lines.push('Selected endpoint:');
    lines.push(formatEndpoint(selected));
  } catch (error) {
    lines.push('Selected endpoint: none');
    lines.push(`Reason: ${error.message}`);
  }

  lines.push('');
  let valid = selectedEndpoint ? [selectedEndpoint] : [];
  if (explicitBinding) {
    lines.push('Auto-discovery candidates: skipped because an explicit endpoint binding is set.');
  } else {
    const autoDiscovery = discovery || await discoverAutoEndpoints({ probeDirectWs: false });
    const invalid = autoDiscovery.invalid;
    const candidates = autoDiscovery.candidates;
    valid = autoDiscovery.valid;
    lines.push(`Auto-discovery candidates: ${candidates.length}`);
    if (valid.length) {
      lines.push(explicitBinding || selectedEndpoint ? 'Valid endpoints:' : 'Endpoint candidates (not WebSocket-probed when ambiguous):');
      lines.push(valid.map(formatEndpoint).join('\n'));
    }
    if (invalid.length) {
      lines.push('Rejected candidates:');
      lines.push(invalid.slice(0, 12).map(formatInvalidEndpoint).join('\n'));
    }
    if (!valid.length && !invalid.length) {
      lines.push('No DevToolsActivePort files or running Chrome processes with --remote-debugging-port were found.');
    }
  }

  const browserProcesses = getBrowserProcessSummaries();
  const mainProcesses = browserProcesses.filter(item => !item.isChild);
  lines.push('');
  lines.push(`Browser processes detected: ${browserProcesses.length}`);
  if (mainProcesses.length) {
    lines.push('Main/window process candidates:');
    lines.push(mainProcesses.slice(0, 12).map(formatBrowserProcess).join('\n'));
  }
  if (browserProcesses.length && !valid.length) {
    lines.push('');
    lines.push(
      'Chrome/Chromium is open, but no reusable CDP WebSocket endpoint was validated. ' +
      'This is not a missing-window condition; it means the current browser/profile is not exposing a usable DevTools endpoint, ' +
      'or the discovered port file is stale/wrong.'
    );
  }
  return lines.join('\n');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));


function resolvePrefix(prefix, candidates, noun = 'target', missingHint = '') {
  const upper = prefix.toUpperCase();
  const matches = candidates.filter(candidate => candidate.toUpperCase().startsWith(upper));
  if (matches.length === 0) {
    const hint = missingHint ? ` ${missingHint}` : '';
    throw new Error(`No ${noun} matching prefix "${prefix}".${hint}`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous prefix "${prefix}" — matches ${matches.length} ${noun}s. Use more characters.`);
  }
  return matches[0];
}

function getDisplayPrefixLength(targetIds) {
  if (targetIds.length === 0) return MIN_TARGET_PREFIX_LEN;
  const maxLen = Math.max(...targetIds.map(id => id.length));
  for (let len = MIN_TARGET_PREFIX_LEN; len <= maxLen; len++) {
    const prefixes = new Set(targetIds.map(id => id.slice(0, len).toUpperCase()));
    if (prefixes.size === targetIds.length) return len;
  }
  return maxLen;
}

function currentCacheMeta(endpoint = null) {
  return {
    instanceName: INSTANCE_NAME || '',
    portFile: process.env.CDP_PORT_FILE || '',
    wsUrl: process.env.CDP_WS_URL || process.env.CDP_BROWSER_WS_URL || '',
    port: process.env.CDP_PORT || '',
    host: process.env.CDP_HOST || '127.0.0.1',
    endpointSource: endpoint?.source || '',
    selectedWsUrl: endpoint?.wsUrl || '',
    selectedHost: endpoint?.host || '',
    selectedPort: endpoint?.port || '',
    selectedPortFile: endpoint?.portFile || '',
    browser: endpoint?.browser || '',
    protocolVersion: endpoint?.protocolVersion || '',
  };
}

function readPagesCache() {
  if (!existsSync(PAGES_CACHE)) return { meta: null, pages: [] };
  const raw = JSON.parse(readFileSync(PAGES_CACHE, 'utf8'));
  if (Array.isArray(raw)) {
    return { meta: null, pages: raw };
  }
  return {
    meta: raw?.meta || null,
    pages: Array.isArray(raw?.pages) ? raw.pages : [],
  };
}

function writePagesCache(pages, endpoint = null) {
  const payload = {
    meta: currentCacheMeta(endpoint),
    pages,
  };
  writeFileSync(PAGES_CACHE, JSON.stringify(payload), { mode: 0o600 });
}

function cacheMatchesCurrentBinding(meta) {
  if (!meta) return true;
  const current = currentCacheMeta();
  return meta.instanceName === current.instanceName
    && meta.portFile === current.portFile
    && (meta.wsUrl || '') === current.wsUrl
    && (meta.port || '') === current.port
    && meta.host === current.host;
}

function requirePagesCacheForCurrentBinding() {
  if (!existsSync(PAGES_CACHE)) {
    throw new Error('No page list cached. Run "cdp list" first.');
  }
  const { meta, pages } = readPagesCache();
  if (!cacheMatchesCurrentBinding(meta)) {
    throw new Error('Cached page list belongs to a different browser instance/binding. Run "cdp list" first.');
  }
  return pages;
}

function cachedEndpointForCurrentBinding() {
  if (!existsSync(PAGES_CACHE)) return null;
  const { meta } = readPagesCache();
  if (!cacheMatchesCurrentBinding(meta) || !meta?.selectedWsUrl) return null;
  const endpoint = endpointFromDirectWsUrl(meta.selectedWsUrl, meta.endpointSource || 'pages cache selected endpoint');
  return {
    ...endpoint,
    host: meta.selectedHost || endpoint.host,
    port: meta.selectedPort || endpoint.port,
    portFile: meta.selectedPortFile || meta.portFile || '',
    browser: meta.browser || endpoint.browser,
    protocolVersion: meta.protocolVersion || endpoint.protocolVersion,
  };
}

async function resolveBrowserEndpointForDaemon() {
  return cachedEndpointForCurrentBinding() || await resolveBrowserEndpoint();
}

function clearApprovalPending(targetId) {
  try { unlinkSync(approvalPendingPath(targetId)); } catch {}
}

function writeApprovalPending(scope, phase, details = {}) {
  const now = Date.now();
  const rawTtlMs = Number(details.ttlMs ?? APPROVAL_COOLDOWN);
  const ttlMs = Number.isFinite(rawTtlMs) && rawTtlMs >= 0 ? rawTtlMs : APPROVAL_COOLDOWN;
  const { ttlMs: _ttlMs, ...rest } = details;
  const payload = {
    scope,
    phase,
    createdAt: now,
    expiresAt: now + ttlMs,
    daemonConnectTimeoutMs: DAEMON_CONNECT_TIMEOUT,
    attachApprovalTimeoutMs: ATTACH_APPROVAL_TIMEOUT,
    approvalCooldownMs: APPROVAL_COOLDOWN,
    ...rest,
  };
  writeFileSync(approvalPendingPath(scope), JSON.stringify(payload, null, 2), { mode: 0o600 });
  return payload;
}

function parseApprovalPendingFile(filePath) {
  if (!existsSync(filePath)) return null;
  let payload;
  try {
    payload = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    try { unlinkSync(filePath); } catch {}
    return null;
  }
  if (!payload?.expiresAt || Date.now() >= payload.expiresAt) {
    try { unlinkSync(filePath); } catch {}
    return null;
  }
  return payload;
}

function readApprovalPending(scope) {
  return parseApprovalPendingFile(approvalPendingPath(scope));
}

function listApprovalPending() {
  let entries = [];
  try {
    entries = readdirSync(RUNTIME_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(entry => entry.isFile() && entry.name.startsWith('approval-pending-') && entry.name.endsWith('.json'))
    .map(entry => {
      const filePath = resolve(RUNTIME_DIR, entry.name);
      const pending = parseApprovalPendingFile(filePath);
      return pending ? { ...pending, file: filePath } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function clearAllApprovalPending() {
  for (const pending of listApprovalPending()) {
    try { unlinkSync(pending.file || approvalPendingPath(pending.scope)); } catch {}
  }
}

function formatApprovalPending(pending) {
  const seconds = Math.max(0, Math.ceil(((pending.expiresAt || Date.now()) - Date.now()) / 1000));
  const label = pending.label || pending.scope || 'Chrome debugging request';
  return `- ${label}\n  scope=${pending.scope} phase=${pending.phase || '(unknown)'} expiresIn=${seconds}s`;
}

function statusReport() {
  const lines = [
    'CDP runtime status',
    `Runtime dir: ${RUNTIME_DIR}`,
    `Instance: ${INSTANCE_NAME || '(default)'}`,
    `Pages cache: ${existsSync(PAGES_CACHE) ? PAGES_CACHE : '(none)'}`,
    `CDP_PORT_FILE: ${process.env.CDP_PORT_FILE || '(unset)'}`,
    `CDP_WS_URL: ${process.env.CDP_WS_URL || process.env.CDP_BROWSER_WS_URL || '(unset)'}`,
    `CDP_PORT: ${process.env.CDP_PORT || '(unset)'}`,
    '',
  ];

  try {
    const { meta, pages } = readPagesCache();
    if (pages.length) {
      lines.push(`Cached targets: ${pages.length}`);
      lines.push(`Cache binding: ${meta?.selectedWsUrl || meta?.wsUrl || meta?.portFile || meta?.port || '(legacy/unbound)'}`);
    } else {
      lines.push('Cached targets: 0');
    }
  } catch (error) {
    lines.push(`Pages cache: unreadable (${error.message})`);
  }

  const pending = listApprovalPending();
  lines.push('');
  lines.push(`Pending approval records: ${pending.length}`);
  if (pending.length) lines.push(pending.map(formatApprovalPending).join('\n'));
  return lines.join('\n');
}

function approvalPendingMessage(scope, pending) {
  const seconds = Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1000));
  const label = pending.label || scope || 'Chrome debugging request';
  return (
    `Chrome debugging approval may already be pending for ${label}. ` +
    'Focus the existing Chrome window and approve or deny the prompt if it is visible. ' +
    `Refusing to send another handshake request for ${seconds}s to avoid repeated authorization prompts. ` +
    'Stopping now. Run the command again only after handling the Chrome prompt. Use "status" to inspect pending records, ' +
    '"clear-pending" only for stale records, or "stop" if the session should be cleared.'
  );
}

function approvalTimeoutMessage(scope, pending, reason) {
  const seconds = Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1000));
  const label = pending.label || scope || 'Chrome debugging request';
  return (
    `Chrome debugging handshake did not complete for ${label}. ${reason} ` +
    'If Chrome shows a remote debugging approval prompt, focus Chrome and approve or deny it. ' +
    `Stopping now; repeated CDP commands are suppressed for ${seconds}s.`
  );
}

// ---------------------------------------------------------------------------
// CDP WebSocket client
// ---------------------------------------------------------------------------

class CDP {
  #ws; #id = 0; #pending = new Map(); #eventHandlers = new Map(); #closeHandlers = [];
  #approvalScope = ''; #handshakeConfirmed = false;

  #confirmHandshake() {
    if (!this.#approvalScope || this.#handshakeConfirmed) return;
    this.#handshakeConfirmed = true;
    clearApprovalPending(this.#approvalScope);
  }

  async connect(wsUrl, approvalLabel = browserApprovalLabel(wsUrl)) {
    const approvalScope = browserApprovalScope(wsUrl);
    const existingPending = readApprovalPending(approvalScope);
    if (existingPending) throw new Error(approvalPendingMessage(approvalScope, existingPending));
    this.#approvalScope = approvalScope;
    this.#handshakeConfirmed = false;
    writeApprovalPending(approvalScope, 'browser-websocket-connect-sent', {
      kind: 'browser',
      label: approvalLabel,
      wsUrl,
      ttlMs: BROWSER_CONNECT_PENDING_TTL,
    });
    return new Promise((res, rej) => {
      let settled = false;
      const failConnect = (reason) => {
        const timedOut = writeApprovalPending(approvalScope, 'timed-out-waiting-for-browser-approval', {
          kind: 'browser',
          label: approvalLabel,
          wsUrl,
          ttlMs: APPROVAL_COOLDOWN,
        });
        rej(new Error(approvalTimeoutMessage(approvalScope, timedOut, reason)));
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { this.#ws?.close(); } catch {}
        failConnect(`WebSocket connect timed out after ${CONNECT_TIMEOUT}ms: ${wsUrl}.`);
      }, CONNECT_TIMEOUT);
      this.#ws = new WebSocket(wsUrl);
      this.#ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        res();
      };
      this.#ws.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        failConnect('WebSocket error: ' + (e.message || e.type) + '.');
      };
      this.#ws.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          failConnect(`WebSocket closed before connect: ${wsUrl}.`);
          return;
        }
        this.#closeHandlers.forEach(h => h());
      };
      this.#ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.#pending.has(msg.id)) {
          const { resolve, reject } = this.#pending.get(msg.id);
          this.#pending.delete(msg.id);
          this.#confirmHandshake();
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method && this.#eventHandlers.has(msg.method)) {
          for (const handler of [...this.#eventHandlers.get(msg.method)]) {
            handler(msg.params || {}, msg);
          }
        }
      };
    });
  }

  send(method, params = {}, sessionId, timeoutMs = TIMEOUT) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.#ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (this.#pending.has(id)) {
          this.#pending.delete(id);
          if (this.#approvalScope && !this.#handshakeConfirmed) {
            writeApprovalPending(this.#approvalScope, 'timed-out-waiting-for-cdp-response', {
              kind: 'browser',
              label: browserApprovalLabel(this.#approvalScope.replace(/^browser-/, '')),
              ttlMs: APPROVAL_COOLDOWN,
            });
          }
          reject(new Error(`Timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  onEvent(method, handler) {
    if (!this.#eventHandlers.has(method)) this.#eventHandlers.set(method, new Set());
    const handlers = this.#eventHandlers.get(method);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.#eventHandlers.delete(method);
    };
  }

  waitForEvent(method, timeout = TIMEOUT) {
    let settled = false;
    let off;
    let timer;
    const promise = new Promise((resolve, reject) => {
      off = this.onEvent(method, (params) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off();
        resolve(params);
      });
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        off();
        reject(new Error(`Timeout waiting for event: ${method}`));
      }, timeout);
    });
    return {
      promise,
      cancel() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        off?.();
      },
    };
  }

  onClose(handler) { this.#closeHandlers.push(handler); }
  close() { this.#ws.close(); }
}

// ---------------------------------------------------------------------------
// Command implementations — return strings, take (cdp, sessionId)
// ---------------------------------------------------------------------------

async function getPages(cdp) {
  const { targetInfos } = await cdp.send('Target.getTargets');
  return targetInfos.filter(t => t.type === 'page' && !t.url.startsWith('chrome://'));
}

function formatPageList(pages) {
  const prefixLen = getDisplayPrefixLength(pages.map(p => p.targetId));
  return pages.map(p => {
    const id = p.targetId.slice(0, prefixLen).padEnd(prefixLen);
    const context = p.browserContextId ? `ctx=${p.browserContextId.slice(0, 8)}` : 'ctx=default ';
    const title = p.title.substring(0, 54).padEnd(54);
    return `${id}  ${context}  ${title}  ${p.url}`;
  }).join('\n');
}

async function getWindowRows(cdp) {
  const pages = await getPages(cdp);
  const prefixLen = getDisplayPrefixLength(pages.map(p => p.targetId));
  const rows = [];
  for (const page of pages) {
    let windowInfo = { windowId: 'n/a', bounds: {} };
    try {
      windowInfo = await cdp.send('Browser.getWindowForTarget', { targetId: page.targetId });
    } catch {}
    rows.push({ page, windowInfo, prefixLen });
  }
  return rows;
}

function formatWindowList(rows) {
  return rows.map(({ page, windowInfo, prefixLen }) => {
    const id = page.targetId.slice(0, prefixLen).padEnd(prefixLen);
    const context = page.browserContextId ? `ctx=${page.browserContextId.slice(0, 8)}` : 'ctx=default ';
    const windowId = String(windowInfo.windowId ?? 'n/a').padStart(4);
    const bounds = windowInfo.bounds || {};
    const state = String(bounds.windowState || '').padEnd(10);
    const size = bounds.width && bounds.height ? `${bounds.width}x${bounds.height}` : 'n/a';
    const title = page.title.substring(0, 42).padEnd(42);
    return `win=${windowId}  ${id}  ${context}  ${state}  ${String(size).padEnd(11)}  ${title}  ${page.url}`;
  }).join('\n');
}

async function refreshPagesCache(cdp, endpoint, targetId, url) {
  const pages = await getPages(cdp);
  if (targetId && !pages.some(p => p.targetId === targetId)) {
    pages.push({ targetId, title: url || targetId, url: url || '' });
  }
  writePagesCache(pages, endpoint);
  return pages;
}

async function openTargetStr(cdp, endpoint, cmd, url = 'about:blank') {
  let browserContextId;
  if (cmd === 'incognito') {
    const context = await cdp.send('Target.createBrowserContext', { disposeOnDetach: false });
    browserContextId = context.browserContextId;
  }
  const createParams = { url };
  if (cmd === 'openwindow' || cmd === 'incognito') createParams.newWindow = true;
  if (browserContextId) createParams.browserContextId = browserContextId;
  const { targetId } = await cdp.send('Target.createTarget', createParams);
  await refreshPagesCache(cdp, endpoint, targetId, url);
  const label = cmd === 'open'
    ? 'new tab'
    : cmd === 'openwindow'
      ? 'new window'
      : `new incognito window (context ${browserContextId})`;
  return `Opened ${label}: ${targetId.slice(0, 8)}  ${url}\n` +
    'Note: this new target may need first-time approval in shared-session mode.';
}

function shouldShowAxNode(node, compact = false) {
  const role = node.role?.value || '';
  const name = node.name?.value ?? '';
  const value = node.value?.value;
  if (compact && role === 'InlineTextBox') return false;
  return role !== 'none' && role !== 'generic' && !(name === '' && (value === '' || value == null));
}

function formatAxNode(node, depth) {
  const role = node.role?.value || '';
  const name = node.name?.value ?? '';
  const value = node.value?.value;
  const indent = '  '.repeat(Math.min(depth, 10));
  let line = `${indent}[${role}]`;
  if (name !== '') line += ` ${name}`;
  if (!(value === '' || value == null)) line += ` = ${JSON.stringify(value)}`;
  return line;
}

function orderedAxChildren(node, nodesById, childrenByParent) {
  const children = [];
  const seen = new Set();
  for (const childId of node.childIds || []) {
    const child = nodesById.get(childId);
    if (child && !seen.has(child.nodeId)) {
      seen.add(child.nodeId);
      children.push(child);
    }
  }
  for (const child of childrenByParent.get(node.nodeId) || []) {
    if (!seen.has(child.nodeId)) {
      seen.add(child.nodeId);
      children.push(child);
    }
  }
  return children;
}

async function snapshotStr(cdp, sid, compact = false) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree', {}, sid);
  const nodesById = new Map(nodes.map(node => [node.nodeId, node]));
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
    childrenByParent.get(node.parentId).push(node);
  }

  const lines = [];
  const visited = new Set();
  function visit(node, depth) {
    if (!node || visited.has(node.nodeId)) return;
    visited.add(node.nodeId);
    if (shouldShowAxNode(node, compact)) lines.push(formatAxNode(node, depth));
    for (const child of orderedAxChildren(node, nodesById, childrenByParent)) {
      visit(child, depth + 1);
    }
  }

  const roots = nodes.filter(node => !node.parentId || !nodesById.has(node.parentId));
  for (const root of roots) visit(root, 0);
  for (const node of nodes) visit(node, 0);

  return lines.join('\n');
}

async function evalStr(cdp, sid, expression) {
  await cdp.send('Runtime.enable', {}, sid);
  const result = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, sid);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description);
  }
  const val = result.result.value;
  return typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
}

async function shotStr(cdp, sid, filePath, targetId) {
  // Get device scale factor so we can report coordinate mapping
  let dpr = 1;
  try {
    const metrics = await cdp.send('Page.getLayoutMetrics', {}, sid);
    dpr = metrics.visualViewport?.clientWidth
      ? metrics.cssVisualViewport?.clientWidth
        ? Math.round((metrics.visualViewport.clientWidth / metrics.cssVisualViewport.clientWidth) * 100) / 100
        : 1
      : 1;
    // Simpler: deviceScaleFactor is on the root Page metrics
    const { deviceScaleFactor } = await cdp.send('Emulation.getDeviceMetricsOverride', {}, sid).catch(() => ({}));
    if (deviceScaleFactor) dpr = deviceScaleFactor;
  } catch {}
  // Fallback: try to get DPR from JS
  if (dpr === 1) {
    try {
      const raw = await evalStr(cdp, sid, 'window.devicePixelRatio');
      const parsed = parseFloat(raw);
      if (parsed > 0) dpr = parsed;
    } catch {}
  }

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sid);
  const out = filePath || resolve(RUNTIME_DIR, `screenshot-${(targetId || 'unknown').slice(0, 8)}.png`);
  writeFileSync(out, Buffer.from(data, 'base64'));

  const lines = [out];
  lines.push(`Screenshot saved. Device pixel ratio (DPR): ${dpr}`);
  lines.push(`Coordinate mapping:`);
  lines.push(`  Screenshot pixels → CSS pixels (for CDP Input events): divide by ${dpr}`);
  lines.push(`  e.g. screenshot point (${Math.round(100 * dpr)}, ${Math.round(200 * dpr)}) → CSS (100, 200) → use clickxy <target> 100 200`);
  if (dpr !== 1) {
    lines.push(`  On this ${dpr}x display: CSS px = screenshot px / ${dpr} ≈ screenshot px × ${Math.round(100/dpr)/100}`);
  }
  return lines.join('\n');
}

async function htmlStr(cdp, sid, selector) {
  const expr = selector
    ? `document.querySelector(${JSON.stringify(selector)})?.outerHTML || 'Element not found'`
    : `document.documentElement.outerHTML`;
  return evalStr(cdp, sid, expr);
}

async function waitForDocumentReady(cdp, sid, timeoutMs = NAVIGATION_TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  let lastState = '';
  let lastError;
  while (Date.now() < deadline) {
    try {
      const state = await evalStr(cdp, sid, 'document.readyState');
      lastState = state;
      if (state === 'complete') return;
    } catch (e) {
      lastError = e;
    }
    await sleep(200);
  }

  if (lastState) {
    throw new Error(`Timed out waiting for navigation to finish (last readyState: ${lastState})`);
  }
  if (lastError) {
    throw new Error(`Timed out waiting for navigation to finish (${lastError.message})`);
  }
  throw new Error('Timed out waiting for navigation to finish');
}

async function navStr(cdp, sid, url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error(`Only http/https URLs allowed, got: ${url}`);
  } catch (e) {
    if (e.message.startsWith('Only')) throw e;
    throw new Error(`Invalid URL: ${url}`);
  }
  await cdp.send('Page.enable', {}, sid);
  const loadEvent = cdp.waitForEvent('Page.loadEventFired', NAVIGATION_TIMEOUT);
  const result = await cdp.send('Page.navigate', { url }, sid);
  if (result.errorText) {
    loadEvent.cancel();
    throw new Error(result.errorText);
  }
  if (result.loaderId) {
    await loadEvent.promise;
  } else {
    loadEvent.cancel();
  }
  await waitForDocumentReady(cdp, sid, 5000);
  return `Navigated to ${url}`;
}

async function netStr(cdp, sid) {
  const raw = await evalStr(cdp, sid, `JSON.stringify(performance.getEntriesByType('resource').map(e => ({
    name: e.name.substring(0, 120), type: e.initiatorType,
    duration: Math.round(e.duration), size: e.transferSize
  })))`);
  return JSON.parse(raw).map(e =>
    `${String(e.duration).padStart(5)}ms  ${String(e.size || '?').padStart(8)}B  ${e.type.padEnd(8)}  ${e.name}`
  ).join('\n');
}

// Click element by CSS selector
async function clickStr(cdp, sid, selector) {
  if (!selector) throw new Error('CSS selector required');
  const expr = `
    (function() {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { ok: false, error: 'Element not found: ' + ${JSON.stringify(selector)} };
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { ok: true, tag: el.tagName, text: el.textContent.trim().substring(0, 80) };
    })()
  `;
  const result = await evalStr(cdp, sid, expr);
  const r = JSON.parse(result);
  if (!r.ok) throw new Error(r.error);
  return `Clicked <${r.tag}> "${r.text}"`;
}

// Click at CSS pixel coordinates using Input.dispatchMouseEvent
async function clickXyStr(cdp, sid, x, y) {
  const cx = parseFloat(x);
  const cy = parseFloat(y);
  if (isNaN(cx) || isNaN(cy)) throw new Error('x and y must be numbers (CSS pixels)');
  const base = { x: cx, y: cy, button: 'left', clickCount: 1, modifiers: 0 };
  await cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved' }, sid);
  await cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' }, sid);
  await sleep(50);
  await cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' }, sid);
  return `Clicked at CSS (${cx}, ${cy})`;
}

// Type text using Input.insertText (works in cross-origin iframes, unlike eval)
async function typeStr(cdp, sid, text) {
  if (text == null || text === '') throw new Error('text required');
  await cdp.send('Input.insertText', { text }, sid);
  return `Typed ${text.length} characters`;
}

// Load-more: repeatedly click a button/selector until it disappears
async function loadAllStr(cdp, sid, selector, intervalMs = 1500) {
  if (!selector) throw new Error('CSS selector required');
  let clicks = 0;
  const deadline = Date.now() + 5 * 60 * 1000; // 5-minute hard cap
  while (Date.now() < deadline) {
    const exists = await evalStr(cdp, sid,
      `!!document.querySelector(${JSON.stringify(selector)})`
    );
    if (exists !== 'true') break;
    const clickExpr = `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        el.click();
        return true;
      })()
    `;
    const clicked = await evalStr(cdp, sid, clickExpr);
    if (clicked !== 'true') break;
    clicks++;
    await sleep(intervalMs);
  }
  return `Clicked "${selector}" ${clicks} time(s) until it disappeared`;
}

// Send a raw CDP command and return the result as JSON
async function evalRawStr(cdp, sid, method, paramsJson) {
  if (!method) throw new Error('CDP method required (e.g. "DOM.getDocument")');
  let params = {};
  if (paramsJson) {
    try { params = JSON.parse(paramsJson); }
    catch { throw new Error(`Invalid JSON params: ${paramsJson}`); }
  }
  const result = await cdp.send(method, params, sid);
  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// Per-tab daemon
// ---------------------------------------------------------------------------

async function runDaemon(targetId) {
  const sp = sockPath(targetId);

  const cdp = new CDP();
  let endpoint;
  try {
    endpoint = await resolveBrowserEndpointForDaemon();
    await cdp.connect(endpoint.wsUrl);
  } catch (e) {
    process.stderr.write(`Daemon: cannot connect to Chrome: ${e.message}\n`);
    process.exit(1);
  }

  let sessionId;
  try {
    const res = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, undefined, ATTACH_APPROVAL_TIMEOUT);
    sessionId = res.sessionId;
  } catch (e) {
    process.stderr.write(`Daemon: attach failed: ${e.message}\n`);
    cdp.close();
    process.exit(1);
  }

  // Shutdown helpers
  let alive = true;
  function shutdown() {
    if (!alive) return;
    alive = false;
    server.close();
    if (!IS_WINDOWS) try { unlinkSync(sp); } catch {}
    cdp.close();
    process.exit(0);
  }

  // Exit if target goes away or Chrome disconnects
  cdp.onEvent('Target.targetDestroyed', (params) => {
    if (params.targetId === targetId) shutdown();
  });
  cdp.onEvent('Target.detachedFromTarget', (params) => {
    if (params.sessionId === sessionId) shutdown();
  });
  cdp.onClose(() => shutdown());
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Idle timer
  let idleTimer = null;
  function armIdleTimer() {
    if (IDLE_TIMEOUT === 0) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(shutdown, IDLE_TIMEOUT);
  }
  armIdleTimer();
  function resetIdle() {
    armIdleTimer();
  }

  // Handle a command
  async function handleCommand({ cmd, args }) {
    resetIdle();
    try {
      let result;
      switch (cmd) {
        case 'list': {
          const pages = await getPages(cdp);
          writePagesCache(pages, endpoint);
          result = formatPageList(pages);
          break;
        }
        case 'list_raw': {
          const pages = await getPages(cdp);
          writePagesCache(pages, endpoint);
          result = JSON.stringify(pages);
          break;
        }
        case 'windows': case 'wins': {
          const rows = await getWindowRows(cdp);
          writePagesCache(rows.map(row => row.page), endpoint);
          result = formatWindowList(rows);
          break;
        }
        case 'open': case 'openwindow': case 'incognito': {
          result = await openTargetStr(cdp, endpoint, cmd, args[0]);
          break;
        }
        case 'attach': {
          result = `Attached target ${targetId.slice(0, MIN_TARGET_PREFIX_LEN)}. ` +
            `Daemon socket is active; subsequent commands for this target reuse this CDP session. ` +
            `Idle timeout: ${IDLE_TIMEOUT === 0 ? 'disabled' : `${IDLE_TIMEOUT}ms`}.`;
          break;
        }
        case 'snap': case 'snapshot': result = await snapshotStr(cdp, sessionId, true); break;
        case 'eval': result = await evalStr(cdp, sessionId, args[0]); break;
        case 'shot': case 'screenshot': result = await shotStr(cdp, sessionId, args[0], targetId); break;
        case 'html': result = await htmlStr(cdp, sessionId, args[0]); break;
        case 'nav': case 'navigate': result = await navStr(cdp, sessionId, args[0]); break;
        case 'net': case 'network': result = await netStr(cdp, sessionId); break;
        case 'click': result = await clickStr(cdp, sessionId, args[0]); break;
        case 'clickxy': result = await clickXyStr(cdp, sessionId, args[0], args[1]); break;
        case 'type': result = await typeStr(cdp, sessionId, args[0]); break;
        case 'loadall': result = await loadAllStr(cdp, sessionId, args[0], args[1] ? parseInt(args[1]) : 1500); break;
        case 'evalraw': result = await evalRawStr(cdp, sessionId, args[0], args[1]); break;
        case 'stop': return { ok: true, result: '', stopAfter: true };
        default: return { ok: false, error: `Unknown command: ${cmd}` };
      }
      return { ok: true, result: result ?? '' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Unix socket server — NDJSON protocol
  // Wire format: each message is one JSON object followed by \n (newline-delimited JSON).
  // Request:  { "id": <number>, "cmd": "<command>", "args": ["arg1", "arg2", ...] }
  // Response: { "id": <number>, "ok": <boolean>, "result": "<string>" }
  //           or { "id": <number>, "ok": false, "error": "<message>" }
  const server = net.createServer((conn) => {
    let buf = '';
    conn.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        if (!line.trim()) continue;
        let req;
        try {
          req = JSON.parse(line);
        } catch {
          conn.write(JSON.stringify({ ok: false, error: 'Invalid JSON request', id: null }) + '\n');
          continue;
        }
        handleCommand(req).then((res) => {
          const payload = JSON.stringify({ ...res, id: req.id }) + '\n';
          if (res.stopAfter) conn.end(payload, shutdown);
          else conn.write(payload);
        });
      }
    });
  });

  server.on('error', (e) => {
    process.stderr.write(`Daemon server listen failed: ${e.message}\n`);
    process.exit(1);
  });

  if (!IS_WINDOWS) try { unlinkSync(sp); } catch {}
  server.listen(sp);
}

// ---------------------------------------------------------------------------
// CLI ↔ daemon communication
// ---------------------------------------------------------------------------

function connectToSocket(sp) {
  return new Promise((resolve, reject) => {
    const conn = net.connect(sp);
    conn.on('connect', () => resolve(conn));
    conn.on('error', reject);
  });
}

async function getOrStartTabDaemon(targetId) {
  const sp = sockPath(targetId);
  // Try existing daemon
  try {
    const conn = await connectToSocket(sp);
    clearApprovalPending(targetId);
    return conn;
  } catch {}

  const pending = readApprovalPending(targetId);
  if (pending) throw new Error(approvalPendingMessage(targetId, pending));

  // Clean stale socket
  if (!IS_WINDOWS) try { unlinkSync(sp); } catch {}

  // Spawn daemon
  const child = spawn(process.execPath, [process.argv[1], '_daemon', targetId], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  writeApprovalPending(targetId, 'target-handshake-sent', {
    kind: 'target',
    label: `target ${targetId.slice(0, MIN_TARGET_PREFIX_LEN)}`,
    ttlMs: TARGET_ATTACH_PENDING_TTL,
  });

  // Wait for socket (includes time for user to click Allow)
  for (let i = 0; i < DAEMON_CONNECT_RETRIES; i++) {
    await sleep(DAEMON_CONNECT_DELAY);
    try {
      const conn = await connectToSocket(sp);
      clearApprovalPending(targetId);
      return conn;
    } catch {}
  }
  const timedOut = writeApprovalPending(targetId, 'timed-out-waiting-for-target-approval', {
    kind: 'target',
    label: `target ${targetId.slice(0, MIN_TARGET_PREFIX_LEN)}`,
    ttlMs: APPROVAL_COOLDOWN,
  });
  throw new Error(
    'Daemon failed to start after sending a Chrome debugging handshake request. ' +
    `Waited ${DAEMON_CONNECT_TIMEOUT}ms for target ${targetId.slice(0, MIN_TARGET_PREFIX_LEN)}. ` +
    'If this is shared-session mode, focus the existing Chrome window and approve or deny the prompt if it is visible. ' +
    `Do not keep sending attach/page commands; repeated handshake requests are suppressed for ${Math.ceil((timedOut.expiresAt - Date.now()) / 1000)}s. ` +
    'If no prompt is visible, confirm the target still exists and the current binding is correct, then run list again.'
  );
}

function sendCommand(conn, req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let settled = false;

    const cleanup = () => {
      conn.off('data', onData);
      conn.off('error', onError);
      conn.off('end', onEnd);
      conn.off('close', onClose);
    };

    const onData = (chunk) => {
      buf += chunk.toString();
      const idx = buf.indexOf('\n');
      if (idx === -1) return;
      settled = true;
      cleanup();
      resolve(JSON.parse(buf.slice(0, idx)));
      conn.end();
    };

    const onError = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Connection closed before response'));
    };

    const onClose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Connection closed before response'));
    };

    conn.on('data', onData);
    conn.on('error', onError);
    conn.on('end', onEnd);
    conn.on('close', onClose);
    req.id = 1;
    conn.write(JSON.stringify(req) + '\n');
  });
}

async function sendCommandThroughExistingDaemon(cmd, args = []) {
  if (!existsSync(PAGES_CACHE)) return null;
  let pages;
  try {
    const cached = readPagesCache();
    if (!cacheMatchesCurrentBinding(cached.meta)) return null;
    pages = cached.pages;
  } catch {
    return null;
  }
  for (const page of pages) {
    try {
      const conn = await connectToSocket(sockPath(page.targetId));
      return await sendCommand(conn, { cmd, args });
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stop daemons
// ---------------------------------------------------------------------------

async function stopDaemons(targetPrefix) {
  if (!existsSync(PAGES_CACHE)) {
    if (!targetPrefix) clearAllApprovalPending();
    else clearApprovalPending(targetPrefix);
    return;
  }
  const { pages } = readPagesCache();
  const targets = targetPrefix
    ? [resolvePrefix(targetPrefix, pages.map(p => p.targetId), 'target')]
    : pages.map(p => p.targetId);

  for (const targetId of targets) {
    clearApprovalPending(targetId);
    const sp = sockPath(targetId);
    try {
      const conn = await connectToSocket(sp);
      await sendCommand(conn, { cmd: 'stop' });
    } catch {
      if (!IS_WINDOWS) try { unlinkSync(sp); } catch {}
    }
  }
  if (!targetPrefix) clearAllApprovalPending();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const USAGE = `cdp - lightweight Chrome DevTools Protocol CLI (no Puppeteer)

Usage: cdp <command> [args]

  status                            Show runtime cache and pending approval records without handshaking
  list                              List open pages (shows unique target prefixes)
  windows                           List page targets with Chrome window ids/bounds
  doctor                            Show endpoint discovery and validation diagnostics
                                    With multiple candidates, it lists them and stops before WebSocket probing
  attach <target>                   Attach once and keep this target's daemon/session alive
  snap  <target>                    Accessibility tree snapshot
  eval  <target> <expr>             Evaluate JS expression
  shot  <target> [file]             Screenshot (default: screenshot-<target>.png in runtime dir); prints coordinate mapping
  html  <target> [selector]         Get HTML (full page or CSS selector)
  nav   <target> <url>              Navigate to URL and wait for load completion
  net   <target>                    Network performance entries
  click   <target> <selector>       Click an element by CSS selector
  clickxy <target> <x> <y>          Click at CSS pixel coordinates (see coordinate note below)
  type    <target> <text>           Type text at current focus via Input.insertText
                                    Works in cross-origin iframes unlike eval-based approaches
  loadall <target> <selector> [ms]  Repeatedly click a "load more" button until it disappears
                                    Optional interval in ms between clicks (default 1500)
  evalraw <target> <method> [json]  Send a raw CDP command; returns JSON result
                                    e.g. evalraw <t> "DOM.getDocument" '{}'
  open  [url]                       Open a new tab (default: about:blank)
                                    Note: a new target may need first-time approval in shared-session mode
  openwindow [url]                  Open a new normal browser window
  incognito [url]                   Open a new incognito BrowserContext window
  stop  [target]                    Stop daemon(s)
  clear-pending [scope|all]         Clear pending approval record(s) without handshaking

<target> is a unique targetId prefix from "cdp list". If a prefix is ambiguous,
use more characters.

ENDPOINT BINDING
  Discovery accepts only real Chrome DevTools endpoints. A process listening on
  9222 is not enough. It is accepted only when /json/version returns a
  webSocketDebuggerUrl. DevToolsActivePort/CDP_WS_URL never use HTTP discovery
  first; their browser WebSocket is used directly and must answer CDP. For
  stable shared-session use, bind explicitly:
    CDP_PORT_FILE=/path/to/DevToolsActivePort node skills/chrome-cdp/scripts/cdp.mjs list
    CDP_WS_URL=ws://127.0.0.1:<port>/devtools/browser/<id> node skills/chrome-cdp/scripts/cdp.mjs list

DEFAULT LOCAL-BROWSER RULE
  When the user asks to handshake/connect/inspect the local browser, the default
  path is shared-session: find and bind an already-open, headed browser endpoint.
  Do not launch a new isolated/headless browser unless the user explicitly asks
  for a new dedicated instance, such as "create a local incognito browser".
  If no endpoint is validated, report that state and ask for/bind CDP_PORT_FILE
  or CDP_WS_URL; do not substitute a new browser as fallback.

PRECISE TARGET SELECTION
  Browser endpoint selection and page target selection are separate. When several
  endpoints exist, bind one explicitly before list/windows. When several windows
  or contexts exist inside that endpoint, use windows/list and choose by targetId,
  windowId, ctx, title, URL, and bounds. ctx=default is normal profile context;
  a non-default ctx usually indicates a separate browser context such as an
  incognito context created by CDP. If more than one candidate matches, stop and
  ask the user to identify the exact target; do not guess.

INSTANCE ISOLATION
  Set CDP_INSTANCE_NAME to isolate pages cache and daemon sockets per browser
  instance/session. This avoids collisions when multiple agents use Chrome in
  parallel on the same machine.
    Example:
      CDP_INSTANCE_NAME=worker-a node skills/chrome-cdp/scripts/cdp.mjs list

COORDINATE SYSTEM
  shot captures the viewport at the device's native resolution.
  The screenshot image size = CSS pixels × DPR (device pixel ratio).
  For CDP Input events (clickxy, etc.) you need CSS pixels, not image pixels.

    CSS pixels = screenshot image pixels / DPR

  shot prints the DPR and an example conversion for the current page.
  Typical Retina (DPR=2): CSS px ≈ screenshot px × 0.5
  If your viewer rescales the image further, account for that scaling too.

EVAL SAFETY NOTE
  Avoid index-based DOM selection (querySelectorAll(...)[i]) across multiple
  eval calls when the list can change between calls (e.g. after clicking
  "Ignore" buttons on a feed — indices shift). Prefer stable selectors or
  collect all data in a single eval.

DAEMON IPC (for advanced use / scripting)
  Each tab runs a persistent daemon at Unix socket in the runtime dir (see below).
  Protocol: newline-delimited JSON (one JSON object per line, UTF-8).
    Request:  {"id":<number>, "cmd":"<command>", "args":["arg1","arg2",...]}
    Response: {"id":<number>, "ok":true,  "result":"<string>"}
           or {"id":<number>, "ok":false, "error":"<message>"}
  Commands mirror the CLI: attach, snap, eval, shot, html, nav, net, click, clickxy,
  type, loadall, evalraw, stop. Browser-level commands include list, windows,
  open, openwindow, incognito. Use evalraw to send arbitrary page-session CDP methods.
  Top-level list/windows/open/openwindow/incognito reuse an existing target daemon
  when one is active for the current binding; they reconnect to the browser only
  when no daemon socket exists.
  ${IDLE_TIMEOUT === 0
    ? 'The socket persists until the tab closes or you run stop.'
    : `The socket disappears after ${Math.round(IDLE_TIMEOUT / 60000)} min of inactivity, when the tab closes, or when you run stop.`}

APPROVAL WAITING
  In shared-session mode, browser-level commands (doctor/list/windows/open) and
  target attach may trigger Chrome's debugging approval UI. Run them
  sequentially, never in parallel. After a handshake request is sent, this CLI
  waits for user approval instead of sending more handshakes. If waiting times
  out, focus Chrome and handle the prompt; repeated handshakes for that same
  browser endpoint or target are suppressed for CDP_APPROVAL_COOLDOWN_MS.
  Other scopes are not globally blocked. Use status to inspect pending records
  and clear-pending only when the prompt was handled or the record is known stale.
    CDP_ATTACH_APPROVAL_TIMEOUT_MS=${ATTACH_APPROVAL_TIMEOUT}
    CDP_DAEMON_CONNECT_TIMEOUT_MS=${DAEMON_CONNECT_TIMEOUT}
    CDP_APPROVAL_COOLDOWN_MS=${APPROVAL_COOLDOWN}

UNATTENDED MODE
  Per-tab daemons stay alive by default. Keep CDP_IDLE_TIMEOUT_MS=0 for no
  idle exit, or set a positive timeout if you want automatic cleanup.
`;

const NEEDS_TARGET = new Set([
  'attach','snap','snapshot','eval','shot','screenshot','html','nav','navigate',
  'net','network','click','clickxy','type','loadall','evalraw',
]);

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  // Daemon mode (internal)
  if (cmd === '_daemon') { await runDaemon(args[0]); return; }

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(USAGE); process.exit(0);
  }

  if (cmd === 'doctor') {
    console.log(await doctorReport());
    return;
  }

  if (cmd === 'status') {
    console.log(statusReport());
    return;
  }

  if (cmd === 'clear-pending') {
    const scope = args[0] || 'all';
    if (scope === 'all') clearAllApprovalPending();
    else clearApprovalPending(scope);
    return;
  }

  if (cmd === 'list' || cmd === 'ls') {
    const daemonResponse = await sendCommandThroughExistingDaemon('list');
    if (daemonResponse) {
      if (daemonResponse.ok) {
        if (daemonResponse.result) console.log(daemonResponse.result);
        return;
      }
      throw new Error(`Existing target daemon rejected list: ${daemonResponse.error}`);
    }
    const cdp = new CDP();
    const endpoint = await resolveBrowserEndpoint();
    await cdp.connect(endpoint.wsUrl);
    const pages = await getPages(cdp);
    cdp.close();
    writePagesCache(pages, endpoint);
    console.log(formatPageList(pages));
    setTimeout(() => process.exit(0), 100);
    return;
  }

  if (cmd === 'windows' || cmd === 'wins') {
    const daemonResponse = await sendCommandThroughExistingDaemon('windows');
    if (daemonResponse) {
      if (daemonResponse.ok) {
        if (daemonResponse.result) console.log(daemonResponse.result);
        return;
      }
      throw new Error(`Existing target daemon rejected windows: ${daemonResponse.error}`);
    }
    const cdp = new CDP();
    const endpoint = await resolveBrowserEndpoint();
    await cdp.connect(endpoint.wsUrl);
    const rows = await getWindowRows(cdp);
    await refreshPagesCache(cdp, endpoint);
    cdp.close();
    console.log(formatWindowList(rows));
    setTimeout(() => process.exit(0), 100);
    return;
  }

  // Open new tab/window/context
  if (cmd === 'open' || cmd === 'openwindow' || cmd === 'incognito') {
    const url = args[0] || 'about:blank';
    const daemonResponse = await sendCommandThroughExistingDaemon(cmd, [url]);
    if (daemonResponse) {
      if (daemonResponse.ok) {
        if (daemonResponse.result) console.log(daemonResponse.result);
        return;
      }
      throw new Error(`Existing target daemon rejected ${cmd}: ${daemonResponse.error}`);
    }
    const cdp = new CDP();
    const endpoint = await resolveBrowserEndpoint();
    await cdp.connect(endpoint.wsUrl);
    const result = await openTargetStr(cdp, endpoint, cmd, url);
    cdp.close();
    console.log(result);
    return;
  }

  // Stop
  if (cmd === 'stop') {
    await stopDaemons(args[0]);
    return;
  }

  // Page commands — need target prefix
  if (!NEEDS_TARGET.has(cmd)) {
    console.error(`Unknown command: ${cmd}\n`);
    console.log(USAGE);
    process.exit(1);
  }

  const targetPrefix = args[0];
  if (!targetPrefix) {
    console.error('Error: target ID required. Run "cdp list" first.');
    process.exit(1);
  }

  // Resolve prefix → full targetId from pages cache
  let pages;
  try {
    pages = requirePagesCacheForCurrentBinding();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const targetId = resolvePrefix(targetPrefix, pages.map(p => p.targetId), 'target', 'Run "cdp list".');

  const conn = await getOrStartTabDaemon(targetId);

  const cmdArgs = args.slice(1);

  if (cmd === 'eval') {
    const expr = cmdArgs.join(' ');
    if (!expr) { console.error('Error: expression required'); process.exit(1); }
    cmdArgs[0] = expr;
  } else if (cmd === 'type') {
    // Join all remaining args as text (allows spaces)
    const text = cmdArgs.join(' ');
    if (!text) { console.error('Error: text required'); process.exit(1); }
    cmdArgs[0] = text;
  } else if (cmd === 'evalraw') {
    // args: [method, ...jsonParts] — join json parts in case of spaces
    if (!cmdArgs[0]) { console.error('Error: CDP method required'); process.exit(1); }
    if (cmdArgs.length > 2) cmdArgs[1] = cmdArgs.slice(1).join(' ');
  }

  if ((cmd === 'nav' || cmd === 'navigate') && !cmdArgs[0]) {
    console.error('Error: URL required');
    process.exit(1);
  }

  const response = await sendCommand(conn, { cmd, args: cmdArgs });

  if (response.ok) {
    if (response.result) console.log(response.result);
  } else {
    console.error('Error:', response.error);
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error(e.message);
  if (/DevTools endpoint|CDP_PORT|CDP_PORT_FILE|WebSocket/.test(e.message)) {
    const hint = browserPresenceHint();
    if (hint) console.error(hint);
  }
  process.exit(1);
});
