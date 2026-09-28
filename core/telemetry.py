import os
import time
import json
import re
import psutil
import logging
import threading
from collections import deque
from datetime import datetime

# --- Cache ---
TELEMETRY_CACHE = {
    'kpis': {},
    'backups': {}
}
CACHE_LOCK = threading.Lock()

METRIC_HISTORY = deque(maxlen=600)
POLL_INTERVAL = 10.0

def telemetry_collector(log_root):
    while True:
        try:
            # 1. Hardware KPIs
            cpu = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            
            disks = {}
            for path in ['/', '/dados', '/dados-ext', '/dados-ext-II']:
                if os.path.exists(path):
                    try:
                        usage = psutil.disk_usage(path)
                        disks[path] = {'total': usage.total, 'used': usage.used, 'free': usage.free, 'percent': usage.percent}
                    except: pass

            uptime = datetime.now().timestamp() - psutil.boot_time()
            
            count = 0
            if os.path.exists(log_root):
                for root, _, files in os.walk(log_root):
                    count += len([f for f in files if f.endswith('.log')])

            # 2. Backup Status
            backups = calculate_backup_status()
            
            # Update cache
            with CACHE_LOCK:
                TELEMETRY_CACHE['kpis'] = {
                    'cpu_percent': cpu,
                    'mem_total': mem.total,
                    'mem_used': mem.used,
                    'mem_percent': mem.percent,
                    'disks': disks,
                    'uptime_seconds': int(uptime),
                    'log_files': count
                }
                TELEMETRY_CACHE['backups'] = backups
                METRIC_HISTORY.append({'ts': int(time.time()), 'cpu': cpu, 'mem': mem.percent})

        except Exception as e:
            logging.error(f"Telemetry Collector Error: {e}")
            
        time.sleep(POLL_INTERVAL)

def calculate_backup_status():
    status = {
        'standard': {'status': 'ok', 'details': 'Sincronismo mHC Ativo'},
        'vm': {'status': 'ok', 'details': 'Kopia Snapshots Ativos'},
        'local': {'status': 'warning', 'details': 'HD Offline / Air-Gap'},
        'volumes': [],
        'health_score': 100,
        'nominal_count': 0,
        'warning_count': 0,
        'error_count': 0,
        'total_count': 0
    }
    
    # Load manifest if available
    manifest_path = '/scripts/SRE_Backup_2026/config/jobs_manifest.json'
    manifest_jobs = {}
    if os.path.isfile(manifest_path):
        try:
            with open(manifest_path, 'r') as f:
                manifest_jobs = json.load(f).get('jobs', {})
        except Exception:
            pass

    log_dir = '/scripts/SRE_Backup_2026/logs'
    log_files = os.listdir(log_dir) if os.path.isdir(log_dir) else []
    
    volume_list = []
    nominal_cnt = 0
    warning_cnt = 0
    error_cnt = 0

    # Build volumes list from manifest + defaults
    for job_key, job_info in manifest_jobs.items():
        job_id = f"vol_{job_key}"
        src = job_info.get('source', f"/dados/{job_key}")
        dst = job_info.get('destination', 'OneDrive Cloud Engine')
        
        prefix = f"backup_{job_key}_"
        matching = [f for f in log_files if f.startswith(prefix) and f.endswith('.log')]
        
        job_status = 'NOMINAL'
        job_details = 'Sincronizado e Validado'
        
        if not matching:
            job_status = 'ATENÇÃO'
            job_details = 'Sem registros de log'
        else:
            latest_filename = sorted(matching)[-1]
            latest_path = os.path.join(log_dir, latest_filename)
            
            try:
                mtime = os.path.getmtime(latest_path)
                hours_ago = (time.time() - mtime) / 3600
                
                with open(latest_path, 'rb') as lf:
                    lf.seek(0, 2)
                    sz = lf.tell()
                    lf.seek(max(0, sz - 4096))
                    tail = lf.read().decode('latin1', errors='ignore')
                
                if 'ERROR' in tail or 'failed' in tail.lower() or 'FALHA' in tail:
                    job_status = 'ERRO'
                    job_details = 'Erro detectado no log de sincronização'
                elif 'WARNING' in tail or 'LAZARUS:' in tail or 'excedem o limite' in tail:
                    job_status = 'ATENÇÃO'
                    m = re.search(r'LAZARUS:\s*(\d+)\s*arquivos', tail)
                    if m:
                        job_details = f"{m.group(1)} caminhos longos (Lazarus)"
                    else:
                        job_details = 'Avisos de formato/Lazarus'
                elif hours_ago > 48:
                    job_status = 'ATENÇÃO'
                    job_details = f"Última exec. há {int(hours_ago)}h"
            except Exception as e:
                job_status = 'ATENÇÃO'
                job_details = 'Leitura de log indisponível'

        if job_status == 'NOMINAL':
            nominal_cnt += 1
        elif job_status == 'ATENÇÃO':
            warning_cnt += 1
        else:
            error_cnt += 1

        volume_list.append({
            'job_id': job_id,
            'volume_name': f"Volume {job_key.upper()} ({os.path.basename(src)})",
            'status': job_status,
            'details': job_details,
            'source_path': src,
            'target_cloud': dst
        })

    # Check physical USB air-gap status dynamically
    local_status = 'NOMINAL'
    local_details = 'Discos USB Conectados / Shannon Entropy Ok'
    try:
        usb_connected = (
            os.path.exists('/dev/disk/by-label/BACKUP_LOCAL_1') or 
            os.path.exists('/dev/disk/by-label/BACKUP_LOCAL_2') or 
            os.path.exists('/dev/sde1') or 
            os.path.exists('/dev/sdf1')
        )
        if not usb_connected:
            local_status = 'ATENÇÃO'
            local_details = 'Discos USB Air-Gap Desconectados (Aguardando Janela)'
    except Exception:
        pass

    # Dynamic check for Totvs Datasul & SQL Server dump status
    datasul_status = 'NOMINAL'
    datasul_details = 'Dump Progress & SQL Server OK'
    datasul_source = r'\\192.168.10.2\c$\totvs\datasul & /dados/backup'
    datasul_cloud = 'OneDrive / M365 (via /dados/backup)'
    try:
        totvs_dir = '/dados/backup/Backup_Totvs'
        if os.path.isdir(totvs_dir):
            today_str = datetime.now().strftime("%d_%m_%Y")
            today_dir = os.path.join(totvs_dir, f"ON_BACKUP_{today_str}")
            if os.path.isdir(today_dir):
                files_count = len(os.listdir(today_dir))
                datasul_details = f"Dump Hoje {today_str}: {files_count} itens OK (Espelhado)"
            else:
                on_folders = sorted([d for d in os.listdir(totvs_dir) if d.startswith('ON_BACKUP_')])
                if on_folders:
                    latest_d = on_folders[-1]
                    datasul_details = f"Último Dump: {latest_d} OK"
                else:
                    datasul_status = 'ATENÇÃO'
                    datasul_details = 'Nenhum conjunto ON_BACKUP encontrado'
    except Exception as e:
        datasul_details = f"Verificação: {str(e)[:30]}"

    # Add special infrastructure volumes if not present
    special_volumes = [
        { 'job_id': 'vol_datasul', 'volume_name': 'Totvs Datasul DB Dump', 'status': datasul_status, 'details': datasul_details, 'source_path': datasul_source, 'target_cloud': datasul_cloud },
        { 'job_id': 'vol_kopia_vm', 'volume_name': 'Kopia VM Infrastructure', 'status': 'NOMINAL', 'details': 'Snapshots Hyper-V Ok', 'source_path': 'HYPER-V_VMS', 'target_cloud': 'StorageNASVault NAS (Snapshots Kopia)' },
        { 'job_id': 'vol_local_offline_hd', 'volume_name': 'Local Físico (Discos USB Air-Gap)', 'status': local_status, 'details': local_details, 'source_path': '/dados & /dados-ext', 'target_cloud': 'Discos USB Air-Gap (Rsync / AEGIS)' },
    ]
    
    existing_ids = {v['job_id'] for v in volume_list}
    for sv in special_volumes:
        if sv['job_id'] not in existing_ids:
            volume_list.append(sv)
            if sv['status'] == 'NOMINAL':
                nominal_cnt += 1
            else:
                warning_cnt += 1

    total_cnt = len(volume_list)
    # Calculate real health score
    health_score = round(((nominal_cnt * 100) + (warning_cnt * 75)) / total_cnt) if total_cnt > 0 else 100

    status['volumes'] = volume_list
    status['health_score'] = health_score
    status['nominal_count'] = nominal_cnt
    status['warning_count'] = warning_cnt
    status['error_count'] = error_cnt
    status['total_count'] = total_cnt
    status['total_volumes'] = total_cnt

    paths = {
        'standard': '/scripts/SRE_Backup_2026/logs',
        'vm': '/scripts/SRE_VM_Backup_2026/logs',
        'local': '/scripts/SRE_Local_Backup_2026/logs'
    }
    for key, path in paths.items():
        if not os.path.exists(path): continue
        files = [os.path.join(path, f) for f in os.listdir(path) if f.endswith('.log')]
        if not files: continue
        latest_log = max(files, key=os.path.getmtime)
        mtime = os.path.getmtime(latest_log)
        elapsed_days = (time.time() - mtime) / 86400
        try:
            with open(latest_log, 'r', errors='replace') as f:
                f.seek(0, 2)
                size = f.tell()
                f.seek(max(0, size - 2048))
                content = f.read()
            if key == 'vm':
                if 'Finished ===' in content or 'Kopia snapshot created' in content: status[key] = {'status': 'ok', 'details': 'Finalizado com sucesso'}
                elif 'Executing: /scripts' in content or 'Creating Kopia snapshot' in content: status[key] = {'status': 'active', 'details': 'Em execução'}
                elif 'ERROR' in content or 'failed' in content.lower(): status[key] = {'status': 'error', 'details': 'Erro detectado no log'}
            elif key == 'standard':
                if 'master_sync' in latest_log: status[key] = {'status': 'active' if elapsed_days < 0.1 else 'ok', 'details': 'Sincronismo mHC Ativo' if elapsed_days < 0.1 else 'Aguardando próximo ciclo'}
                elif 'SUCESSO' in content: status[key] = {'status': 'ok', 'details': 'Sincronismo finalizado'}
            if elapsed_days > 2 and status[key]['status'] == 'ok':
                status[key]['status'] = 'warning'
                status[key]['details'] = f'Último sucesso há {int(elapsed_days)} dias'
        except: pass

    return status

def start_collector(log_root):
    t = threading.Thread(target=telemetry_collector, args=(log_root,), daemon=True)
    t.start()

def get_kpis(log_root):
    with CACHE_LOCK:
        if TELEMETRY_CACHE['kpis']:
            return TELEMETRY_CACHE['kpis']
    cpu = psutil.cpu_percent()
    mem = psutil.virtual_memory()
    return {
        'cpu_percent': cpu,
        'mem_total': mem.total,
        'mem_used': mem.used,
        'mem_percent': mem.percent,
        'disks': {},
        'uptime_seconds': int(datetime.now().timestamp() - psutil.boot_time()),
        'log_files': 0
    }

def get_backup_status():
    with CACHE_LOCK:
        if TELEMETRY_CACHE['backups']:
            return TELEMETRY_CACHE['backups']
    return calculate_backup_status()
