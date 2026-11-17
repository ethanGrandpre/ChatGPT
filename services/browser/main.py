"""Start Dock Browser with: python3 main.py (Python 3.10+)."""
import os
from pathlib import Path
import secrets
import subprocess
import sys


def main():
    if sys.version_info < (3, 10):
        raise SystemExit('Python 3.10 or newer is required.')
    root = Path(__file__).resolve().parent
    os.chdir(root)
    python = root / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        subprocess.run([sys.executable, '-m', 'venv', str(root / '.venv')], check=True)
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(root / 'requirements.txt')], check=True)
    env = root / '.env'
    if not env.exists():
        fd = os.open(env, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write('ALLOWED_ORIGIN=https://chatgpt.ethan-grandpre0360.workers.dev\nBROWSER_SERVER_SECRET=' + secrets.token_hex(48) + '\n')
    print('Keep this process running. Connect a Cloudflare Tunnel in a second terminal:\ncloudflared tunnel --url http://127.0.0.1:8788\nSee README.md for Worker settings.', flush=True)
    subprocess.run([str(python), str(root / 'server.py')], check=True)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
    except subprocess.CalledProcessError as error:
        raise SystemExit(f'Setup or server failed (exit {error.returncode}). Check the message above.')
