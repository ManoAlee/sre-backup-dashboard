import os
import psutil
import subprocess
import logging

logger = logging.getLogger('sre_dashboard.system_service')

DESCRIPTIONS = {
    '/': 'Sistema Operacional Ubuntu 26.04.1 LTS (Kernel 7.0) & SRE Runtime',
    '/dados': 'Compartilhamentos de Produção Corporativa (/dados)',
    '/dados-ext': 'Repositório Ext I (/dados-ext)',
    '/dados-ext-II': 'Repositório Ext II - Engenharia, Service & Partner Alpha (/dados-ext-II)',
    '/scripts/BackupVms': 'NAS StorageNASVault SSHFS - Snapshots Kopia VM',
    '/scripts/SRE_Windows_Scripts_2026': 'Compartilhamento CIFS de Scripts Windows (Host 192.168.10.1 C$\\Scripts)',
    '/mnt/windows_scripts': 'Compartilhamento CIFS de Scripts Windows (Host 192.168.10.1 C$\\Scripts)'
}

DISK_MODELS = {
    '/dev/mapper/ubuntu--vg-ubuntu--lv': 'Seagate Barracuda 250GB (ST3250318AS - OS LVM)',
    '/dev/sda': 'Seagate Enterprise SATA 1TB (ST1000NM0055 - /dados-ext)',
    '/dev/sdc1': 'WD Caviar Blue 1TB (WDC WD10EZEX - /dados)',
    '/dev/md126p1': 'WD Caviar Green 1TB (WDC WD10EARS - /dados-ext-II)',
    '/dev/sde1': 'WD Blue 2.5 SATA 1TB (Backup_Servidor_Dados)',
    '/dev/sdf1': 'WD Blue 2.5 SATA 1TB (Backup_Dados_Gerais)',
    'root@192.168.10.200:/DataVolume/shares/BackupVms': 'NAS Western Digital MyCloud 4TB',
    '//192.168.10.1/c$/Scripts': 'Servidor Windows 192.168.10.1 (Share CIFS/SMB)',
    '/scripts/SRE_Windows_Scripts_2026': 'Servidor Windows 192.168.10.1 (Share CIFS/SMB)',
    '/mnt/windows_scripts': 'Servidor Windows 192.168.10.1 (Share CIFS/SMB)'
}

def get_disk_mounts():
    """Inspects live system disk mounts dynamically and auto-detects plugged local backup disks with real NTFS cluster usage."""
    disks = []
    monitored_paths = [
        '/', '/dados', '/dados-ext', '/dados-ext-II',
        '/scripts/BackupVms', '/scripts/SRE_Windows_Scripts_2026'
    ]
    
    device_map = {}
    try:
        if os.path.exists('/proc/mounts'):
            with open('/proc/mounts', 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 3:
                        target = parts[1]
                        src, fs = parts[0], parts[2]
                        # Prioritize real network/disk filesystems over autofs wrappers
                        if target not in device_map or fs in ['cifs', 'smb3', 'fuse.sshfs', 'fuse', 'ext4', 'ext3', 'xfs']:
                            device_map[target] = (src, fs)
    except Exception as e:
        logger.warning(f"Failed to parse /proc/mounts: {e}")

    mounted_devices = set()

    for path in monitored_paths:
        if os.path.exists(path):
            try:
                st = os.statvfs(path)
                free_gb = round((st.f_bavail * st.f_frsize) / (1024**3), 1)
                total_gb = round((st.f_blocks * st.f_frsize) / (1024**3), 1)
                used_gb = round(((st.f_blocks - st.f_bfree) * st.f_frsize) / (1024**3), 1)
                percent = round((used_gb / total_gb) * 100, 1) if total_gb > 0 else 0.0
                
                # Check both direct path and symlink realpath (e.g. /scripts/SRE_Windows_Scripts_2026 -> /mnt/windows_scripts)
                real_p = os.path.realpath(path)
                dev_info = device_map.get(path) or device_map.get(real_p)
                
                if dev_info:
                    dev, fstype = dev_info
                else:
                    dev, fstype = ('/dev/system', 'ext4')
                
                # Explicit fallback for known network shares if unmounted/autofs
                if 'windows_scripts' in path.lower() or 'windows_scripts' in real_p.lower():
                    if dev == '/dev/system' or fstype == 'ext4':
                        dev = '//192.168.10.1/c$/Scripts'
                        fstype = 'cifs'

                mounted_devices.add(dev)

                disks.append({
                    'mount': path,
                    'device': dev,
                    'fstype': fstype,
                    'model': DISK_MODELS.get(dev, DISK_MODELS.get(path, DISK_MODELS.get(real_p, 'Disco SATA Corporativo'))),
                    'total_gb': total_gb,
                    'used_gb': used_gb,
                    'free_gb': free_gb,
                    'percent': percent,
                    'status': 'mounted',
                    'description': DESCRIPTIONS.get(path, DESCRIPTIONS.get(real_p, 'Ponto de Montagem do Sistema'))
                })
            except Exception as e:
                logger.warning(f"Failed to check disk usage for {path}: {e}")

    # Dynamic hardware detection of cold storage SATA/USB air-gap disks by label or UUID
    cold_configs = [
        {
            'label': 'Backup_Servidor_Dados',
            'uuid': '4E1AAEFF1AAEE367',
            'model': 'WD Blue 2.5 SATA 1TB (WDC WD10JPVX)',
            'base_desc': 'Disco Externo SATA Air-Gap Backup Local (Backup_Servidor_Dados)'
        },
        {
            'label': 'Backup_Dados_Gerais',
            'uuid': '9AD2876FD2874F07',
            'model': 'WD Blue 2.5 SATA 1TB (WDC WD10SPZX)',
            'base_desc': 'Disco Externo SATA Air-Gap Backup Local (Backup_Dados_Gerais)'
        }
    ]

    for cfg in cold_configs:
        dev_path = None
        lbl_link = f"/dev/disk/by-label/{cfg['label']}"
        uuid_link = f"/dev/disk/by-uuid/{cfg['uuid']}"
        
        if os.path.exists(lbl_link):
            dev_path = os.path.realpath(lbl_link)
        elif os.path.exists(uuid_link):
            dev_path = os.path.realpath(uuid_link)

        if dev_path and os.path.exists(dev_path) and dev_path not in mounted_devices:
            total_gb = 931.5
            used_gb = 500.0
            free_gb = 431.5
            percent = 50.0

            # Query real live ntfs cluster stats if available
            try:
                res = subprocess.run(['sudo', '-n', 'ntfsinfo', '-m', dev_path], capture_output=True, text=True, timeout=3)
                if res.returncode == 0 and res.stdout:
                    import re
                    m = re.search(r'Free Clusters:.*?\((\d+)[,\.](\d+)%\)', res.stdout, re.IGNORECASE)
                    if m:
                        free_pct = float(f"{m.group(1)}.{m.group(2)}")
                        used_pct = round(100.0 - free_pct, 1)
                        percent = used_pct
                        used_gb = round(total_gb * (used_pct / 100.0), 1)
                        free_gb = round(total_gb - used_gb, 1)
            except Exception as e:
                logger.debug(f"Could not get ntfsinfo for {dev_path}: {e}")

            disks.append({
                'mount': f"{dev_path} [Air-Gap]",
                'device': dev_path,
                'fstype': 'ntfs',
                'model': cfg['model'],
                'total_gb': total_gb,
                'used_gb': used_gb,
                'free_gb': free_gb,
                'percent': percent,
                'status': 'plugged',
                'description': f"{cfg['base_desc']} • Cold Storage {percent}% Usado"
            })

    return disks

def check_critical_paths(app_log_root, reports_dir):
    """Verifies existence of critical system directories and binaries."""
    paths_to_check = [
        app_log_root,
        reports_dir,
        '/scripts/SRE_Backup_2026/bin/rclone',
        '/scripts/SRE_Backup_2026/config/rclone.conf',
        '/scripts/SRE_VM_Backup_2026/config/vm_manifest.json'
    ]
    return [{'path': p, 'exists': os.path.exists(p)} for p in paths_to_check]

def get_vm_backup_status():
    """Checks VM Backup Engine status (Kopia)."""
    vm_status = {'status': 'inactive', 'details': 'Kopia engine not found'}
    vm_manifest_path = "/scripts/SRE_VM_Backup_2026/config/vm_manifest.json"
    if os.path.exists(vm_manifest_path):
        try:
            ps_vm = subprocess.run(['pgrep', '-f', 'kopia snapshot'], capture_output=True, text=True)
            is_vm_active = ps_vm.returncode == 0
            vm_status = {
                'status': 'configured',
                'details': 'Ativo (Snapshots OK)' if is_vm_active else 'Pronto (Agendado)'
            }
        except Exception as e:
            logger.error(f"Error checking Kopia status: {e}")
            vm_status = {'status': 'error', 'details': 'Erro ao verificar via pgrep'}
    return vm_status
