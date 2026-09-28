from flask import Blueprint, jsonify, request
from core.domain_guardian import get_domain_health
from core.domain_sentinel import DomainSentinel

domain_bp = Blueprint('domain', __name__, url_prefix='/api/domain')

@domain_bp.route('/health')
def api_domain_health():
    return jsonify(get_domain_health())

@domain_bp.route('/trigger-mx', methods=['POST'])
def api_domain_trigger_mx():
    domain = request.json.get('domain')
    if not domain:
        return jsonify({'error': 'Domain required'}), 400
    sentinel = DomainSentinel()
    res = sentinel.trigger_mxtoolbox_test(domain)
    return jsonify(res)
