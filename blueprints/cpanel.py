import requests
from flask import Blueprint, jsonify, request, Response
from core.cpanel_manager import CPanelManager
from core.domain_guardian import invalidate_guardian_cache

cpanel_bp = Blueprint('cpanel', __name__, url_prefix='/api/cpanel')

@cpanel_bp.route('/domains')
def api_cpanel_domains():
    domain = request.args.get('domain')
    if not domain:
        return jsonify({'error': 'Domain parameter is required'}), 400
    cm = CPanelManager()
    return jsonify(cm.list_domains(domain))

@cpanel_bp.route('/dns/txt')
def api_cpanel_dns_txt():
    domain = request.args.get('domain')
    if not domain:
        return jsonify({'error': 'Domain parameter is required'}), 400
    cm = CPanelManager()
    return jsonify(cm.fetch_txt_records(domain))

@cpanel_bp.route('/dns/update', methods=['POST'])
def api_cpanel_dns_update():
    req_data = request.json or {}
    domain = req_data.get('domain')
    line_index = req_data.get('line_index')
    dname = req_data.get('name')
    new_value = req_data.get('value')
    ttl = req_data.get('ttl', 14400)
    
    if not all([domain, line_index is not None, dname, new_value]):
        return jsonify({'error': 'Missing required fields: domain, line_index, name, value'}), 400
        
    cm = CPanelManager()
    res = cm.update_dns_record(domain, line_index, dname, new_value, ttl)
    
    if res.get('success'):
        invalidate_guardian_cache()
        return jsonify({'success': True, 'message': 'DNS record updated successfully.'})
    return jsonify({'success': False, 'errors': res.get('errors')}), 500

@cpanel_bp.route('/emails')
def api_cpanel_emails():
    domain = request.args.get('domain')
    if not domain:
        return jsonify({'error': 'Domain parameter is required'}), 400
    cm = CPanelManager()
    return jsonify(cm.list_email_accounts(domain))

@cpanel_bp.route('/forwarders')
def api_cpanel_forwarders():
    domain = request.args.get('domain')
    if not domain:
        return jsonify({'error': 'Domain parameter is required'}), 400
    cm = CPanelManager()
    return jsonify(cm.list_forwarders(domain))

@cpanel_bp.route('/autoresponders')
def api_cpanel_autoresponders():
    domain = request.args.get('domain')
    if not domain:
        return jsonify({'error': 'Domain parameter is required'}), 400
    cm = CPanelManager()
    return jsonify(cm.list_autoresponders(domain))

@cpanel_bp.route('/forwarders/add', methods=['POST'])
def api_cpanel_forwarders_add():
    body = request.get_json(force=True)
    domain = body.get('domain')
    source = body.get('source')
    dest = body.get('dest')
    if not all([domain, source, dest]):
        return jsonify({'error': 'domain, source and dest are required'}), 400
    cm = CPanelManager()
    return jsonify(cm.add_forwarder(domain, source, dest))

@cpanel_bp.route('/forwarders/delete', methods=['POST'])
def api_cpanel_forwarders_delete():
    body = request.get_json(force=True)
    domain = body.get('domain')
    source = body.get('source')
    dest = body.get('dest')
    if not all([domain, source, dest]):
        return jsonify({'error': 'domain, source and dest are required'}), 400
    cm = CPanelManager()
    return jsonify(cm.delete_forwarder(domain, source, dest))

@cpanel_bp.route('/autoresponders/modify', methods=['POST'])
def api_cpanel_autoresponders_modify():
    body = request.get_json(force=True)
    domain = body.get('domain')
    email = body.get('email')
    subject = body.get('subject', '')
    msg_body = body.get('body', '')
    from_name = body.get('from_name', '')
    interval = body.get('interval', 8)
    is_html = body.get('is_html', False)
    start_type = body.get('start_type', 'now')
    start_date = body.get('start_date', None)
    stop_type = body.get('stop_type', 'never')
    stop_date = body.get('stop_date', None)
    if not all([domain, email]):
        return jsonify({'error': 'domain and email are required'}), 400
    cm = CPanelManager()
    return jsonify(cm.modify_autoresponder(
        domain, email, subject, msg_body, from_name,
        interval=interval, is_html=is_html,
        start_type=start_type, start_date=start_date,
        stop_type=stop_type, stop_date=stop_date
    ))

@cpanel_bp.route('/autoresponders/get')
def api_cpanel_autoresponders_get():
    domain = request.args.get('domain')
    email = request.args.get('email')
    if not all([domain, email]):
        return jsonify({'error': 'domain and email are required'}), 400
    cm = CPanelManager()
    return jsonify(cm.get_autoresponder(domain, email))

@cpanel_bp.route('/proxy-image')
def api_cpanel_proxy_image():
    url = request.args.get('url')
    if not url:
        return 'URL parameter is required', 400
    try:
        h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get(url, headers=h, verify=False, timeout=10)
        return Response(res.content, mimetype=res.headers.get('Content-Type', 'image/png'))
    except Exception as e:
        return str(e), 500
