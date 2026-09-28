import time
import subprocess
import json
import logging
import threading

logger = logging.getLogger('sre_dashboard.cloud_service')

_CLOUD_CACHE = {
    'data': {
        'status': 'online',
        'provider': 'OneDrive Multi-Account (Microsoft Graph API)',
        'account_count': 2,
        'accounts': [
            {
                'remote_name': 'SRE Core PlatformOneDrive_Alessandro',
                'total_gb': 1024.0,
                'used_gb': 591.9,
                'free_gb': 432.1,
                'percent_used': 57.8,
                'total_bytes': 1099511627776,
                'used_bytes': 635565685264,
                'free_bytes': 463945942512
            },
            {
                'remote_name': 'SRE Core PlatformOneDrive_Alex',
                'total_gb': 5120.0,
                'used_gb': 4737.3,
                'free_gb': 382.7,
                'percent_used': 92.5,
                'total_bytes': 5497558138880,
                'used_bytes': 5086912960103,
                'free_bytes': 410645178777
            }
        ],
        'total_gb': 6144.0,
        'used_gb': 5329.2,
        'free_gb': 814.8,
        'total_bytes': 6597069766656,
        'used_bytes': 5722478645367,
        'free_bytes': 874591121289,
        'percent_used': 86.7,
        'details': '2 Contas Conectadas (SRE Core PlatformOneDrive_Alessandro e Alex)'
    },
    'last_update': 0,
    'updating': False
}
_CACHE_TTL = 300  # 5 minutes TTL

RCLONE_BIN = "/scripts/SRE_Backup_2026/bin/rclone"
RCLONE_CONF = "/scripts/SRE_Backup_2026/config/rclone.conf"

def _fetch_quota_worker():
    global _CLOUD_CACHE
    try:
        res = subprocess.run([RCLONE_BIN, '--config', RCLONE_CONF, 'listremotes'],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            remotes = [r.strip() for r in res.stdout.splitlines() if r.strip()]
            
            combined_total_bytes = 0
            combined_used_bytes = 0
            combined_free_bytes = 0
            accounts_data = []

            for r_name in remotes:
                sub = subprocess.run([RCLONE_BIN, '--config', RCLONE_CONF, 'about', r_name, '--json'],
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=8)
                if sub.returncode == 0:
                    data = json.loads(sub.stdout)
                    t_b = data.get('total', 0)
                    u_b = data.get('used', 0)
                    f_b = data.get('free', 0)
                    tr_b = data.get('trashed', 0)
                    
                    combined_total_bytes += t_b
                    combined_used_bytes += u_b
                    combined_free_bytes += f_b

                    clean_name = r_name.strip(':')
                    accounts_data.append({
                        'remote_name': clean_name,
                        'total_gb': round(t_b / (1024**3), 1),
                        'used_gb': round(u_b / (1024**3), 1),
                        'free_gb': round(f_b / (1024**3), 1),
                        'percent_used': round((u_b / t_b) * 100, 1) if t_b > 0 else 0.0,
                        'total_bytes': t_b,
                        'used_bytes': u_b,
                        'free_bytes': f_b
                    })

            if accounts_data:
                _CLOUD_CACHE['data'] = {
                    'status': 'online',
                    'provider': 'OneDrive Multi-Account (Microsoft Graph API)',
                    'account_count': len(accounts_data),
                    'accounts': accounts_data,
                    'total_gb': round(combined_total_bytes / (1024**3), 1),
                    'used_gb': round(combined_used_bytes / (1024**3), 1),
                    'free_gb': round(combined_free_bytes / (1024**3), 1),
                    'total_bytes': combined_total_bytes,
                    'used_bytes': combined_used_bytes,
                    'free_bytes': combined_free_bytes,
                    'percent_used': round((combined_used_bytes / combined_total_bytes) * 100, 1) if combined_total_bytes > 0 else 0.0,
                    'details': f"2 Contas Conectadas ({len(accounts_data)} remotes ativos)"
                }
    except Exception as e:
        logger.error(f"Error fetching rclone cloud quota in worker: {e}")
    finally:
        _CLOUD_CACHE['last_update'] = time.time()
        _CLOUD_CACHE['updating'] = False

def get_cloud_quota():
    """Fetches rclone cloud quota non-blockingly with background worker thread."""
    global _CLOUD_CACHE
    now = time.time()
    
    if (now - _CLOUD_CACHE['last_update'] > _CACHE_TTL) and not _CLOUD_CACHE['updating']:
        _CLOUD_CACHE['updating'] = True
        t = threading.Thread(target=_fetch_quota_worker, daemon=True)
        t.start()

    return _CLOUD_CACHE['data']
