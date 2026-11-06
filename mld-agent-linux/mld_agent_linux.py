#!/usr/bin/env python3
"""
Meeting Leech Detector (MLD) - Linux Desktop Agent
Supports X11 and Wayland environments with V4L2 camera presence tracking.
Zero external pip dependencies required (runs on pure Python 3.6+).
"""

import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

CONFIG_PATH = Path.home() / ".mld_agent.properties"

class LinuxAgentConfig:
    def __init__(self):
        self.server_url = "https://mld-server.onrender.com"
        self.uuid = ""
        self.cpat_enabled = False
        self.load()

    def load(self):
        if not CONFIG_PATH.exists():
            return
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip()
                    if k == "serverUrl" and v:
                        self.server_url = v
                    elif k == "uuid":
                        self.uuid = v
                    elif k == "cpatEnabled":
                        self.cpat_enabled = v.lower() == "true"
        except Exception as e:
            print(f"[Config] Load warning: {e}")

    def save(self):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                f.write("# MLD Linux Desktop Agent Properties\n")
                f.write(f"serverUrl={self.server_url}\n")
                f.write(f"uuid={self.uuid}\n")
                f.write(f"cpatEnabled={'true' if self.cpat_enabled else 'false'}\n")
        except Exception as e:
            print(f"[Config] Save error: {e}")

    def update_token(self, token):
        self.uuid = token
        self.save()


class LinuxActivityMonitor:
    @staticmethod
    def is_wayland():
        return bool(os.environ.get("WAYLAND_DISPLAY"))

    @staticmethod
    def get_active_window_title():
        """Retrieve the foreground window title via X11 / Wayland / Proc fallback."""
        # 1. Try X11 via xdotool (fastest & most accurate on X11)
        if not LinuxActivityMonitor.is_wayland():
            try:
                res = subprocess.run(
                    ["xdotool", "getwindowfocus", "getwindowname"],
                    capture_output=True, text=True, timeout=1
                )
                if res.returncode == 0 and res.stdout.strip():
                    return res.stdout.strip()
            except Exception:
                pass

            # 2. Try X11 via xprop fallback
            try:
                root_res = subprocess.run(
                    ["xprop", "-root", "_NET_ACTIVE_WINDOW"],
                    capture_output=True, text=True, timeout=1
                )
                if root_res.returncode == 0 and "window id #" in root_res.stdout:
                    win_id = root_res.stdout.split("window id #")[1].split()[0]
                    name_res = subprocess.run(
                        ["xprop", "-id", win_id, "WM_NAME"],
                        capture_output=True, text=True, timeout=1
                    )
                    if name_res.returncode == 0 and '="' in name_res.stdout:
                        title = name_res.stdout.split('="', 1)[1].rsplit('"', 1)[0]
                        if title.strip():
                            return title.strip()
            except Exception:
                pass

        # 3. Try Wayland inspection via wlrctl or kwin
        if LinuxActivityMonitor.is_wayland():
            try:
                res = subprocess.run(
                    ["wlrctl", "toplevel", "list"],
                    capture_output=True, text=True, timeout=1
                )
                if res.returncode == 0 and res.stdout.strip():
                    lines = res.stdout.strip().splitlines()
                    for line in lines:
                        if "focused" in line.lower() or "active" in line.lower():
                            return line.strip()
                    if lines:
                        return lines[0].strip()
            except Exception:
                pass

        # 4. Fallback: inspect top active meeting/browser process
        meeting_procs = ["zoom", "teams", "slack", "webex", "chrome", "firefox", "brave"]
        try:
            ps_res = subprocess.run(
                ["ps", "-eo", "comm", "--sort=-%cpu"],
                capture_output=True, text=True, timeout=1
            )
            if ps_res.returncode == 0:
                for line in ps_res.stdout.splitlines()[:15]:
                    proc_name = line.strip().lower()
                    for m in meeting_procs:
                        if m in proc_name:
                            return f"Linux Workspace - {line.strip()}"
        except Exception:
            pass

        return "Linux Desktop Workspace"

    @staticmethod
    def get_idle_seconds():
        """Retrieve hardware idle time in seconds."""
        # 1. Try xprintidle (X11)
        try:
            res = subprocess.run(["xprintidle"], capture_output=True, text=True, timeout=1)
            if res.returncode == 0 and res.stdout.strip().isdigit():
                return int(res.stdout.strip()) // 1000
        except Exception:
            pass

        # 2. Try DBus idle monitors (GNOME / KDE)
        try:
            dbus_cmd = [
                "dbus-send", "--print-reply", "--dest=org.gnome.Mutter.IdleMonitor",
                "/org/gnome/Mutter/IdleMonitor/Core",
                "org.gnome.Mutter.IdleMonitor.GetIdletime"
            ]
            res = subprocess.run(dbus_cmd, capture_output=True, text=True, timeout=1)
            if res.returncode == 0 and "uint64" in res.stdout:
                ms_val = int(res.stdout.split("uint64")[1].strip())
                return ms_val // 1000
        except Exception:
            pass

        return 0

    @staticmethod
    def is_webcam_active():
        """Check if any /dev/video* interface is actively accessed by an application (V4L2)."""
        video_devs = list(Path("/dev").glob("video*"))
        if not video_devs:
            return False

        # Non-invasive lock detection via fuser or lsof
        for dev in video_devs:
            try:
                res = subprocess.run(["fuser", str(dev)], capture_output=True, text=True, timeout=1)
                if res.returncode == 0 and res.stdout.strip():
                    return True
            except Exception:
                pass
        return False


class LinuxBackendClient:
    @staticmethod
    def post_json(url, payload_dict, token=""):
        data = json.dumps(payload_dict).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json; charset=utf-8")
        req.add_header("User-Agent", "MLD-Agent/2.0 (Linux; x86_64)")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                body = resp.read().decode("utf-8")
                return True, body
        except Exception as e:
            return False, str(e)

    @staticmethod
    def get_json(url):
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "MLD-Agent/2.0 (Linux; x86_64)")
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                body = resp.read().decode("utf-8")
                return True, body
        except Exception as e:
            return False, str(e)


class MldLinuxAgent:
    def __init__(self):
        self.config = LinuxAgentConfig()
        self.is_monitoring = False
        self.current_session = None

    def handle_args(self):
        args = sys.argv[1:]
        for i in range(len(args)):
            arg = args[i]
            if arg.startswith("mld-agent://link?token="):
                tok = arg.split("token=")[1].split("&")[0].strip()
                if tok:
                    self.config.update_token(tok)
                    print(f"[MLD] Linked account token via protocol: {tok}")
            elif arg == "--token" and i + 1 < len(args):
                tok = args[i + 1].strip()
                self.config.update_token(tok)
                print(f"[MLD] Linked account token via CLI: {tok}")
            elif arg == "--server" and i + 1 < len(args):
                self.config.server_url = args[i + 1].strip()
                self.config.save()

    def run(self):
        self.handle_args()
        print("==================================================")
        print("     MLD DESKTOP AGENT - LINUX WORKSTATION       ")
        print("==================================================")
        print(f"Backend Server: {self.config.server_url}")
        print(f"Account Token:  {self.config.uuid if self.config.uuid else '[Unlinked - Please pair]'}")
        print("Agent is running in background. Press Ctrl+C to exit.")

        heartbeat_counter = 0

        while True:
            try:
                # Reload config if updated externally
                self.config.load()

                if not self.config.uuid:
                    time.sleep(5)
                    continue

                # 1. Heartbeat every ~16 seconds (every 2nd loop)
                if heartbeat_counter % 2 == 0:
                    hb_url = f"{self.config.server_url}/api/heartbeat"
                    LinuxBackendClient.post_json(hb_url, {"uuid": self.config.uuid}, self.config.uuid)
                heartbeat_counter += 1

                # 2. Check Active Session Status
                status_url = f"{self.config.server_url}/api/active-session?uuid={self.config.uuid}"
                ok, status_resp = LinuxBackendClient.get_json(status_url)

                if ok and ('"active":true' in status_resp or '"active": true' in status_resp):
                    # Extract session code
                    session_code = "SESSION"
                    try:
                        parsed = json.loads(status_resp)
                        session_code = parsed.get("sessionCode", "SESSION")
                    except Exception:
                        pass

                    if not self.is_monitoring:
                        self.is_monitoring = True
                        self.current_session = session_code
                        print(f"\n[MLD] Active meeting session detected: {session_code}. Ingesting telemetry...")

                    # Capture window, webcam, idle
                    win_title = LinuxActivityMonitor.get_active_window_title()
                    webcam_on = LinuxActivityMonitor.is_webcam_active()
                    idle_sec = LinuxActivityMonitor.get_idle_seconds()

                    track_url = f"{self.config.server_url}/api/track"
                    telemetry_payload = {
                        "uuid": self.config.uuid,
                        "sessionCode": session_code,
                        "window": win_title,
                        "webcam": webcam_on,
                        "idle": idle_sec
                    }
                    LinuxBackendClient.post_json(track_url, telemetry_payload, self.config.uuid)
                else:
                    if self.is_monitoring:
                        self.is_monitoring = False
                        self.current_session = None
                        print("\n[MLD] Meeting ended. Agent reverted to standby.")

            except Exception as e:
                print(f"[MLD Error] {e}")

            time.sleep(8)


if __name__ == "__main__":
    agent = MldLinuxAgent()
    try:
        agent.run()
    except KeyboardInterrupt:
        print("\n[MLD] Agent stopped cleanly.")
        sys.exit(0)

