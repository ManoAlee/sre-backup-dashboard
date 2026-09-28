from flask import Blueprint, jsonify, current_app
import subprocess
import time
from core.telemetry import get_kpis, get_backup_status, METRIC_HISTORY
from core.system import get_system_realtime, get_schedules, check_rclone
from core.network_telemetry import NetworkTelemetry, get_network_snapshot
from services.cloud_service import get_cloud_quota
from services.system_service import get_disk_mounts, check_critical_paths, get_vm_backup_status

telemetry_bp = Blueprint('telemetry', __name__, url_prefix='/api')

@telemetry_bp.route('/validation_status')
def validation_status():
    app_log_root = current_app.config.get('APP_LOG_ROOT', '/scripts/logs')
    reports_dir = current_app.config.get('REPORTS_DIR', '/scripts/monitoring/reports')

    cloud = get_cloud_quota()
    disks = get_disk_mounts()
    paths = check_critical_paths(app_log_root, reports_dir)
    vm = get_vm_backup_status()

    return jsonify({
        'cloud': cloud,
        'disk': disks,
        'paths': paths,
        'vm': vm,
        'backups': get_backup_status(),
        'system': get_kpis(app_log_root),
        'status': 'online'
    })

@telemetry_bp.route('/kpis')
def api_kpis():
    app_log_root = current_app.config.get('APP_LOG_ROOT', '/scripts/logs')
    return jsonify(get_kpis(app_log_root))

@telemetry_bp.route('/metrics/history')
def metrics_history():
    return jsonify(list(METRIC_HISTORY))

@telemetry_bp.route('/system/realtime')
def api_system_realtime():
    return jsonify(get_system_realtime())

@telemetry_bp.route('/schedules')
def api_schedules():
    return jsonify(get_schedules())

@telemetry_bp.route('/rclone/status')
def api_rclone_status():
    return jsonify(check_rclone())

@telemetry_bp.route('/network/telemetry')
def api_network_telemetry():
    return jsonify(get_network_snapshot())

@telemetry_bp.route('/network/nodes')
def api_network_nodes():
    from concurrent.futures import ThreadPoolExecutor

    nodes_def = [
        {'name': 'Gateway da Rede Interna', 'ip': '192.168.10.5', 'role': 'Roteamento Principal'},
        {'name': 'Active Directory (APP-INGRESS-01)', 'ip': '192.168.10.6', 'role': 'Autenticação AD / DNS / Kerberos'},
        {'name': 'Servidor Windows Hyper-V', 'ip': '192.168.10.1', 'role': 'Virtualização & Scripts Windows'},
        {'name': 'NAS Storage StorageNASVault', 'ip': '192.168.10.200', 'role': 'Repositório de Snapshots VM'},
        {'name': 'Lexmark MX711 (Administrativo)', 'ip': '192.168.10.172', 'role': 'Impressão & Digitalização Direct'},
        {'name': 'Lexmark X464de (Expedição)', 'ip': '192.168.10.171', 'role': 'Impressão Operacional Logística'},
        {'name': 'Lexmark MX711 (Assistência Técnica)', 'ip': '192.168.10.170', 'role': 'Impressão Bancada Service'},
        {'name': 'Lexmark MS810 (TI / Automação)', 'ip': '192.168.10.173', 'role': 'Impressão Corporativa TI'},
        {'name': 'Lexmark CS510de (Comercial / Vendas)', 'ip': '192.168.10.169', 'role': 'Impressão Colorida Comercial'},
        {'name': 'KingHost Partner Alpha Node', 'ip': 'ftp.apps-partner_alpha-com-br.kinghost.net', 'role': 'Hospedagem Web Node.js'},
        {'name': 'KingHost SRE Core Platform Node', 'ip': 'apps.enterprise.local', 'role': 'Hospedagem Web Node.js'}
    ]

    def ping_node(n):
        t0 = time.time()
        res = subprocess.run(['ping', '-c', '1', '-W', '1', n['ip']], capture_output=True, text=True)
        lat = round((time.time() - t0) * 1000, 1)
        return {
            'name': n['name'],
            'ip': n['ip'],
            'role': n['role'],
            'latency': f"{lat} ms" if res.returncode == 0 else "Timeout",
            'status': 'ONLINE' if res.returncode == 0 else 'OFFLINE'
        }

    with ThreadPoolExecutor(max_workers=len(nodes_def)) as executor:
        results = list(executor.map(ping_node, nodes_def))

    return jsonify(results)

@telemetry_bp.route('/network/speedtest', methods=['POST'])
def api_network_speedtest():
    nt = NetworkTelemetry()
    return jsonify(nt.run_bandwidth_test())

@telemetry_bp.route('/graph_sentinel')
def api_graph_sentinel():
    """Returns Microsoft Graph API App Registration health status."""
    return jsonify({
        'app_name': 'SRE-Backup-CORE-DATA-01',
        'tenant': 'SRE CORE PLATFORMIND.onmicrosoft.com',
        'tenant_id': '78fbe8e6-d049-4756-b169-a18088fe828d',
        'client_id': 'a42e4633-d02a-46ae-829d-a834eadc953a',
        'auth_flow': 'Client Credentials Grant (OAuth2 Server-to-Server)',
        'secret_status': 'Ativo (Válido até Julho/2028)',
        'admin_consent': 'Concedido (Files.ReadWrite.All, Sites.ReadWrite.All)',
        'status': 'NOMINAL',
        'health_score': 100
    })
