import os
from flask import Blueprint, jsonify, request, current_app
from core.docs import list_all_docs, get_doc_content
from core.log_analyzer import tail_file
from services.utils import is_safe_path

docs_logs_bp = Blueprint('docs_logs', __name__, url_prefix='/api')

@docs_logs_bp.route('/docs/list')
def api_docs_list():
    return jsonify(list_all_docs())

@docs_logs_bp.route('/docs/content')
def api_docs_content():
    return jsonify({'content': get_doc_content(request.args.get('path'), request.args.get('type'))})

@docs_logs_bp.route('/view-log')
def view_log():
    path = request.args.get('path', '')
    app_log_root = current_app.config.get('APP_LOG_ROOT', '/scripts/logs')
    try:
        requested_path = os.path.abspath(path)
        if not is_safe_path(app_log_root, requested_path):
            return jsonify({'error': 'Acesso negado: Tentativa de Path Traversal detectada.'}), 403
        if not os.path.isfile(requested_path):
            return jsonify({'error': 'Arquivo não encontrado.'}), 404
    except Exception as e:
        return jsonify({'error': f'Erro na validação do caminho: {str(e)}'}), 400
    
    lines = int(request.args.get('lines', 500))
    return jsonify({'content': tail_file(requested_path, lines=lines)})

@docs_logs_bp.route('/logs')
def api_logs():
    log_path = '/scripts/SRE_Dashboard_2026/app.log'
    lines = int(request.args.get('lines', 5))
    if os.path.exists(log_path):
        content = tail_file(log_path, lines=lines)
        return jsonify(content.splitlines())
    return jsonify([])
