---
name: chrome-cdp
description: Stable local Chrome remote-debugging skill over raw Node.js WebSocket/CDP. Use for local browser inspection, screenshots, page interaction, existing Chrome shared sessions, isolated Chrome instances, DevToolsActivePort discovery, /json/version validation, and target-level daemon reuse. Use shared-session mode when the user wants an existing Chrome window/profile; use isolated instances only when explicitly allowed for unattended or dedicated test work.
---

# Chrome CDP

Raw Chrome DevTools Protocol CLI. Connect directly over Node.js WebSocket, keep per-tab sessions alive, and control local Chromium browsers without Puppeteer or Playwright.

## Single Source Of Truth

- `SPEC.md` is the only source for connection modes, endpoint validation, permission boundaries, failure handling, timeout variables, and recovery rules.
- `scripts/cdp.mjs --help` is the executable source for the current CLI command surface.
- `SKILL.md` is only the entry guide. If this file conflicts with `SPEC.md` or `cdp.mjs --help`, treat this file as stale and update it.
- Do not duplicate detailed rules here. Add hard requirements to `SPEC.md`; add command behavior to `cdp.mjs`.

## Required Read Order

1. Read this file to select the workflow.
2. Read [SPEC.md](./SPEC.md) before diagnosing or changing CDP behavior.
3. Run `node skills/chrome-cdp/scripts/cdp.mjs help` before using unfamiliar commands.
4. Read `scripts/cdp.mjs` only when implementing or debugging the CLI itself.

## Standard Workflow

```bash
node skills/chrome-cdp/scripts/cdp.mjs doctor
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs attach <target>
node skills/chrome-cdp/scripts/cdp.mjs snap <target>
node skills/chrome-cdp/scripts/cdp.mjs eval <target> 'document.title'
```

After `attach <target>`, reuse the same target prefix for page commands. Run `stop <target>` only when the work is finished.

Shared-session approval rule: run CDP handshake commands sequentially, never in parallel. `doctor`, `list`, `windows`, `open`, `openwindow`, `incognito`, `attach`, and the first page command can all trigger Chrome approval. After any handshake request is sent, wait for the user to approve or deny Chrome's prompt. On timeout, stop and tell the user to check Chrome; do not continue testing through old daemons or send more CDP commands.

## Connection Selection

- If the task is to connect an already-open local Chrome window/profile, shared-session mode is mandatory.
- Do not launch an isolated browser, Playwright, Puppeteer, or a new headless window as fallback for shared-session failure.
- Use isolated-instance mode only when the user explicitly allows a dedicated browser instance for unattended AI work, multi-agent work, or repeatable tests.
- Use `doctor` before claiming anything about the browser state. If Chrome processes exist but no CDP endpoint validates, report that distinction exactly.

## Isolated WSL Helper

```bash
bash skills/chrome-cdp/scripts/launch-isolated-chrome.sh worker-a about:blank
source "$HOME/.cache/cdp-instances/worker-a/cdp-env.sh"
node skills/chrome-cdp/scripts/cdp.mjs doctor
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs attach <target>
```

## Shared Session Binding

```bash
export CDP_PORT_FILE='/full/path/to/DevToolsActivePort'
export CDP_INSTANCE_NAME='shared-main'
export CDP_IDLE_TIMEOUT_MS=0
node skills/chrome-cdp/scripts/cdp.mjs doctor
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs attach <target>
```

If the browser WebSocket URL is already known:

```bash
export CDP_WS_URL='ws://127.0.0.1:<port>/devtools/browser/<id>'
export CDP_INSTANCE_NAME='shared-main'
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs attach <target>
```

## Command Groups

- Discovery: `doctor`, `list`, `windows`
- Session lifecycle: `attach`, `open`, `openwindow`, `incognito`, `stop`
- Inspection: `snap`, `html`, `shot`, `net`
- Interaction: `nav`, `eval`, `click`, `clickxy`, `type`, `loadall`, `evalraw`

Use `node skills/chrome-cdp/scripts/cdp.mjs help` for argument details and the current command list.
