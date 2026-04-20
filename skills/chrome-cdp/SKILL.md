---
name: chrome-cdp
description: Stable local Chrome remote-debugging skill. Prefer isolated browser instances for unattended AI work; use shared browser sessions only when the user explicitly wants an existing Chrome window/profile.
---

# Chrome CDP

Raw Chrome DevTools Protocol CLI. Connects directly over WebSocket, keeps per-tab sessions alive, and is designed for stable local browser control without Puppeteer.

Hard requirements and failure handling live in [SPEC.md](./SPEC.md).

## Read First

- The stable default is `isolated-instance mode`, not a shared day-to-day browser profile.
- The safe reuse boundary is an attached `page target` / tab session, not a window.
- Do not promise "authorize one tab in a window, then every tab in that window is free." Chrome's official docs do not guarantee window-wide inheritance.
- If you want unattended or multi-agent stability, start an isolated instance with a dedicated profile and keep the daemon alive.
- If you must use an already-running browser, treat approval as explicit user consent for that shared session and expect stricter UI prompts.

## Prerequisites

- Node.js 22+ (uses built-in WebSocket)
- Chrome, Chromium, Edge, Brave, or another Chromium browser
- For shared-session mode: enable remote debugging in `chrome://inspect/#remote-debugging`
- For isolated-instance mode: launch Chrome with `--remote-debugging-port=0` and a non-default `--user-data-dir`
- On Chrome 136+, `--remote-debugging-port` and `--remote-debugging-pipe` do not work on the default profile; a non-default `--user-data-dir` is mandatory
- If more than one `DevToolsActivePort` may exist, set `CDP_PORT_FILE` explicitly
- In multi-agent or unattended use, set `CDP_INSTANCE_NAME` explicitly
- If your shell exports `http_proxy` / `https_proxy` / `all_proxy`, local CDP traffic to `127.0.0.1` must bypass those proxies

## Connection Modes

### 1. Isolated-instance mode

Use this by default for autonomous AI work, multi-agent work, or long-running sessions.

Why:

- lowest risk of attaching to the wrong browser
- no dependence on the user's daily profile state
- best fit for Chrome 136+ remote-debugging restrictions
- least prompt churn in practice because the browser is launched already in debugging mode

WSL helper:

```bash
bash skills/chrome-cdp/scripts/launch-isolated-chrome.sh worker-a about:blank
source "$HOME/.cache/cdp-instances/worker-a/cdp-env.sh"
node skills/chrome-cdp/scripts/cdp.mjs list
```

The helper starts a dedicated Windows Chrome profile, writes `DevToolsActivePort` into that profile, and creates a reusable `cdp-env.sh` binding file.

For unattended sessions, keep the daemon alive:

```bash
export CDP_IDLE_TIMEOUT_MS=0
node skills/chrome-cdp/scripts/cdp.mjs list
```

### 2. Shared-session mode

Use this only when the user explicitly wants an already-open Chrome window/profile, such as an existing logged-in session or manual debugging context.

Why it is less stable:

- Chrome approval UI may appear when a new remote debugging session is requested
- profile selection can be ambiguous if multiple `DevToolsActivePort` files exist
- the wrong browser/profile is easier to hit unless binding is explicit

Recommended binding:

```bash
export CDP_PORT_FILE='/full/path/to/DevToolsActivePort'
export CDP_INSTANCE_NAME='shared-main'
export CDP_IDLE_TIMEOUT_MS=0
node skills/chrome-cdp/scripts/cdp.mjs list
```

On WSL, the script auto-discovers common Windows Chrome/Edge/Brave `DevToolsActivePort` paths under `/mnt/c/Users/*/AppData/Local/...`, but explicit `CDP_PORT_FILE` is still the safer choice when more than one browser/profile may be running.

## Permission Model

- Remote debugging enablement happens at the browser/profile level.
- Stable command reuse happens at the attached page target / tab session level.
- In normal operation, the same attached tab can be navigated across URLs without re-approval because the daemon keeps the same CDP session alive.
- A new tab is a new target. Treat it as needing its own first attach.
- If the daemon exits, the browser restarts, the target is destroyed, or you run `stop`, the reuse guarantee is gone.
- Shared-session mode may require explicit user approval in Chrome UI. Isolated-instance mode is the preferred way to avoid repeated approvals.

## Commands

All commands use `scripts/cdp.mjs`. `<target>` is a unique targetId prefix from `list`; use the full displayed prefix. The CLI rejects ambiguous prefixes.

Standard workflow:

1. Pick one connection mode.
2. Bind the instance explicitly with `CDP_PORT_FILE` and `CDP_INSTANCE_NAME`.
3. Run `node skills/chrome-cdp/scripts/cdp.mjs list`.
4. Choose the unique target prefix from the cached page list.
5. Let the first page command attach to that target.
6. Reuse that same target for `nav`, `eval`, `snap`, `shot`, `click`, and `type`.
7. Stop daemons only when you are finished.

### List open pages

```bash
node skills/chrome-cdp/scripts/cdp.mjs list
```

### Take a screenshot

```bash
node skills/chrome-cdp/scripts/cdp.mjs shot <target> [file]
```

Captures the **viewport only**. Scroll first with `eval` if you need content below the fold. Output includes the page's DPR and coordinate conversion hint (see **Coordinates** below).

### Accessibility tree snapshot

```bash
node skills/chrome-cdp/scripts/cdp.mjs snap <target>
```

### Evaluate JavaScript

```bash
node skills/chrome-cdp/scripts/cdp.mjs eval <target> <expr>
```

Avoid index-based selection (`querySelectorAll(...)[i]`) across multiple `eval` calls when the DOM can change between them. Collect all data in one `eval` or use stable selectors.

### Other commands

```bash
node skills/chrome-cdp/scripts/cdp.mjs html    <target> [selector]
node skills/chrome-cdp/scripts/cdp.mjs nav     <target> <url>
node skills/chrome-cdp/scripts/cdp.mjs net     <target>
node skills/chrome-cdp/scripts/cdp.mjs click   <target> <selector>
node skills/chrome-cdp/scripts/cdp.mjs clickxy <target> <x> <y>
node skills/chrome-cdp/scripts/cdp.mjs type    <target> <text>
node skills/chrome-cdp/scripts/cdp.mjs loadall <target> <selector> [ms]
node skills/chrome-cdp/scripts/cdp.mjs evalraw <target> <method> [json]
node skills/chrome-cdp/scripts/cdp.mjs open    [url]
node skills/chrome-cdp/scripts/cdp.mjs stop    [target]
```

## Coordinates

`shot` saves an image at native resolution: image pixels = CSS pixels x DPR. CDP input events (`clickxy`, etc.) take **CSS pixels**.

```
CSS px = screenshot image px / DPR
```

`shot` prints the DPR for the current page. Typical Retina (DPR=2): divide screenshot coordinates by 2.

## Tips

- Prefer `snap` over `html` when you need structure instead of raw markup.
- Use `type` instead of `eval` to enter text in cross-origin iframes.
- In multi-agent setups, do not reuse `CDP_INSTANCE_NAME` across workers.
- Keep `CDP_IDLE_TIMEOUT_MS=0` for unattended work; otherwise the daemon may exit and force a fresh attach later.
- If `CDP_PORT_FILE` is explicit, it must point at the exact instance you intend to drive. Do not rely on fallback discovery in multi-browser environments.
- If localhost CDP commands hang in an environment with shell proxies, make sure `127.0.0.1` CDP traffic bypasses the proxy.
