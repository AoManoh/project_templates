---
name: chrome-cdp
description: Stable local Chrome remote-debugging skill over raw Node.js WebSocket/CDP. Use for local browser inspection, screenshots, page interaction, existing Chrome shared sessions, isolated Chrome instances, DevToolsActivePort direct WebSocket discovery, bare-port /json/version validation, and target-level daemon reuse. When the user asks to handshake, connect, inspect, or operate a local browser, default to shared-session over an already-open headed browser/profile. Use isolated, new incognito, or headless instances only when the user explicitly asks Codex to create a dedicated browser instance.
---

# Chrome CDP

**skill_id**: `chrome-cdp`
**版本**: 1.0.0
**output_dir**: `N/A` (runtime artifacts like screenshots/HTML/network logs go to caller-specified paths, not a governance docs dir)

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
node skills/chrome-cdp/scripts/cdp.mjs status
node skills/chrome-cdp/scripts/cdp.mjs doctor
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs windows
node skills/chrome-cdp/scripts/cdp.mjs attach <target>
node skills/chrome-cdp/scripts/cdp.mjs snap <target>
node skills/chrome-cdp/scripts/cdp.mjs eval <target> 'document.title'
```

After `attach <target>`, reuse the same target prefix for page commands. Run `stop <target>` only when the work is finished.

Hard rule after attach: do not use `doctor`, repeated `list`, or repeated `windows` as a reflexive status check. Target work must continue through the same target prefix so the CLI reuses the target daemon. Top-level `list/windows/open/openwindow/incognito` are allowed only when needed; the CLI must reuse an existing daemon for the current binding before opening a new browser WebSocket.

Shared-session approval rule: run CDP handshake commands sequentially, never in parallel. `doctor`, `list`, `windows`, `open`, `openwindow`, `incognito`, `attach`, and the first page command can all trigger Chrome approval. After any handshake request is sent, wait for the user to approve or deny Chrome's prompt. On timeout, stop and tell the user to check Chrome; do not continue testing through old daemons or send more CDP commands.

## Connection Selection

- Default Do: if the user says `CDP`, `handshake`, `connect browser`, `inspect local browser`, `current window`, `existing login state`, or similar, use shared-session mode and search for an already-open headed local browser/profile.
- Default Not Do: do not launch an isolated browser, Playwright, Puppeteer, or a new headless window as fallback for shared-session failure.
- Explicit Create Only: use isolated-instance mode only when the user clearly asks Codex to create a new dedicated browser instance, for example "create a local incognito browser with CDP" or "start an isolated browser for unattended testing".
- Use isolated-instance mode only when the user explicitly allows a dedicated browser instance for unattended AI work, multi-agent work, or repeatable tests.
- Use `doctor` before claiming anything about the browser state. If multiple endpoint candidates exist, `doctor` must list them and stop before WebSocket probing. If Chrome processes exist but no CDP endpoint validates, report that distinction exactly.
- `CDP_PORT_FILE` and `CDP_WS_URL` are direct WebSocket bindings. Do not probe `/json/version` first for either path.

## Precise Target Selection

- Browser endpoint selection and page target selection are separate decisions.
- If multiple valid browser endpoints exist, stop and require explicit `CDP_PORT_FILE` or `CDP_WS_URL`; do not guess by port number, process order, or stale cache.
- After binding one endpoint, run `list` or `windows` and select the exact target by `targetId`, `windowId`, `ctx`, title, URL, and bounds.
- `ctx=default` means the default browser context. A non-default `ctx` identifies a separate browser context, such as a CDP-created incognito context.
- If the user asks for "the incognito window", "the logged-in window", or "that article tab" and more than one target matches, stop and ask the user to identify the exact row. Do not attach to a guessed target.

## Isolated WSL Helper

Use this helper only after the user explicitly requested a new dedicated browser instance. It is not a fallback for shared-session.

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
