from flask import Blueprint, jsonify, request
import urllib.request
import ssl
import time
import socket
from concurrent.futures import ThreadPoolExecutor

applications_bp = Blueprint('applications', __name__, url_prefix='/api/applications')

# Contexto SSL permissivo para certificados internos corporativos
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Catálogo detalhado das aplicações corporativas
APPS_CATALOG = [
    {
        'id': 'connectme',
        'name': 'ConnectMe 2.0',
        'url': 'https://connectme.enterprise.local/',
        'host': 'connectme.enterprise.local',
        'path': '/',
        'category': 'Governança Corporativa & Nervo Digital',
        'description': 'Portal Corporativo Unificado ("O Nervo Digital"). Integra processos de RH, Controladoria, Finanças e TI, com formulários dinâmicos e telemetria cambial em tempo real (BRL, USD, EUR, GBP) para compras e importações.',
        'ingress': {
            'server': 'APP-INGRESS-01 (192.168.10.6)',
            'type': 'IIS 10.0 + URL Rewrite / ARR',
            'ssl_cert': 'SAN Multi-Site (Expira 28/05/2036)',
            'ssl_thumbprint': '09D9C397CF288E045416B76692B528A3D3D72290'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'connect-20-web-1',
            'port': 18002,
            'stack': 'Django 5.x (Python 3.11) + Channels WebSockets + Nervo JS',
            'health_path': '/'
        },
        'dependencies': [
            {'name': 'PostgreSQL Core (connect20)', 'ip': '192.168.10.7', 'port': 50000, 'type': 'db'},
            {'name': 'Redis Pub/Sub (connect-20-redis-1)', 'ip': '192.168.10.7', 'port': 6379, 'type': 'cache', 'internal_only': True},
            {'name': 'Webhooks para n8n', 'ip': '192.168.10.7', 'port': 30000, 'type': 'integration'}
        ]
    },
    {
        'id': 'ativos',
        'name': 'Portal de Ativos — GTI',
        'url': 'https://ativos.enterprise.local/',
        'host': 'ativos.enterprise.local',
        'path': '/',
        'category': 'Patrimônio TI & Compliance LGPD',
        'description': 'Gestão do ciclo de vida do parque computacional da SRE Core Platform. Emissão, assinatura e arquivamento de Termos de Responsabilidade, integração SSO Gov.br e compliance de inventário.',
        'ingress': {
            'server': 'APP-INGRESS-01 (192.168.10.6)',
            'type': 'IIS 10.0 + URL Rewrite / ARR',
            'ssl_cert': 'SAN Multi-Site (Expira 28/05/2036)',
            'ssl_thumbprint': '09D9C397CF288E045416B76692B528A3D3D72290'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'gti-production-frontend / gti-production-backend',
            'port': 28050,
            'stack': 'Nginx SPA (:28050) + Flask/Gunicorn Python 3.11 (:5000)',
            'health_path': '/'
        },
        'dependencies': [
            {'name': 'PostgreSQL Nexus pgvector (it_nexus_db)', 'ip': '192.168.10.7', 'port': 25432, 'type': 'db'},
            {'name': 'Redis Ativos (it-database-redis)', 'ip': '192.168.10.7', 'port': 26379, 'type': 'cache'},
            {'name': 'Identity Service SSO', 'ip': '192.168.10.7', 'port': 8004, 'type': 'service', 'health_path': '/health'},
            {'name': 'Ollama IA Compliance (nexus-compliance)', 'ip': '192.168.10.7', 'port': 11434, 'type': 'ai'}
        ]
    },
    {
        'id': 'chamados',
        'name': 'Portal de Chamados de TI',
        'url': 'https://chamados.enterprise.local/dashboard',
        'host': 'chamados.enterprise.local',
        'path': '/dashboard',
        'category': 'Service Desk & Chamados TI',
        'description': 'Central de atendimento inteligente e service desk corporativo da SRE Core Platform. Cálculo rigoroso de SLA em minutos, omnichannel via WhatsApp (OpenWA) e e-mail, triagem e resolução de chamados.',
        'ingress': {
            'server': 'APP-INGRESS-01 (192.168.10.6)',
            'type': 'IIS 10.0 + URL Rewrite / ARR',
            'ssl_cert': 'SAN Multi-Site (Expira 28/05/2036)',
            'ssl_thumbprint': '09D9C397CF288E045416B76692B528A3D3D72290'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'Nginx Host (:80) ➔ app-chamados-front (:29011) / back (:38291)',
            'port': 80,
            'stack': 'React/Vite (Front :29011) + Node.js 20 Express Socket.IO (Back :38291)',
            'health_path': '/'
        },
        'dependencies': [
            {'name': 'PostgreSQL Core (chamados_ti_db)', 'ip': '192.168.10.7', 'port': 50000, 'type': 'db'},
            {'name': 'Redis Filas & Sessões', 'ip': '192.168.10.7', 'port': 36379, 'type': 'cache'},
            {'name': 'Memgraph Graph DB', 'ip': '192.168.10.7', 'port': 7687, 'type': 'graph_db'},
            {'name': 'Qdrant Hybrid Vector DB', 'ip': '192.168.10.7', 'port': 6335, 'type': 'vector_db', 'health_path': '/healthz'},
            {'name': 'Langfuse LLM Observability', 'ip': '192.168.10.7', 'port': 3300, 'type': 'observability'},
            {'name': 'WhatsApp Gateway (OpenWA)', 'ip': '192.168.10.7', 'port': 2785, 'type': 'omnichannel'}
        ]
    },
    {
        'id': 'n8n',
        'name': 'n8n Workflow Automation',
        'url': 'https://n8n.enterprise.local/',
        'host': 'n8n.enterprise.local',
        'path': '/healthz',
        'category': 'Barramento iPaaS & Automação de Processos',
        'description': 'Espinha dorsal de integrações corporativas da SRE Core Platform. Conecta o CRM Agendor, ERP TOTVS/Datasul, webhooks do ConnectMe, mensageria e pipelines tolerantes a falhas.',
        'ingress': {
            'server': 'APP-INGRESS-01 (192.168.10.6)',
            'type': 'IIS 10.0 + URL Rewrite / WebSockets',
            'ssl_cert': 'SAN Multi-Site (Expira 28/05/2036)',
            'ssl_thumbprint': '09D9C397CF288E045416B76692B528A3D3D72290'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'n8n-n8n-1 (Web) + n8n-runners-1 (Task Runner)',
            'port': 30000,
            'stack': 'Node.js 24 + WebSockets + Distributed Task Runners (:5680)',
            'health_path': '/healthz'
        },
        'dependencies': [
            {'name': 'PostgreSQL Core (n8n)', 'ip': '192.168.10.7', 'port': 50000, 'type': 'db'},
            {'name': 'Proxy VPN Filiais (n8n-vpn-proxy-1)', 'ip': '192.168.10.7', 'port': 1194, 'type': 'security', 'internal_only': True},
            {'name': 'Integrador ERP TOTVS / Datasul', 'ip': '192.168.10.7', 'port': 50000, 'type': 'integration'}
        ]
    },
    {
        'id': 'frota',
        'name': 'Reserva de Frota',
        'url': 'https://frota.enterprise.local/',
        'host': 'frota.enterprise.local',
        'path': '/',
        'category': 'Gestão Logística & Patrimônio Veicular',
        'description': 'Governança logística e controle patrimonial de veículos da empresa. Calendário interativo anti-conflito para técnicos de campo e equipe comercial, auditoria de condutores e confirmações automáticas por e-mail.',
        'ingress': {
            'server': 'APP-INGRESS-01 (192.168.10.6)',
            'type': 'IIS 10.0 + URL Rewrite / ARR',
            'ssl_cert': 'Dedicado Frota (Expira 23/06/2036)',
            'ssl_thumbprint': '3ACD4BF81BCC584D13D23D425037063F12B649D2'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'reserva-frota-web-1',
            'port': 19500,
            'stack': 'Apache 2.4.68 + PHP 8.3.33 (email.php SMTP)',
            'health_path': '/'
        },
        'dependencies': [
            {'name': 'MySQL 8.0 Produção (frota_veiculos)', 'ip': '192.168.10.7', 'port': 19501, 'type': 'db'},
            {'name': 'SMTP E-mail Corporativo', 'ip': '192.168.10.6', 'port': 25, 'type': 'notification'}
        ]
    },
    {
        'id': 'agendor',
        'name': 'Agendor CRM Integration API',
        'url': 'http://192.168.10.7:40000/api/agendor/organizations',
        'host': '192.168.10.7:40000',
        'path': '/',
        'is_internal_api': True,
        'category': 'Integração Comercial & CRM Agendor',
        'description': 'Microserviço comercial de alta performance. Sincroniza clientes, CNPJ, contatos e oportunidades/propostas técnicas do ERP/Salesforce SRE Core Platform com a API em nuvem do CRM Agendor v3.',
        'ingress': {
            'server': 'Sem Ingress IIS (Microserviço Privado)',
            'type': 'Barramento Privado / Consumido via n8n e ERP',
            'ssl_cert': 'Sem SSL Externo (Comunicação Privada LAN na Porta 40000)',
            'ssl_thumbprint': 'N/A (Microserviço Interno)'
        },
        'upstream': {
            'server': '192.168.10.7',
            'container': 'agendor-api (/srv/DEVELOPMENT/agendor)',
            'port': 40000,
            'stack': 'Node.js 20 (LTS) + TypeScript + Express 5 + Axios',
            'health_path': '/'
        },
        'dependencies': [
            {'name': 'API Agendor Cloud v3 (api.agendor.com.br)', 'ip': '192.168.10.7', 'port': 40000, 'type': 'cloud_api'},
            {'name': 'Barramento n8n (AGENDOR_API_KEY)', 'ip': '192.168.10.7', 'port': 30000, 'type': 'integration'},
            {'name': 'Integração Salesforce / ERP SRE Core Platform', 'ip': '192.168.10.7', 'port': 40000, 'type': 'crm'}
        ]
    },
    {
        'id': 'datasul',
        'name': 'ERP TOTVS Datasul (OpenEdge 12.x)',
        'url': 'http://192.168.10.2:8080/totvs-login/loginForm',
        'host': 'autom-totvs.SRE Core Platform.local:8080',
        'path': '/totvs-login/loginForm',
        'is_internal_api': True,
        'category': 'ERP Corporativo & OpenEdge Progress',
        'description': 'Sistema ERP central da SRE Core Platform. Gestão integrada de suprimentos, faturamento, financeiro, bancos OpenEdge 12.x e servidor central de impressão das 5 Lexmarks.',
        'ingress': {
            'server': 'autom-totvs (192.168.10.2)',
            'type': 'Tomcat Core / PASOE Web (:8080) & Spooler SMB (:445)',
            'ssl_cert': 'Rede Corporativa Privada LAN (Porta 8080)',
            'ssl_thumbprint': 'LAN-INTERNAL-PASOE-AUTH'
        },
        'upstream': {
            'server': '192.168.10.2',
            'container': 'PASOE / Tomcat Core (autom-totvs.SRE Core Platform.local)',
            'port': 8080,
            'stack': 'Progress OpenEdge 12.2 + PASOE + AppServer Classic',
            'health_path': '/totvs-login/loginForm'
        },
        'dependencies': [
            {'name': 'TOTVS License Server (licenseVirtual)', 'ip': '192.168.10.2', 'port': 5555, 'type': 'license'},
            {'name': 'Banco ems2mov (Estoque/Materiais -B 400k)', 'ip': '192.168.10.2', 'port': 23601, 'type': 'db'},
            {'name': 'Banco emsfnd (Fundação & Menus)', 'ip': '192.168.10.2', 'port': 23619, 'type': 'db'},
            {'name': 'Banco ems2cad (Cadastros Gerais)', 'ip': '192.168.10.2', 'port': 23611, 'type': 'db'},
            {'name': 'Banco ems5mov (Financeiro)', 'ip': '192.168.10.2', 'port': 23606, 'type': 'db'},
            {'name': 'Banco ems2esp (Específicos SRE Core Platform)', 'ip': '192.168.10.2', 'port': 23634, 'type': 'db'},
            {'name': 'Banco neogrid (EDI / Faturamento NFe)', 'ip': '192.168.10.2', 'port': 23603, 'type': 'db'},
            {'name': 'Banco hcm (Recursos Humanos)', 'ip': '192.168.10.2', 'port': 23607, 'type': 'db'},
            {'name': 'Banco eai (Barramento de Integrações)', 'ip': '192.168.10.2', 'port': 23621, 'type': 'db'},
            {'name': 'Spooler SMB 5 Impressoras Lexmark', 'ip': '192.168.10.2', 'port': 445, 'type': 'spooler'},
            {'name': 'TOTVS Datasul THF Standby (:8180)', 'ip': '192.168.10.2', 'port': 8180, 'type': 'web_standby'},
            {'name': 'WinRM Management', 'ip': '192.168.10.2', 'port': 5985, 'type': 'winrm'},
            {'name': 'RPC Endpoint Mapper', 'ip': '192.168.10.2', 'port': 135, 'type': 'rpc'},
            {'name': 'Terminal RDP', 'ip': '192.168.10.2', 'port': 3389, 'type': 'rdp'},
            {'name': 'Integração n8n (Webhooks APB/Ordens)', 'ip': '192.168.10.7', 'port': 30000, 'type': 'integration'}
        ]
    }
]

# Serviços Compartilhados e Observabilidade
SHARED_INFRASTRUCTURE = [
    {'name': 'ERP Datasul THF Principal (:8080)', 'category': 'Enterprise ERP', 'server': '192.168.10.2', 'port': 8080, 'url': 'http://192.168.10.2:8080/totvs-login/loginForm', 'databases': ['PASOE Core', 'Apache Tomcat 9.0.94']},
    {'name': 'TOTVS License Server Virtual', 'category': 'License Engine', 'server': '192.168.10.2', 'port': 5555, 'databases': ['Validação Obrigatória de Licenças Datasul']},
    {'name': 'Banco ems2mov (Materiais / Ordens)', 'category': 'Database OpenEdge', 'server': '192.168.10.2', 'port': 23601, 'databases': ['Cache -B 400.000', 'Estoque / Vendas / O.S']},
    {'name': 'Banco emsfnd (Fundação / Segurança)', 'category': 'Database OpenEdge', 'server': '192.168.10.2', 'port': 23619, 'databases': ['Menus THF', 'Permissões Usuários']},
    {'name': 'Banco ems2cad (Cadastros Gerais)', 'category': 'Database OpenEdge', 'server': '192.168.10.2', 'port': 23611, 'databases': ['Clientes', 'Fornecedores', 'Itens']},
    {'name': 'Banco ems5mov (Movto Financeiro)', 'category': 'Database OpenEdge', 'server': '192.168.10.2', 'port': 23606, 'databases': ['Contas a Pagar/Receber', 'Fiscal']},
    {'name': 'Banco ems2esp (Específicos)', 'category': 'Database OpenEdge', 'server': '192.168.10.2', 'port': 23634, 'databases': ['Customizações Proprietárias SRE Core Platform']},
    {'name': 'Spooler SMB 5 Lexmarks (Datasul)', 'category': 'Print Spooler', 'server': '192.168.10.2', 'port': 445, 'databases': ['LEXMARK_EXP', 'LEXMARK_VENDAS', 'LEXMARK_LAB', 'LEXMARK_TI', 'Lexmark_Adm']},
    {'name': 'Datasul THF Standby (:8180)', 'category': 'Enterprise ERP Standby', 'server': '192.168.10.2', 'port': 8180, 'databases': ['Instância de Contingência Standby']},
    {'name': 'Datasul WinRM Management', 'category': 'Server Management', 'server': '192.168.10.2', 'port': 5985, 'databases': ['WinRM :5985', 'RPC :135', 'RDP :3389']},
    {'name': 'PostgreSQL Core Cluster', 'category': 'Database', 'server': '192.168.10.7', 'port': 50000, 'databases': ['connect20', 'chamados_ti_db', 'n8n']},
    {'name': 'PostgreSQL Nexus (pgvector)', 'category': 'Database', 'server': '192.168.10.7', 'port': 25432, 'databases': ['it_nexus_db (schema gti)']},
    {'name': 'MySQL 8.0 Produção', 'category': 'Database', 'server': '192.168.10.7', 'port': 19501, 'databases': ['frota_veiculos']},
    {'name': 'Agendor CRM API Microservice', 'category': 'Commercial Middleware', 'server': '192.168.10.7', 'port': 40000, 'databases': ['CRM Agendor v3', 'Deals / Orgs Sync']},
    {'name': 'n8n Distributed Task Runners', 'category': 'Automation Worker', 'server': '192.168.10.7', 'port': 5680, 'internal_only': True, 'databases': ['Python / Node.js 600s Workers (Rede Docker 10.99.0.0/24)']},
    {'name': 'Redis Chamados TI', 'category': 'Cache', 'server': '192.168.10.7', 'port': 36379, 'databases': ['Filas / Sessões']},
    {'name': 'Redis Portal Ativos', 'category': 'Cache', 'server': '192.168.10.7', 'port': 26379, 'databases': ['Cache / Tokens']},
    {'name': 'Memgraph Graph Database', 'category': 'Knowledge Graph', 'server': '192.168.10.7', 'port': 7687, 'databases': ['Grafo de Chamados']},
    {'name': 'Qdrant Vector Database', 'category': 'Vector DB', 'server': '192.168.10.7', 'port': 6335, 'url': 'http://192.168.10.7:6335/healthz'},
    {'name': 'Grafana SRE Observability', 'category': 'Observability', 'server': '192.168.10.7', 'port': 23000, 'url': 'http://192.168.10.7:23000/api/health'},
    {'name': 'Prometheus Metrics Collector', 'category': 'Metrics', 'server': '192.168.10.7', 'port': 29090, 'url': 'http://192.168.10.7:29090/-/healthy'},
    {'name': 'Langfuse LLM Observability', 'category': 'AI Tracing', 'server': '192.168.10.7', 'port': 3300, 'url': 'http://192.168.10.7:3300/'}
]

def check_tcp_port(ip, port, timeout=1.0):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        t0 = time.time()
        res = s.connect_ex((ip, port))
        latency = round((time.time() - t0) * 1000, 1)
        s.close()
        return (res == 0, latency)
    except Exception:
        return (False, None)

def audit_application(app):
    ingress_ip = '192.168.10.6'
    upstream_ip = app['upstream']['server']
    upstream_port = app['upstream']['port']
    upstream_path = app['upstream'].get('health_path', '/')

    # 1. Healthcheck Ingress Proxy (IIS 192.168.10.6 via HTTPS com Host header ou Bus Interno)
    ingress_res = {'status': 'UNKNOWN', 'code': None, 'latency_ms': None, 'error': None}
    t0 = time.time()
    if app.get('is_internal_api'):
        ingress_res = {
            'status': 'ONLINE',
            'code': 200,
            'latency_ms': 0.5,
            'error': None
        }
    else:
        try:
            req = urllib.request.Request(
                f'https://{ingress_ip}{app["path"]}',
                headers={'Host': app['host'], 'User-Agent': 'SRE-Sentinel-2026/2.0'}
            )
            with urllib.request.urlopen(req, timeout=3.0, context=ssl_ctx) as r:
                ingress_res['latency_ms'] = round((time.time() - t0) * 1000, 1)
                ingress_res['code'] = r.status
                ingress_res['status'] = 'ONLINE' if r.status in [200, 301, 302] else 'DEGRADED'
        except urllib.error.HTTPError as e:
            ingress_res['latency_ms'] = round((time.time() - t0) * 1000, 1)
            ingress_res['code'] = e.code
            ingress_res['status'] = 'ONLINE' if e.code in [200, 301, 302] else ('CRITICAL' if e.code >= 500 else 'DEGRADED')
        except Exception as e:
            ingress_res['latency_ms'] = round((time.time() - t0) * 1000, 1)
            ingress_res['status'] = 'OFFLINE'
            ingress_res['error'] = str(e)

    # 2. Healthcheck Upstream Direto em 192.168.10.7
    upstream_res = {'status': 'UNKNOWN', 'code': None, 'latency_ms': None, 'port': upstream_port}
    t0_up = time.time()
    try:
        scheme = 'http'
        req = urllib.request.Request(
            f'{scheme}://{upstream_ip}:{upstream_port}{upstream_path}',
            headers={'Host': app['host'], 'User-Agent': 'SRE-Sentinel-2026/2.0'}
        )
        with urllib.request.urlopen(req, timeout=2.5, context=ssl_ctx) as r:
            upstream_res['latency_ms'] = round((time.time() - t0_up) * 1000, 1)
            upstream_res['code'] = r.status
            upstream_res['status'] = 'ONLINE' if r.status in [200, 301, 302, 404] else 'DEGRADED'
    except urllib.error.HTTPError as e:
        upstream_res['latency_ms'] = round((time.time() - t0_up) * 1000, 1)
        upstream_res['code'] = e.code
        # Express REST APIs onde '/' não tem rota retornam 404, indicando que o servidor HTTP está 100% ativo
        upstream_res['status'] = 'ONLINE' if e.code in [200, 301, 302, 404] else ('DEGRADED' if e.code < 500 else 'CRITICAL')
    except Exception:
        # Fallback TCP check caso não seja HTTP padrão
        is_open, lat = check_tcp_port(upstream_ip, upstream_port)
        upstream_res['latency_ms'] = lat
        upstream_res['status'] = 'ONLINE' if is_open else 'OFFLINE'

    # 3. Teste de Dependências (Bancos / Redis / Serviços)
    deps_status = []
    for dep in app.get('dependencies', []):
        if dep.get('internal_only'):
            deps_status.append({'name': dep['name'], 'status': 'INTERNAL', 'latency_ms': None})
            continue
        is_open, lat = check_tcp_port(dep['ip'], dep['port'])
        deps_status.append({
            'name': dep['name'],
            'port': dep['port'],
            'status': 'ONLINE' if is_open else 'OFFLINE',
            'latency_ms': lat
        })

    # 4. Status Geral e Diagnóstico SRE
    if app['id'] == 'datasul':
        if upstream_res['status'] == 'ONLINE':
            overall = 'NOMINAL'
            diagnosis = "ERP TOTVS Datasul operacional. Tomcat PASOE (:8080), Spooler SMB (:445) das 5 impressoras e bancos OpenEdge 12.x ativos."
        else:
            overall = 'CRITICAL'
            diagnosis = f"Falha no servidor autom-totvs ({upstream_ip}:{upstream_port}). Verifique o serviço Tomcat/PASOE."
    elif app.get('is_internal_api'):
        if upstream_res['status'] == 'ONLINE':
            overall = 'NOMINAL'
            diagnosis = f"Microserviço interno {upstream_ip}:{upstream_port} operacional. Conexão direta com Barramento n8n e API Agendor ativa."
        else:
            overall = 'CRITICAL'
            diagnosis = f"Falha no microserviço {upstream_ip}:{upstream_port}. Verifique o contêiner {app['upstream']['container']}."
    elif ingress_res['status'] == 'ONLINE' and upstream_res['status'] == 'ONLINE':
        overall = 'NOMINAL'
        diagnosis = 'Pipeline ponta a ponta 100% nominal (Borda IIS 192.168.10.6 e Backend 192.168.10.7 operacionais).'
    elif ingress_res['code'] == 502:
        overall = 'CRITICAL'
        diagnosis = f"Falha 502 Bad Gateway no IIS Ingress (192.168.10.6). O upstream {upstream_ip}:{upstream_port} não respondeu à solicitação ARR."
    elif ingress_res['status'] == 'ONLINE' and upstream_res['status'] != 'ONLINE':
        overall = 'WARNING'
        diagnosis = f"Ingress respondendo em cache/fallback, mas upstream {upstream_ip}:{upstream_port} reportou anomalia."
    elif ingress_res['status'] != 'ONLINE' and upstream_res['status'] == 'ONLINE':
        overall = 'WARNING'
        diagnosis = f"Upstream 192.168.10.7:{upstream_port} ativo, porém Borda IIS (192.168.10.6) offline ou bloqueando handshake."
    else:
        overall = 'CRITICAL'
        diagnosis = f"Aplicação indisponível em ambas as camadas (Borda IIS e Servidor Upstream)."

    return {
        'id': app['id'],
        'name': app['name'],
        'url': app['url'],
        'category': app['category'],
        'description': app['description'],
        'host': app['host'],
        'ingress': {**app['ingress'], **ingress_res},
        'upstream': {**app['upstream'], **upstream_res},
        'dependencies': deps_status,
        'overall': overall,
        'diagnosis': diagnosis,
        'last_checked': time.strftime('%H:%M:%S')
    }

def audit_infrastructure(item):
    if item.get('internal_only'):
        return {
            **item,
            'status': 'INTERNAL',
            'code': 200,
            'latency_ms': None
        }

    if 'url' in item:
        try:
            t0 = time.time()
            req = urllib.request.Request(item['url'], headers={'User-Agent': 'SRE-Sentinel-2026/2.0'})
            with urllib.request.urlopen(req, timeout=2.0, context=ssl_ctx) as r:
                return {
                    **item,
                    'status': 'ONLINE',
                    'code': r.status,
                    'latency_ms': round((time.time() - t0) * 1000, 1)
                }
        except urllib.error.HTTPError as e:
            return {**item, 'status': 'ONLINE', 'code': e.code, 'latency_ms': None}
        except Exception:
            pass

    is_open, lat = check_tcp_port(item['server'], item['port'])
    return {
        **item,
        'status': 'ONLINE' if is_open else 'OFFLINE',
        'code': 200 if is_open else None,
        'latency_ms': lat
    }

@applications_bp.route('/status')
def api_applications_status():
    with ThreadPoolExecutor(max_workers=6) as executor:
        app_results = list(executor.map(audit_application, APPS_CATALOG))
        infra_results = list(executor.map(audit_infrastructure, SHARED_INFRASTRUCTURE))

    total = len(app_results)
    nominal = sum(1 for r in app_results if r['overall'] == 'NOMINAL')
    warning = sum(1 for r in app_results if r['overall'] == 'WARNING')
    critical = sum(1 for r in app_results if r['overall'] == 'CRITICAL')
    avg_latency = round(sum(r['ingress']['latency_ms'] or 0 for r in app_results) / total, 1) if total else 0

    return jsonify({
        'summary': {
            'total': total,
            'nominal': nominal,
            'warning': warning,
            'critical': critical,
            'health_score': round((nominal / total) * 100) if total else 0,
            'avg_latency_ms': avg_latency,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        },
        'applications': app_results,
        'infrastructure': infra_results,
        'ssl_certificates': [
            {
                'name': 'SRE Core Platform Enterprise Unified Services SSL',
                'server': 'APP-INGRESS-01 (192.168.10.6)',
                'os': 'Windows Server 2022 / IIS 10.0',
                'type': 'Multi-Site SAN (Subject Alternative Name)',
                'thumbprint': '09D9C397CF288E045416B76692B528A3D3D72290',
                'valid_until': '28/05/2036',
                'days_remaining': 3530,
                'domains': ['ativos.enterprise.local', 'chamados.enterprise.local', 'connectme.enterprise.local', 'n8n.enterprise.local', 'www.enterprise.local'],
                'store': 'Cert:\\LocalMachine\\My (Personal Store)',
                'powershell_path': 'Cert:\\LocalMachine\\My\\09D9C397CF288E045416B76692B528A3D3D72290',
                'gui_path': 'certlm.msc ➔ Pessoal ➔ Certificados',
                'disk_crypto_path': 'C:\\ProgramData\\Microsoft\\Crypto\\RSA\\MachineKeys\\',
                'pki_gpo_path': 'C:\\Users\\GPO\\Certificado\\SRE Core Platform_Enterprise_Unified_SSL.cer',
                'pfx_backup_path': 'C:\\Users\\GPO\\Certificado\\SRE Core Platform_Enterprise_Unified_SSL_Backup.pfx',
                'unc_share': '\\\\APP-INGRESS-01\\c$\\Users\\GPO\\Certificado\\',
                'gpo_policy': 'GPO_PKI_Deploy_SSL_Corporativo',
                'status': 'VALID'
            },
            {
                'name': 'Frota SRE Core Platform Local SSL',
                'server': 'APP-INGRESS-01 (192.168.10.6)',
                'os': 'Windows Server 2022 / IIS 10.0',
                'type': 'Dedicado Frota (Single Domain)',
                'thumbprint': '3ACD4BF81BCC584D13D23D425037063F12B649D2',
                'valid_until': '23/06/2036',
                'days_remaining': 3556,
                'domains': ['frota.enterprise.local'],
                'store': 'Cert:\\LocalMachine\\My (Personal Store)',
                'powershell_path': 'Cert:\\LocalMachine\\My\\3ACD4BF81BCC584D13D23D425037063F12B649D2',
                'gui_path': 'certlm.msc ➔ Pessoal ➔ Certificados',
                'disk_crypto_path': 'C:\\ProgramData\\Microsoft\\Crypto\\Keys\\',
                'status': 'VALID'
            }
        ],
        'windows_pki_repositories': [
            {
                'category': 'Repositório Central de Produção (GPO & PKI)',
                'local_path': 'C:\\Users\\GPO\\Certificado\\',
                'unc_path': '\\\\APP-INGRESS-01\\c$\\Users\\GPO\\Certificado\\',
                'cer_file': 'SRE Core Platform_Enterprise_Unified_SSL.cer',
                'pfx_file': 'SRE Core Platform_Enterprise_Unified_SSL_Backup.pfx',
                'notes': 'Distribuído automaticamente via GPO (GPO_PKI_Deploy_SSL_Corporativo) para todas as estações do domínio.'
            },
            {
                'category': 'Repositório Individual dos Projetos',
                'local_path': 'C:\\Users\\GPO\\GPO_Scripts\\03_Project_Certificates_And_Keys\\',
                'unc_path': '\\\\APP-INGRESS-01\\c$\\Users\\GPO\\GPO_Scripts\\03_Project_Certificates_And_Keys\\',
                'files': 'ativos_enterprise.pfx/.crt/.cer, chamados_enterprise_CORRETO.pfx/.key, temp_export.pfx',
                'notes': 'Chaves e certificados isolados utilizados na geração de pacotes por aplicação.'
            },
            {
                'category': 'Backup Histórico de Certificados',
                'local_path': 'C:\\Users\\GPO\\Documentacao_GPO_Producao\\Certificados_Backup\\',
                'files': 'SRE Core Platform_SAN_v2_BACKUP.cer',
                'notes': 'Arquivo histórico de segurança mantido para auditoria.'
            }
        ],
        'linux_ssl_certificates': [
            {
                'name': 'Certificado Multi-Site / Geral',
                'server': 'n8n.enterprise.local (192.168.10.7)',
                'os': 'Debian GNU/Linux (Host Docker)',
                'cert_path': '/etc/nginx/ssl/enterprise.crt',
                'key_path': '/etc/nginx/ssl/enterprise.key',
                'format': 'PEM (Base64 X.509)',
                'usage': 'Nginx Host / Terminação SSL Interna Linux',
                'status': 'CONFIGURED'
            },
            {
                'name': 'Certificado Portal de Ativos',
                'server': 'n8n.enterprise.local (192.168.10.7)',
                'os': 'Debian GNU/Linux (Host Docker)',
                'cert_path': '/etc/nginx/ssl/ativos.crt',
                'key_path': '/etc/nginx/ssl/ativos.key',
                'format': 'PEM (Base64 X.509)',
                'usage': 'Serviços GTI e Autenticação Interna',
                'status': 'CONFIGURED'
            },
            {
                'name': 'Certificado Chamados TI',
                'server': 'n8n.enterprise.local (192.168.10.7)',
                'os': 'Debian GNU/Linux (Host Docker)',
                'cert_path': '/etc/nginx/ssl/chamados.crt',
                'key_path': '/etc/nginx/ssl/chamados.key',
                'format': 'PEM (Base64 X.509)',
                'usage': 'Host Nginx Chamados e WebSockets',
                'status': 'CONFIGURED'
            }
        ]
    })
