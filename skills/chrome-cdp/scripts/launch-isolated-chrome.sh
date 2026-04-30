#!/usr/bin/env bash
set -euo pipefail

name="${1:-}"
url="${2:-about:blank}"

if [[ -z "$name" ]]; then
  echo "Usage: bash skills/chrome-cdp/scripts/launch-isolated-chrome.sh <instance-name> [url]" >&2
  exit 1
fi

if ! command -v wslpath >/dev/null 2>&1; then
  echo "This helper is intended for WSL environments with wslpath available." >&2
  exit 1
fi

sanitize() {
  printf '%s' "$1" | sed -E 's/[^A-Za-z0-9._-]+/-/g; s/^-+//; s/-+$//'
}

instance_name="$(sanitize "$name")"
if [[ -z "$instance_name" ]]; then
  echo "Instance name becomes empty after sanitization." >&2
  exit 1
fi

profile_root="${CDP_PROFILE_ROOT:-$HOME/.cache/cdp-instances}"
instance_dir="${profile_root}/${instance_name}"
port_file="${instance_dir}/DevToolsActivePort"
env_file="${instance_dir}/cdp-env.sh"

mkdir -p "$instance_dir"
rm -f "$port_file"

cat >"$env_file" <<EOF
export CDP_INSTANCE_NAME='${instance_name}'
export CDP_PORT_FILE='${port_file}'
export CDP_IDLE_TIMEOUT_MS='0'
EOF
chmod 600 "$env_file"

browser_path="${CDP_BROWSER_EXE:-}"
if [[ -z "$browser_path" ]]; then
  for candidate in \
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" \
    "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"
  do
    if [[ -f "$candidate" ]]; then
      browser_path="$candidate"
      break
    fi
  done
fi

if [[ -z "$browser_path" || ! -f "$browser_path" ]]; then
  echo "Unable to locate a Chrome/Edge/Brave executable. Set CDP_BROWSER_EXE explicitly." >&2
  exit 1
fi

browser_win="$(wslpath -w "$browser_path")"
profile_win="$(wslpath -w "$instance_dir")"

ps_url="${url//\'/\'\'}"
ps_browser="${browser_win//\'/\'\'}"
ps_profile="${profile_win//\'/\'\'}"

ps_host="${CDP_POWERSHELL_EXE:-}"
if [[ -z "$ps_host" ]]; then
  for candidate in \
    "powershell.exe" \
    "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" \
    "/mnt/c/Program Files/PowerShell/7/pwsh.exe"
  do
    if command -v "$candidate" >/dev/null 2>&1 || [[ -f "$candidate" ]]; then
      ps_host="$candidate"
      break
    fi
  done
fi

if [[ -z "$ps_host" ]]; then
  echo "Unable to locate PowerShell. Set CDP_POWERSHELL_EXE explicitly." >&2
  exit 1
fi

"$ps_host" -NoProfile -Command "& {
  Start-Process -FilePath '$ps_browser' -ArgumentList @(
    '--remote-debugging-port=0',
    '--user-data-dir=$ps_profile',
    '--no-first-run',
    '--new-window',
    '$ps_url'
  ) | Out-Null
}" >/dev/null

for _ in $(seq 1 20); do
  if [[ -f "$port_file" ]]; then
    break
  fi
  sleep 0.5
done

cat <<EOF
Launched isolated browser instance: ${instance_name}
Browser executable: ${browser_path}
Profile directory: ${instance_dir}
Port file: ${port_file}

Use this instance with:
  source '${env_file}'
  node skills/chrome-cdp/scripts/cdp.mjs doctor
  node skills/chrome-cdp/scripts/cdp.mjs list
  node skills/chrome-cdp/scripts/cdp.mjs attach <target>
EOF

if [[ ! -f "$port_file" ]]; then
  echo
  echo "Note: DevToolsActivePort not detected yet. Chrome may still be starting."
fi
