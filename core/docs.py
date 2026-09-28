import os
import re
from datetime import datetime

DOC_SEARCH_PATHS = [
    ('/scripts/docs', 'Documentação Geral'),
    ('/scripts/SRE_Backup_2026/docs', 'Manuais SRE'),
    ('/scripts/docs/manuals_padroes', 'Manuais e Padrões'),
    ('/scripts/docs/incidentes', 'Incidentes e Chamados'),
    ('/scripts/docs/relatorios', 'Relatórios de Auditoria'),
    ('/scripts/docs/runbooks_resolucoes', 'Runbooks e Resoluções'),
    ('/scripts/docs/diarios', 'Diários de Bordo SRE'),
]

SCRIPT_DIRS = [
    '/scripts/SRE_Backup_2026/bin',
    '/scripts/SRE_Dashboard_2026/core',
    '/scripts/SRE_Dashboard_2026/blueprints',
    '/scripts/SRE_VM_Backup_2026/bin',
    '/scripts/SRE_Infrastructure'
]

# Senior Script Descriptions Map
SCRIPT_METADATA = {
    'sre_report_engine_2026.py': 'Motor central de agregação de saúde e emissão de relatórios SMTP.',
    'domain_guardian.py': 'Sentinela de integridade DNS: SPF, DMARC, MX e validação de expiração.',
    'network_telemetry.py': 'Análise de performance de rede: latência global e Speedtest de banda.',
    'samba_manager.py': 'Gestor de governança Samba: mapeamento de identidades e auditoria de ACLs.',
    'app.py': 'Backend API Gateway do Dashboard SRE (Flask / Aegis V2 Engine).',
    'system.py': 'Coletor de telemetria de baixo nível: processos, timers e socket forensics.',
    'run_all_cloud_backups.sh': 'Orquestrador de sincronização paralela multi-cloud via Rclone.',
    'run_daily.sh': 'Trigger principal do ciclo diário de manutenção e backup incremental.',
    'sre_vm_engine.py': 'Motor de backup de snapshots Proxmox/VMware com log streaming real-time.',
    'domain_sentinel.py': 'Monitor de reputação de IP e monitoramento proativo de Blacklists.'
}

def resolve_category(filename, fallback_category):
    fn = filename.upper()
    if fn.startswith(('AUDIT_', 'RELATORIO_', 'AUDIT')):
        return 'Relatórios de Auditoria'
    elif fn.startswith(('CHAMADO_', 'INCIDENTE_', 'INCIDENT_', 'RCA_')):
        return 'Incidentes e Chamados'
    elif fn.startswith(('RESOLUCAO_', 'RUNBOOK_')):
        return 'Runbooks e Resoluções'
    elif fn.startswith(('DIARIO_SRE_', 'DIARIO_')):
        return 'Diários de Bordo SRE'
    elif fn.startswith(('DOCUMENTACAO_', 'MANUAL_', 'PADRAO_')):
        return 'Manuais e Padrões'
    return fallback_category

def list_all_docs():
    docs = []
    seen_paths = set()

    # 1. Manual & Document Directories
    for folder, default_category in DOC_SEARCH_PATHS:
        if os.path.isdir(folder):
            for root, dirs, files in os.walk(folder):
                for f in sorted(files):
                    if f.endswith(('.md', '.txt', '.tex', '.html')):
                        full_path = os.path.join(root, f)
                        if full_path in seen_paths:
                            continue
                        seen_paths.add(full_path)

                        category = resolve_category(f, default_category)

                        docs.append({
                            'id': f'doc_{f}',
                            'name': f,
                            'desc': f'Documentação técnica ({category}).',
                            'type': 'manual',
                            'path': full_path,
                            'category': category,
                            'mtime': os.path.getmtime(full_path) if os.path.exists(full_path) else 0
                        })

    # 2. Scripts
    for d in SCRIPT_DIRS:
        if os.path.isdir(d):
            for root, dirs, files in os.walk(d):
                depth = root[len(d):].count(os.sep)
                if depth > 1:
                    continue
                for f in sorted(files):
                    if f.endswith(('.sh', '.py')):
                        if f == '__init__.py' or f.startswith('.'):
                            continue
                        full_path = os.path.join(root, f)
                        if full_path in seen_paths:
                            continue
                        seen_paths.add(full_path)

                        docs.append({
                            'id': f'script_{f}',
                            'name': f,
                            'desc': SCRIPT_METADATA.get(f, 'Utilitário de suporte à infraestrutura SRE.'),
                            'type': 'script',
                            'path': full_path,
                            'category': 'Código/Scripts',
                            'mtime': os.path.getmtime(full_path) if os.path.exists(full_path) else 0
                        })

    # Sort documents by category and name
    docs.sort(key=lambda x: (x['category'], x['name']))
    return docs

def get_doc_content(path, doc_type=None):
    if not path:
        return "Nenhum caminho de arquivo fornecido."

    try:
        # Resolve path safely within /scripts
        abs_path = os.path.abspath(path)
        if not abs_path.startswith('/scripts/'):
            # Try searching in DOCS_ROOT or DOC_SEARCH_PATHS
            file_name = os.path.basename(path)
            found = None
            for folder, _ in DOC_SEARCH_PATHS:
                candidate = os.path.join(folder, file_name)
                if os.path.isfile(candidate):
                    found = candidate
                    break
            if found:
                abs_path = found
            else:
                return f"Acesso negado: O caminho {path} está fora da raiz permitida."

        if not os.path.isfile(abs_path):
            # Attempt to find by basename in search paths
            file_name = os.path.basename(path)
            for folder, _ in DOC_SEARCH_PATHS:
                candidate = os.path.join(folder, file_name)
                if os.path.isfile(candidate):
                    abs_path = candidate
                    break

        if not os.path.isfile(abs_path):
            return f"Arquivo não encontrado no sistema: {abs_path}"

        with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
            source = f.read()

        if not source.strip():
            return f"O arquivo {os.path.basename(abs_path)} existe no sistema ({os.path.getsize(abs_path)} bytes), mas está sem conteúdo visível."

        if abs_path.endswith(('.sh', '.py')):
            lang = "python" if abs_path.endswith('.py') else "bash"
            return f"# {os.path.basename(abs_path)}\n\n``` {lang}\n{source}\n```"

        return source

    except Exception as e:
        return f"Erro de leitura ao abrir {path}: {str(e)}"
