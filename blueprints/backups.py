import os
import glob
import subprocess
import re
from flask import Blueprint, jsonify, current_app
from core.telemetry import get_backup_status
from core.sre_manager import get_active_jobs
from core.log_analyzer import get_script_summaries, tail_file

backups_bp = Blueprint('backups', __name__, url_prefix='/api')

@backups_bp.route('/backup/status')
def backup_status():
    return jsonify(get_backup_status())

@backups_bp.route('/scripts/status')
def api_scripts_status():
    app_log_root = current_app.config.get('APP_LOG_ROOT', '/scripts/logs')
    return jsonify(list(get_script_summaries(app_log_root).values()))

@backups_bp.route('/jobs/active')
def active_jobs():
    return jsonify(get_active_jobs())

@backups_bp.route('/revalidate', methods=['POST'])
def api_revalidate():
    """Triggers background re-validation of backup environments."""
    try:
        subprocess.Popen(['/bin/bash', '/scripts/SRE_Backup_2026/bin/run_validation.sh'])
        return jsonify({'success': True, 'message': 'Re-validação iniciada com sucesso.'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@backups_bp.route('/job_log/<job_id>')
def api_job_log(job_id):
    """Returns authentic, audit-grade log for a given backup job."""
    clean_id = job_id.replace('vol_', '').replace('job_', '').lower().strip()
    
    # 1. Specialized Handler for Totvs Datasul DB Dump (Progress ERP + SQL Server)
    if clean_id in ('datasul', 'totvs'):
        orch_dir = '/scripts/SRE_Windows_Scripts_2026/BackupOrchestrator/logs'
        cloud_dir = '/scripts/SRE_Backup_2026/logs'
        
        # Latest Orchestrator Log
        orch_files = sorted(glob.glob(os.path.join(orch_dir, 'orchestrator_*.log')), key=os.path.getmtime) if os.path.isdir(orch_dir) else []
        latest_orch = orch_files[-1] if orch_files else None
        
        # Latest Robocopy Log
        robo_files = sorted(glob.glob(os.path.join(orch_dir, 'robocopy_totvs_*.log')), key=os.path.getmtime) if os.path.isdir(orch_dir) else []
        latest_robo = robo_files[-1] if robo_files else None
        
        # Physical Repository Status (/dados/backup/Backup_Totvs)
        totvs_repo = '/dados/backup/Backup_Totvs'
        latest_folder = 'N/A'
        file_count = 0
        total_size_mb = 0
        if os.path.isdir(totvs_repo):
            folders = sorted([d for d in os.listdir(totvs_repo) if d.startswith('ON_BACKUP_')])
            if folders:
                latest_folder = folders[-1]
                fpath = os.path.join(totvs_repo, latest_folder)
                try:
                    for item in os.listdir(fpath):
                        full_item = os.path.join(fpath, item)
                        if os.path.isfile(full_item):
                            file_count += 1
                            total_size_mb += os.path.getsize(full_item) / (1024 * 1024)
                        elif os.path.isdir(full_item):
                            for sub in os.listdir(full_item):
                                file_count += 1
                                total_size_mb += os.path.getsize(os.path.join(full_item, sub)) / (1024 * 1024)
                except Exception:
                    pass
        
        orch_tail = tail_file(latest_orch, lines=120) if latest_orch else "Log do orquestrador não localizado."
        robo_tail = tail_file(latest_robo, lines=100) if latest_robo else "Log do robocopy não localizado."
        
        log_header = (
            "====================================================================================================\n"
            " 🛡️ AUDITORIA SRE & OBSERVABILIDADE: TOTVS DATASUL ERP & SQL SERVER PIPELINE\n"
            "====================================================================================================\n"
            "• Pipeline SRE: Windows Backup Orchestrator + Robocopy Mirror (192.168.10.2 -> 192.168.10.9) + M365 Cloud Sync\n"
            "• Servidores de Origem: 192.168.10.2 (TOTVS ERP Progress OpenEdge) & APP-INGRESS-01 (SQL Server TAF/TSS)\n"
            f"• Repositório Local NAS: /dados/backup/Backup_Totvs/{latest_folder} ({file_count} arquivos, {total_size_mb / 1024:.2f} GB)\n"
            "• Repositório SQL Server: /dados/backup/Backup_SQL_Server (TAF & TSS .bak)\n"
            "• Destino Cloud: SRE Core PlatformOneDrive_Alex:Documents/SRE Core Platform & SRE Core PlatformOneDrive_Alessandro:dados/backup\n"
            "• Status da Retenção: Mantendo rigorosamente os 7 backups diários mais recentes (Purga Ativa)\n"
            "====================================================================================================\n\n"
        )
        
        combined_content = (
            log_header +
            f"--- [PARTE 1: TELEMETRIA DE TRANSMISSÃO ROBOCOPY ({os.path.basename(latest_robo) if latest_robo else 'N/A'})] ---\n"
            f"Caminho: {latest_robo}\n\n" +
            robo_tail + "\n\n" +
            f"--- [PARTE 2: LOG DO ORQUESTRADOR MESTRE ({os.path.basename(latest_orch) if latest_orch else 'N/A'})] ---\n"
            f"Caminho: {latest_orch}\n\n" +
            orch_tail
        )
        
        primary_file = os.path.basename(latest_robo) if latest_robo else (os.path.basename(latest_orch) if latest_orch else 'robocopy_totvs.log')
        return jsonify({
            'job_id': job_id,
            'file': primary_file,
            'path': latest_robo or latest_orch or '',
            'log_content': combined_content
        })

    # 2. Specialized search directories and patterns for specialized jobs
    search_map = {
        'kopia_vm': {
            'dirs': ['/scripts/SRE_VM_Backup_2026/logs', '/scripts/logs/vm_backup_logs'],
            'patterns': ['vm_backup_*.log', '*kopia*.log', 'cron_execution.log']
        },
        'vm': {
            'dirs': ['/scripts/SRE_VM_Backup_2026/logs', '/scripts/logs/vm_backup_logs'],
            'patterns': ['vm_backup_*.log', '*kopia*.log']
        },
        'local_offline_hd': {
            'dirs': ['/scripts/SRE_Local_Backup_2026/logs', '/scripts/logs/local_backup_logs'],
            'patterns': ['local_backup_*.log*', 'cron_friday.log*']
        }
    }
    
    matching = []
    
    if clean_id in search_map:
        conf = search_map[clean_id]
        for log_dir in conf['dirs']:
            if os.path.isdir(log_dir):
                for pat in conf['patterns']:
                    for f in glob.glob(os.path.join(log_dir, pat)):
                        if os.path.isfile(f) and not f.endswith('.gz') and f not in matching:
                            matching.append(f)
    elif clean_id == 'backup':
        # Volume /dados/backup is specifically named backup_backup_*.log
        search_dirs = [
            '/scripts/SRE_Backup_2026/logs',
            '/scripts/logs/backup_logs',
            '/scripts/logs'
        ]
        for log_dir in search_dirs:
            if os.path.isdir(log_dir):
                for pat in ['backup_backup_*.log', 'backup_backup.log']:
                    for f in glob.glob(os.path.join(log_dir, pat)):
                        if os.path.isfile(f) and not f.endswith('.gz') and f not in matching:
                            matching.append(f)
    else:
        # Standard volume: e.g. comex, ti, partner_alpha, financeiro, vendas, publico
        search_dirs = [
            '/scripts/SRE_Backup_2026/logs',
            '/scripts/logs/backup_logs',
            '/scripts/logs'
        ]
        
        # Priority patterns: exact volume prefix to avoid collisions (e.g. 'vendas' vs 'vendas-service')
        priority_patterns = [
            f'backup_{clean_id}_*.log',
            f'backup_{clean_id}.log'
        ]
        
        for log_dir in search_dirs:
            if os.path.isdir(log_dir):
                for pat in priority_patterns:
                    for f in glob.glob(os.path.join(log_dir, pat)):
                        if os.path.isfile(f) and not f.endswith('.gz') and f not in matching:
                            matching.append(f)
                            
        # If still nothing matched, try strictly word-bounded pattern
        if not matching:
            for log_dir in search_dirs:
                if os.path.isdir(log_dir):
                    for pat in [f'*{clean_id}*.log']:
                        for f in glob.glob(os.path.join(log_dir, pat)):
                            bname = os.path.basename(f)
                            if re.search(r'(^|[_.-])' + re.escape(clean_id) + r'([_.-]|$)', bname, re.I):
                                if os.path.isfile(f) and not f.endswith('.gz') and f not in matching:
                                    matching.append(f)

    if not matching:
        return jsonify({
            'job_id': job_id,
            'file': 'master_sync.log (Referência Global)',
            'log_content': f"[SRE OBSERVABILITY] Nenhum arquivo individual encontrado especificamente para '{job_id}'.\n"
                           f"A rotina opera sob o ciclo consolidado da Microsoft Graph API / Lazarus Guard.\n"
                           f"Consulte o arquivo mestre: /scripts/SRE_Backup_2026/logs/master_sync.log para telemetria agregada."
        })

    latest_file = max(matching, key=os.path.getmtime)
    if os.path.getsize(latest_file) < 100 and os.path.exists(f"{latest_file}.1"):
        latest_file = f"{latest_file}.1"
    content = tail_file(latest_file, lines=150)
    
    return jsonify({
        'job_id': job_id,
        'file': os.path.basename(latest_file),
        'path': latest_file,
        'log_content': f"=== REGISTRO DE AUDITORIA SRE: {os.path.basename(latest_file)} ===\n=== CAMINHO COMPLETO: {latest_file} ===\n\n" + content
    })

