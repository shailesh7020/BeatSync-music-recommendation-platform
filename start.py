#!/usr/bin/env python3
"""
BeatSync All-in-One Launcher
Starts both the FastAPI backend and Vite frontend with a single command.
Handles graceful shutdown, local IP detection for mobile access, and auto-opens your browser.
"""

import os
import sys
import time
import socket
import signal
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def get_local_ip() -> str:
    """Detect local Wi-Fi / LAN IP address for phone connectivity."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def is_port_in_use(port: int) -> bool:
    """Check if a port is already occupied."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def kill_port(port: int):
    """Kill any process holding a specific port on Windows."""
    if sys.platform == "win32":
        try:
            output = subprocess.check_output(
                f"netstat -aon | findstr :{port}", shell=True, text=True, stderr=subprocess.DEVNULL
            )
            for line in output.strip().split("\n"):
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in line:
                    pid = parts[-1]
                    subprocess.run(f"taskkill /f /pid {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


def main():
    print("\n" + "=" * 62)
    print("        🚀  STARTING BEATSYNC AI MUSIC PLATFORM  🚀")
    print("=" * 62)

    # 1. Clean up stale processes if needed
    for port in [8000, 5173]:
        if is_port_in_use(port):
            print(f"[*] Port {port} is already in use. Freeing port...")
            kill_port(port)
            time.sleep(1)

    local_ip = get_local_ip()
    processes = []

    try:
        # 2. Start FastAPI Backend
        print("[1/2] 🐍 Starting Backend (FastAPI + WebSockets)...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        processes.append(backend_proc)

        # 3. Start Vite Frontend
        print("[2/2] ⚛️  Starting Frontend (React + Vite)...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        frontend_proc = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            shell=(sys.platform == "win32"),
        )
        processes.append(frontend_proc)

        # Wait for servers to spin up
        time.sleep(2.5)

        # 4. Display Access URLs
        print("\n" + "=" * 62)
        print("  ✅  BEATSYNC IS RUNNING!")
        print("=" * 62)
        print(f"  💻  Laptop Browser:  http://localhost:5173")
        print(f"  📱  Mobile Phone:     http://{local_ip}:5173")
        print(f"  📖  API Documentation: http://localhost:8000/api/v1/docs")
        print("=" * 62)
        print("  💡 Press Ctrl+C at any time to stop all servers.")
        print("=" * 62 + "\n")

        # 5. Automatically open the browser on laptop
        try:
            webbrowser.open("http://localhost:5173")
        except Exception:
            pass

        # 6. Keep main process alive and monitor child processes
        while True:
            time.sleep(1)
            for proc in processes:
                if proc.poll() is not None:
                    # A process crashed or exited
                    err = proc.stderr.read().decode("utf-8", errors="ignore") if proc.stderr else ""
                    print(f"\n[!] A server process exited unexpectedly:\n{err}")
                    return

    except KeyboardInterrupt:
        print("\n[*] Stopping BeatSync servers...")
    finally:
        for proc in processes:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        # Ensure ports are freed on Windows
        kill_port(8000)
        kill_port(5173)

        print("[✓] All servers stopped cleanly. Goodbye!\n")


if __name__ == "__main__":
    main()
