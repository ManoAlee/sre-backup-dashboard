import os
import re
import logging
from datetime import datetime

ALLOWED_CMDS = ['tail', 'grep', 'cat', 'ls']

def strip_ansi(text):
    """Remove ANSI escape sequences from text."""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def tail_file(path, lines=500):
    try:
        with open(path, 'rb') as f:
            avg_line_length = 150
            to_read = lines * avg_line_length
            try:
                f.seek(-to_read, os.SEEK_END)
            except OSError:
                f.seek(0)
            data = f.read().decode(errors='replace')
            all_lines = data.splitlines()
            return '\n'.join(all_lines[-lines:])
    except Exception:
        return ''

def extract_metrics(raw):
    """Extract rclone/backup metrics from raw log text."""
    metrics = {}
    
    # Rclone patterns
    transferred = re.search(r'Transferred:\s+([\d\.]+ [KMGT]iB) / ([\d\.]+ [KMGT]iB), ([\d%]+)', raw)
    if transferred:
        metrics['progress'] = transferred.group(3)
        metrics['transferred'] = f"{transferred.group(1)} / {transferred.group(2)}"
        
    speed = re.search(r'Transferred:.*?([\d\.]+ [KMGT]i?B/s)', raw)
    if speed:
        metrics['speed'] = speed.group(1)
        
    eta = re.search(r'ETA ([\dwydhms-]+)', raw)
    if eta:
        metrics['eta'] = eta.group(1)

    elapsed = re.search(r'Elapsed time:\s+([\d\w\.]+)', raw)
    if elapsed:
        metrics['elapsed'] = elapsed.group(1)
        
    return metrics

def summarize_log(raw, script, latest_fp, latest_mtime):
    raw = strip_ansi(raw)
    lc = raw.lower()
    metrics = extract_metrics(raw)
    
    def make_resp(status, reasons, advice=None):
        unique_reasons = []
        seen = set()
        for r in reasons:
            if not r: continue
            r_clean = r.strip()
            if r_clean not in seen:
                seen.add(r_clean)
                unique_reasons.append(r_clean)
        
        reasons = unique_reasons[-6:]
        summary = reasons[0] if reasons else 'Log atualizado'
        
        # Detect Stall (Senior Logic)
        is_stalled = False
        if metrics.get('speed') == '0 B/s' or metrics.get('speed') == '0 KiB/s':
            is_stalled = True
            
        out = {
            'script': script, 
            'log_path': latest_fp, 
            'status': 'warning' if is_stalled and status == 'ok' else status, 
            'summary': "⚠️ Estagnado (0 B/s)" if is_stalled else summary, 
            'reasons': reasons, 
            'metrics': metrics,
            'last_mtime': int(latest_mtime) if latest_mtime else None
        }
        if advice: out['advice'] = advice
        return out

    # 0. Basic Checks
    if not raw.strip():
        return make_resp('warning', ['Log existe, mas está vazio'], advice='Verifique se o script iniciou a escrita.')
    if 'mount error' in lc or 'no such file or directory' in lc:
        return make_resp('error', ['Erro de Montagem/Caminho'], advice='Verifique conexões de rede ou HDs externos.')
    
    if 'invalid_grant' in lc or "couldn't fetch token" in lc:
        return make_resp('warning', ['Erro de Autenticação Cloud'], advice='Renove o token do rclone.')

    # 2. Results Analysis
    err_match = re.search(r'Errors:\s+(\d+)', raw, re.IGNORECASE)
    if err_match and int(err_match.group(1)) > 0:
        return make_resp('error', [f'Falha no Backup ({err_match.group(1)} erros)'])

    if any(k in lc for k in ['sucesso', 'success', 'concluído', 'finished']):
        return make_resp('ok', ['Operação finalizada com sucesso'])

    return make_resp('ok', ['Ativo / Em curso'])

def get_log_display_info(prefix, dir_name):
    category = "Nuvem"
    clean_name = prefix
    
    if dir_name == "local_backup_logs":
        category = "Local"
        clean_name = "Backup Local (NAS/WD)"
    elif dir_name == "vm_backup_logs":
        category = "VM"
        clean_name = "Backup de VMs (Kopia)"
    elif dir_name == "samba_manager":
        category = "Samba"
        if 'access_map' in prefix:
            clean_name = "Samba - Mapa de Acesso"
        elif 'apply' in prefix:
            clean_name = "Samba - Aplicar Permissões"
        elif 'get_acl' in prefix:
            clean_name = "Samba - Leitura de ACLs"
        elif 'list_groups' in prefix:
            clean_name = "Samba - Listar Grupos AD"
        elif 'list_shares' in prefix:
            clean_name = "Samba - Listar Shares"
        elif 'list_users' in prefix:
            clean_name = "Samba - Listar Usuários AD"
        else:
            clean_name = f"Samba - {prefix.replace('samba_', '').upper()}"
    else:
        # Nuvem backups
        target = prefix.replace('backup_', '')
        clean_name = f"Backup Nuvem - {target.upper()}"
        
    return clean_name, category

def get_script_summaries(log_root):
    summaries = {}
    if not os.path.exists(log_root): return {}
        
    for name in sorted(os.listdir(log_root)):
        sub = os.path.join(log_root, name)
        if not os.path.isdir(sub): continue
        
        job_files = {}
        for root, dirs, files in os.walk(sub):
            for f in files:
                if f.endswith('.log'):
                    fp = os.path.join(root, f)
                    
                    # Extract unique prefix
                    date_match = re.search(r'_(?P<date>\d{4}-\d{2}-\d{2})\.log$', f)
                    if date_match:
                        prefix = f[:date_match.start()]
                    else:
                        prefix = f[:-4]
                    
                    # Skip noise / aggregate logs
                    if prefix in ['daily_summary', 'master_sync', 'nohup_20260518_132537', 'cron_friday']:
                        continue
                        
                    try:
                        mtime = os.stat(fp).st_mtime
                        if prefix not in job_files or mtime > job_files[prefix]['mtime']:
                            job_files[prefix] = {'fp': fp, 'mtime': mtime}
                    except: continue
                    
        for prefix, info in job_files.items():
            fp = info['fp']
            mtime = info['mtime']
            try:
                raw = tail_file(fp, lines=1000)
                display_name, category = get_log_display_info(prefix, name)
                
                key = f"{name}:{prefix}"
                summaries[key] = summarize_log(raw, display_name, fp, mtime)
                summaries[key]['category'] = category
                summaries[key]['raw_prefix'] = prefix
            except Exception as e:
                print(f"Error parsing job {prefix}: {e}")
                
    return summaries
