from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from datetime import date
from pathlib import Path


DOCKER_WAIT_SECONDS = 120
READY_WAIT_SECONDS = 120
STATE_FILE_NAME = "monday-refresh-state.json"
CONTAINER_NAME = "google-workspace-mcp"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def build_env(root: Path) -> dict[str, str]:
    env = os.environ.copy()
    env.update(load_env_file(root / ".env"))
    return env


def host_token_path() -> Path:
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return config_home / "google-workspace-mcp" / "token.json"


def container_token_path(root: Path) -> Path:
    return root / "docker-data" / "config" / "google-workspace-mcp" / "token.json"


def state_file_path(root: Path) -> Path:
    return root / "docker-data" / STATE_FILE_NAME


def should_run_monday_auth(today: date, state_path: Path, force: bool) -> bool:
    if force:
        return True
    if today.weekday() != 0:
        return False
    if not state_path.exists():
        return True

    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return True
    return state.get("last_successful_auth_date") != today.isoformat()


def save_auth_state(state_path: Path, auth_date: date) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps({"last_successful_auth_date": auth_date.isoformat()}, indent=2) + "\n",
        encoding="utf-8",
    )


def run_command(
    args: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd),
        env=env,
        text=True,
        capture_output=capture_output,
        check=False,
    )


def wait_for_docker(root: Path, env: dict[str, str], timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = run_command(["docker", "info"], cwd=root, env=env, capture_output=True)
        if result.returncode == 0:
            return
        time.sleep(5)
    raise RuntimeError(f"Docker was not ready within {timeout_seconds} seconds.")


def run_auth_flow(root: Path, env: dict[str, str]) -> None:
    process = subprocess.Popen(
        ["node", "dist/index.js", "auth"],
        cwd=str(root),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    assert process.stdout is not None
    opened_browser = False

    for line in process.stdout:
        print(line, end="")
        marker = "Authorize this app by visiting this url:"
        if not opened_browser and marker in line:
            auth_url = line.split(marker, 1)[1].strip()
            if auth_url:
                webbrowser.open(auth_url)
                opened_browser = True
                print("Opened Google authorization URL in browser.")

    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"Authorization flow failed with exit code {return_code}.")


def sync_token(root: Path) -> None:
    source = host_token_path()
    destination = container_token_path(root)
    if not source.exists():
        raise FileNotFoundError(f"Host token not found at {source}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    print(f"Synced refreshed token into {destination}")


def ensure_container_started(root: Path, env: dict[str, str]) -> None:
    result = run_command(["docker", "compose", "up", "-d"], cwd=root, env=env, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "docker compose up -d failed")
    if result.stdout.strip():
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")


def restart_container(root: Path, env: dict[str, str]) -> None:
    result = run_command(
        ["docker", "compose", "restart", CONTAINER_NAME],
        cwd=root,
        env=env,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or result.stdout.strip() or f"docker compose restart {CONTAINER_NAME} failed"
        )
    if result.stdout.strip():
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")


def wait_for_ready(root: Path, env: dict[str, str], timeout_seconds: int) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = run_command(
            [
                "docker",
                "inspect",
                "--format",
                "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
                CONTAINER_NAME,
            ],
            cwd=root,
            env=env,
            capture_output=True,
        )
        if result.returncode == 0:
            status = result.stdout.strip()
            if status == "healthy":
                return
            if status == "running":
                return
        time.sleep(2)
    raise RuntimeError(f"Container did not become healthy within {timeout_seconds} seconds.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Startup helper for weekly Google OAuth refresh and Docker restart."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run the authorization flow immediately even if today is not Monday.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    env = build_env(root)
    os.environ.update(env)

    today = date.today()
    state_path = state_file_path(root)

    wait_for_docker(root, env, DOCKER_WAIT_SECONDS)

    if should_run_monday_auth(today, state_path, args.force):
        print(f"Running Google authorization flow for {today.isoformat()}.")
        run_auth_flow(root, env)
        sync_token(root)
        save_auth_state(state_path, today)
        ensure_container_started(root, env)
        restart_container(root, env)
    else:
        print(f"Skipping authorization for {today.isoformat()}; Monday refresh already satisfied or not due.")
        if host_token_path().exists():
            sync_token(root)
        ensure_container_started(root, env)

    print("Waiting for container health...")
    wait_for_ready(root, env, READY_WAIT_SECONDS)
    print("Container is ready at http://127.0.0.1:8089/mcp")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"startup_refresh.py failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
