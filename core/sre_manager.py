import os
import subprocess
import json
import psutil
import time
import re
import sys

SAMBA_DIR = '/scripts/SRE_Samba_Admin'
SAMBA_SHARES_CSV = os.path.join(SAMBA_DIR, 'samba_shares.csv')
SAMBA_VALIDATION_CSV = os.path.join(SAMBA_DIR, 'samba_validation.csv')
ALLOWED_SHARE_ROOTS = ['/', '/dados', '/dados-ext', '/var/www', '/mnt']

def is_allowed_share_path(path):
    try:
        full = os.path.realpath(path)
        for r in ALLOWED_SHARE_ROOTS:
            if full.startswith(os.path.realpath(r)):
                return True
        return False
    except Exception:
        return False

def get_active_jobs():
    active = []
    keywords = ['backup', 'samba_manager', 'restic', 'rclone', 'kopia', 'rsync', 'lazarus', 'sre_orchestrator']
    pattern = "|".join(keywords)
    
    try:
        cmd = ['pgrep', '-af', pattern]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                parts = line.split(' ', 1)
                if len(parts) < 2: continue
                pid, cmdline = parts[0], parts[1]
                
                # Filter out monitoring processes, ide server, and internal checks
                if any(x in cmdline for x in ['dashboard/app.py', 'gunicorn', 'vscode', 'grep', 'pgrep', 'python3 -c', 'get_active_jobs']):
                    continue
                    
                key = "Rotina de Backup"
                if 'rclone' in cmdline.lower(): key = "OneDrive Cloud Sync (Rclone)"
                elif 'rsync' in cmdline.lower(): key = "Local USB Air-Gap Sync (Rsync)"
                elif 'kopia' in cmdline.lower(): key = "Kopia VM Snapshot Engine"
                elif 'restic' in cmdline.lower(): key = "Restic Snapshot Engine"
                elif 'lazarus' in cmdline.lower(): key = "Lazarus Guard Engine"
                elif 'sre_orchestrator' in cmdline.lower(): key = "SRE Central Orchestrator"
                elif 'samba_manager' in cmdline: key = "Samba Manager ACL"
                elif 'backup' in cmdline.lower(): key = "Backup Engine Worker"

                try:
                    p = psutil.Process(int(pid))
                    start_time = p.create_time()
                    duration = int(time.time() - start_time)
                    if duration < 86400 * 7:
                        cpu = p.cpu_percent(interval=None)
                        mem = round(p.memory_percent(), 1)
                        active.append({
                            'key': f"{key} [PID: {pid}]",
                            'engine': key,
                            'script': cmdline,
                            'pid': pid,
                            'start_time': start_time,
                            'duration_seconds': duration,
                            'cpu_percent': cpu,
                            'mem_percent': mem,
                            'status': 'running',
                            'user': p.username()
                        })
                except Exception: pass
    except Exception: pass
    return sorted(active, key=lambda x: x['duration_seconds'], reverse=True)

def get_acl_details(path):
    """Fetch raw ACL details from samba_manager.py"""
    if not is_allowed_share_path(path):
        return None, "Acesso negado a este diretório"
    return run_samba_manager('get_acl', path)

def run_samba_manager(action, *args):
    cmd = [sys.executable, os.path.join(SAMBA_DIR, 'samba_manager.py'), action] + list(args)
    if os.geteuid() != 0:
        cmd.insert(0, 'sudo')
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=60)
        if res.returncode == 0:
            try:
                return json.loads(res.stdout), None
            except:
                return res.stdout, None
        return None, res.stderr or res.stdout
    except Exception as e:
        return None, str(e)
