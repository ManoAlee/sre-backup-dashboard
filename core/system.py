import subprocess
import os
import threading
import time
import re
import json

# --- Cache ---
SYSTEM_CACHE = {
    'realtime': {'os': 'Debian 13', 'ports': []},
    'schedules': [],
    'rclone': []
}
CACHE_LOCK = threading.Lock()

# Senior Port Database
PORT_DB = {
    '22': {'service': 'SSH', 'desc': 'Acesso Remoto Seguro (OpenSSH)'},
    '53': {'service': 'DNS', 'desc': 'Resolução de Nomes (Bind/Unbound)'},
    '80': {'service': 'HTTP', 'desc': 'Tráfego Web não criptografado'},
    '443': {'service': 'HTTPS', 'desc': 'Tráfego Web Seguro (TLS)'},
    '137': {'service': 'NetBIOS-NS', 'desc': 'Samba Name Service'},
    '138': {'service': 'NetBIOS-DGM', 'desc': 'Samba Datagram Service'},
    '139': {'service': 'NetBIOS-SSN', 'desc': 'Samba Session Service'},
    '445': {'service': 'Microsoft-DS', 'desc': 'SMB/CIFS (File Sharing & AD)'},
    '631': {'service': 'CUPS', 'desc': 'Sistema de Impressão (Internet Printing Protocol)'},
    '1716': {'service': 'KDE Connect', 'desc': 'Sincronização de Dispositivos'},
    '5353': {'service': 'mDNS/Zeroconf', 'desc': 'Local Service Discovery (Avahi)'},
    '323': {'service': 'chrony/NTP', 'desc': 'Sincronização de Tempo de Alta Precisão'},
    '7001': {'service': 'SRE Dashboard', 'desc': 'Interface de Gestão SRE Sentinel'},
    '111': {'service': 'RPCBind', 'desc': 'Mapeador de Portas RPC (Conversão de programas RPC em portas TCP/UDP)'},
    '9222': {'service': 'Remote Debugging / SSH', 'desc': 'Porta de Depuração Remota de Navegador ou sessões de encapsulamento active'},
    '2049': {'service': 'NFS', 'desc': 'Network File System'},
    '3000': {'service': 'Gitea', 'desc': 'Self-hosted Git Service'},
    '5432': {'service': 'PostgreSQL', 'desc': 'Base de Dados Relacional'},
    '6379': {'service': 'Redis', 'desc': 'Cache In-Memory Store'}
}

def parse_ss_users(users_str):
    """Extract process name from ss users field."""
    if not users_str: return "System"
    match = re.search(r'\(\("([^"]+)"', users_str)
    return match.group(1) if match else "System"

def system_background_collector():
    while True:
        try:
            # 1. OS, CPU, RAM & Ports
            realtime = {'os': 'Linux', 'ports': []}
            try:
                import psutil
                mem = psutil.virtual_memory()
                realtime['cpu_percent'] = round(psutil.cpu_percent(interval=0.5), 1)
                realtime['cpu_count'] = psutil.cpu_count(logical=True)
                realtime['memory_percent'] = round(mem.percent, 1)
                realtime['memory_used_gb'] = round(mem.used / (1024**3), 1)
                realtime['memory_total_gb'] = round(mem.total / (1024**3), 1)
                realtime['uptime_seconds'] = int(time.time() - psutil.boot_time())
            except Exception as e:
                print("Error fetching psutil stats:", e)

            try:
                with open('/etc/os-release') as f:
                    for line in f:
                        if 'PRETTY_NAME=' in line:
                            realtime['os'] = line.split('=')[1].strip('" \n')
            except: pass

            import platform
            realtime['kernel'] = platform.release()
            realtime['ip'] = '192.168.10.9'

            try:
                if os.path.exists('/sys/class/dmi/id/product_name'):
                    with open('/sys/class/dmi/id/product_name') as f:
                        pname = f.read().strip()
                        if pname:
                            realtime['hardware'] = f"Lenovo {pname}"
                if 'hardware' not in realtime:
                    realtime['hardware'] = "Lenovo ThinkServer TS150"
            except:
                realtime['hardware'] = "Lenovo ThinkServer TS150"

            try:
                # Senior: Use 'ss' with process info (-p)
                cmd = ['sudo', 'ss', '-tulnpH']
                out = subprocess.check_output(cmd, text=True, timeout=10)
                seen_ports = set()
                for line in out.splitlines():
                    parts = line.split()
                    if len(parts) >= 6:
                        proto = parts[0].upper()
                        local = parts[4]
                        users = parts[6] if len(parts) > 6 else ""
                        
                        if ':' in local:
                            port = local.split(':')[-1]
                            key = f"{proto}:{port}"
                            if key in seen_ports: continue
                            seen_ports.add(key)
                            
                            proc = parse_ss_users(users)
                            info = PORT_DB.get(port)
                            if not info:
                                # Fallback to process-based matching for dynamic/ephemeral ports
                                proc_lower = proc.lower()
                                if 'rpc.statd' in proc_lower:
                                    info = {
                                        'service': 'RPC Statd (NFS)',
                                        'desc': 'Monitor de Status de Rede (NSM) para o protocolo NFS (bloqueio de arquivos).'
                                    }
                                elif 'kdeconnectd' in proc_lower:
                                    info = {
                                        'service': 'KDE Connect Sync',
                                        'desc': 'Porta dinâmica do KDE Connect para sincronização e transferência de arquivos.'
                                    }
                                elif 'language_server' in proc_lower:
                                    info = {
                                        'service': 'Language Server (LSP)',
                                        'desc': 'Porta de comunicação local de suporte a analisadores de linguagem da IDE.'
                                    }
                                elif 'avahi-daemon' in proc_lower:
                                    info = {
                                        'service': 'Avahi Daemon',
                                        'desc': 'Descoberta de rede local Multicast DNS (mDNS) e Zeroconf.'
                                    }
                                elif 'cupsd' in proc_lower:
                                    info = {
                                        'service': 'CUPS Printer Server',
                                        'desc': 'Gerenciador de tarefas de impressão e compartilhamento de impressoras.'
                                    }
                                elif 'node' in proc_lower:
                                    info = {
                                        'service': 'Node.js Service',
                                        'desc': 'Aplicação web ou processo em execução no ambiente runtime Node.js.'
                                    }
                                elif 'rpcbind' in proc_lower:
                                    info = {
                                        'service': 'RPCBind Service',
                                        'desc': 'Mapeador de endereços RPC para serviços locais (ex: NFS).'
                                    }
                                elif 'sshd' in proc_lower or 'ssh' in proc_lower:
                                    info = {
                                        'service': 'SSH Session Tunneling',
                                        'desc': 'Conexão ativa ou encaminhamento de portas do protocolo SSH.'
                                    }
                                elif 'gunicorn' in proc_lower or 'python' in proc_lower:
                                    info = {
                                        'service': 'Python / Gunicorn Server',
                                        'desc': 'Servidor de aplicação python ou interface de API ativa.'
                                    }
                                else:
                                    info = {
                                        'service': 'Custom App',
                                        'desc': 'Porta de rede ativa em uso por um processo do sistema.'
                                    }
                            
                            realtime['ports'].append({
                                'proto': proto, 'port': port, 'service': info['service'], 
                                'desc': info['desc'], 'process': proc, 'bind': local
                            })
            except: pass

            # 2. Schedules (Timers & Cron Jobs)
            schedules = []
            TIMER_DB = {
                'sre-daily-report': {
                    'desc': 'Geração de relatório diário de resiliência e integridade do backup SRE.',
                    'time_desc': 'Diariamente às 07:00'
                },
                'logrotate': {
                    'desc': 'Rotatividade automática de arquivos de logs para prevenir esgotamento de disco.',
                    'time_desc': 'Diariamente às 00:35'
                },
                'fstrim': {
                    'desc': 'Liberação de blocos não utilizados em discos SSD/NVMe (trimming periódico).',
                    'time_desc': 'Semanalmente às segundas-feiras'
                },
                'e2scrub_all': {
                    'desc': 'Verificação de integridade offline e online de metadados do sistema de arquivos.',
                    'time_desc': 'Semanalmente aos domingos'
                },
                'man-db': {
                    'desc': 'Otimização e indexação de banco de dados do comando man (manuais locais).',
                    'time_desc': 'Diariamente'
                },
                'anacron': {
                    'desc': 'Verificação de execução de tarefas atrasadas após inicialização do sistema.',
                    'time_desc': 'Periódico'
                },
                'fwupd-refresh': {
                    'desc': 'Sincronização e verificação de novas atualizações de firmware do hardware.',
                    'time_desc': 'A cada 24 horas'
                }
            }
            try:
                res = subprocess.run(['systemctl', 'list-timers', '--all', '--no-pager'], stdout=subprocess.PIPE, text=True, timeout=5)
                for line in res.stdout.splitlines()[1:]:
                    parts = line.split()
                    if len(parts) < 6: continue
                    unit = next((p for p in parts if p.endswith('.timer')), None)
                    if not unit or any(x in unit for x in ['systemd', 'apt', 'dpkg']): continue
                    
                    timer_name = unit.replace('.timer', '')
                    info = TIMER_DB.get(timer_name, {
                        'desc': 'Tarefa periódica do sistema operacional.',
                        'time_desc': 'Definido pelo timer'
                    })
                    
                    schedules.append({
                        'name': timer_name, 
                        'next': f"{parts[0]} {parts[1]}" if parts[0] != '-' else info['time_desc'], 
                        'left': f"{parts[2]} {parts[3]}" if parts[2] != '-' else 'Inativo', 
                        'last': f"{parts[4]} {parts[5]}" if len(parts) > 5 and parts[4] != '-' else "N/A",
                        'desc': info['desc'],
                        'type': 'systemd'
                    })
            except Exception as e:
                print("Error parsing systemd timers:", e)

            # Add Cron Jobs from root crontab
            try:
                res_cron = subprocess.run(['sudo', 'crontab', '-l'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                if res_cron.returncode == 0:
                    for line in res_cron.stdout.splitlines():
                        line = line.strip()
                        if not line or line.startswith('#'): continue
                        parts = line.split(None, 5)
                        if len(parts) < 6: continue
                        expr = " ".join(parts[:5])
                        cmd = parts[5]
                        
                        name = ""
                        desc = ""
                        time_desc = ""
                        
                        if 'sre_local_engine.py' in cmd:
                            name = "backup-local-nas"
                            desc = "Backup local redundante dos dados dos usuários no disco externo / StorageNASVault."
                            time_desc = "Sextas-feiras às 18:00"
                        elif 'sre_vm_engine.py' in cmd:
                            name = "backup-vm-kopia"
                            desc = "Backup completo e incremental das Máquinas Virtuais (VMs) via Kopia."
                            time_desc = "Diariamente às 23:00"
                        elif 'run_all_cloud_backups.sh' in cmd:
                            name = "sync-nuvem-rclone"
                            desc = "Sincronização em nuvem secundária de segurança (OneDrive / Google Drive) via Rclone."
                            if '1-4' in expr:
                                time_desc = "Segunda a Quinta às 18:00"
                            else:
                                time_desc = "Sábados e Domingos às 06:00"
                        else:
                            name = os.path.basename(cmd.split()[0])
                            desc = f"Comando personalizado: {cmd[:50]}..."
                            time_desc = f"Frequência cron: {expr}"
                        
                        schedules.append({
                            'name': name,
                            'next': time_desc,
                            'left': 'Executando via Cron',
                            'last': 'Ver logs em /var/log/cron',
                            'desc': desc,
                            'type': 'cron'
                        })
            except Exception as e:
                print("Error parsing crontab:", e)

            # 3. Rclone (Deep Info)
            rclone_data = []
            RCLONE_BIN = "/scripts/SRE_Backup_2026/bin/rclone"
            RCLONE_CONF = "/scripts/SRE_Backup_2026/config/rclone.conf"
            try:
                res = subprocess.run([RCLONE_BIN, '--config', RCLONE_CONF, 'listremotes'], stdout=subprocess.PIPE, text=True, timeout=5)
                remotes = [r.strip() for r in res.stdout.splitlines() if r.strip()]
                for r in remotes:
                    usage = "N/A"
                    try:
                        # Use about for usage info
                        sub = subprocess.run([RCLONE_BIN, '--config', RCLONE_CONF, 'about', r, '--json'], stdout=subprocess.PIPE, text=True, timeout=15)
                        if sub.returncode == 0:
                            data = json.loads(sub.stdout)
                            used = data.get('used', 0) / (1024**3)
                            total = data.get('total', 0) / (1024**3)
                            if total > 0:
                                pct = (used / total) * 100
                                usage = f"{used:.1f}GB / {total:.1f}GB ({pct:.1f}%)"
                            else:
                                usage = f"{used:.1f}GB usado"
                    except: pass
                    
                    rclone_data.append({
                        'name': r.strip(':'), 
                        'status': 'ok' if usage != "N/A" else 'warning',
                        'usage': usage,
                        'msg': 'Conexão Ativa' if usage != "N/A" else 'Sem resposta de quota'
                    })
            except: pass

            with CACHE_LOCK:
                SYSTEM_CACHE['realtime'] = realtime
                SYSTEM_CACHE['schedules'] = schedules
                SYSTEM_CACHE['rclone'] = rclone_data

        except Exception as e:
            print(f"Collector Error: {e}")
        
        time.sleep(20) # Faster refresh for Senior dashboard feel

def start_system_collector():
    t = threading.Thread(target=system_background_collector, daemon=True)
    t.start()

def get_system_realtime():
    with CACHE_LOCK: return SYSTEM_CACHE['realtime']

def get_schedules():
    with CACHE_LOCK: return SYSTEM_CACHE['schedules']

def check_rclone():
    with CACHE_LOCK: return SYSTEM_CACHE['rclone']
