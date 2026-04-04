from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_SCRIPT = REPO_ROOT / "backend" / "scripts" / "vivo_llm_smoke.py"
DOCKER_SCRIPT = "scripts/vivo_llm_smoke.py"


def print_wrapper_help() -> int:
    print(
        "\n".join(
            [
                "Usage: python scripts/vivo_llm_smoke.py [--runner docker|local-source] [--env-file PATH] [-- ...backend args]",
                "",
                "Wrapper options:",
                "  --runner docker|local-source   Default: docker",
                "  --env-file PATH                Only applied for --runner local-source",
                "",
                "All other arguments are forwarded to backend/scripts/vivo_llm_smoke.py.",
                "To see backend script help locally, run:",
                "  python scripts/vivo_llm_smoke.py --runner local-source -- --help",
            ]
        )
    )
    return 0


def split_args(argv: list[str]) -> tuple[str, str | None, list[str]]:
    runner = "docker"
    env_file: str | None = None
    forwarded: list[str] = []

    index = 0
    passthrough = False
    while index < len(argv):
        current = argv[index]
        if passthrough:
            forwarded.append(current)
            index += 1
            continue
        if current == "--":
            passthrough = True
            index += 1
            continue
        if current in {"-h", "--help"}:
            raise SystemExit(print_wrapper_help())
        if current == "--runner":
            if index + 1 >= len(argv):
                raise SystemExit("--runner requires a value")
            runner = argv[index + 1]
            index += 2
            continue
        if current == "--env-file":
            if index + 1 >= len(argv):
                raise SystemExit("--env-file requires a value")
            env_file = argv[index + 1]
            index += 2
            continue
        forwarded.append(current)
        index += 1

    if runner not in {"docker", "local-source"}:
        raise SystemExit(f"unsupported runner: {runner}")

    return runner, env_file, forwarded


def load_env_file(path: Path) -> dict[str, str]:
    env_updates: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env_updates[key.strip()] = value.strip()
    return env_updates


def build_command(runner: str, forwarded: list[str]) -> list[str]:
    if runner == "docker":
        return ["docker", "compose", "exec", "-T", "brain", "python", DOCKER_SCRIPT, *forwarded]
    return [sys.executable, str(BACKEND_SCRIPT), *forwarded]


def main() -> int:
    runner, env_file, forwarded = split_args(sys.argv[1:])
    env = os.environ.copy()

    if env_file and runner == "local-source":
        env.update(load_env_file((REPO_ROOT / env_file).resolve() if not Path(env_file).is_absolute() else Path(env_file)))

    command = build_command(runner, forwarded)
    completed = subprocess.run(command, cwd=REPO_ROOT, env=env, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
