from flask import Blueprint, jsonify, request
from core.sre_manager import run_samba_manager, is_allowed_share_path, get_acl_details
from services.samba_service import get_share_acls_formatted, get_enriched_users, get_enriched_groups, SHARE_SCOPE_MAP, get_deep_share_details

import time

samba_bp = Blueprint('samba', __name__, url_prefix='/api/samba')

_SAMBA_CACHE = {
    'shares': {'data': None, 'time': 0},
    'users': {'data': None, 'time': 0},
    'groups': {'data': None, 'time': 0}
}
CACHE_TTL = 30  # segundos

@samba_bp.route('/shares-aggregated')
@samba_bp.route('/shares')
def samba_shares():
    now = time.time()
    force_refresh = request.args.get('refresh', '').lower() in ('1', 'true')
    cached = _SAMBA_CACHE['shares']

    if not force_refresh and cached['data'] and (now - cached['time'] < CACHE_TTL):
        return jsonify(cached['data'])

    data, error = run_samba_manager('list_shares')
    if not error and data:
        cached['data'] = data
        cached['time'] = now
        return jsonify(data)
    elif cached['data']:
        # Fallback to stale cache if transient error occurs
        return jsonify(cached['data'])
    
    return (jsonify({'error': error}), 500) if error else jsonify([])

@samba_bp.route('/users')
def samba_users():
    now = time.time()
    force_refresh = request.args.get('refresh', '').lower() in ('1', 'true')
    cached = _SAMBA_CACHE['users']

    if not force_refresh and cached['data'] and (now - cached['time'] < CACHE_TTL):
        return jsonify(cached['data'])

    data, error = get_enriched_users()
    if not error and data:
        cached['data'] = data
        cached['time'] = now
        return jsonify(data)
    elif cached['data']:
        return jsonify(cached['data'])
        
    return (jsonify({'error': error}), 500) if error else jsonify([])

@samba_bp.route('/groups')
def samba_groups():
    now = time.time()
    force_refresh = request.args.get('refresh', '').lower() in ('1', 'true')
    cached = _SAMBA_CACHE['groups']

    if not force_refresh and cached['data'] and (now - cached['time'] < CACHE_TTL):
        return jsonify(cached['data'])

    data, error = get_enriched_groups()
    if not error and data:
        cached['data'] = data
        cached['time'] = now
        return jsonify(data)
    elif cached['data']:
        return jsonify(cached['data'])
        
    return (jsonify({'error': error}), 500) if error else jsonify([])

@samba_bp.route('/access-map')
def samba_access_map():
    data, error = run_samba_manager('access_map')
    return jsonify(data if data else {}) if not error else (jsonify({'error': error}), 500)

@samba_bp.route('/share-acls')
def samba_share_acls():
    path = request.args.get('path')
    share = request.args.get('share')
    if not path and share:
        path = SHARE_SCOPE_MAP.get(share, f"/dados/{share}")
    if not path:
        return jsonify({'error': 'Parâmetro path ou share não informado'}), 400
    res, error = get_share_acls_formatted(path)
    if error == "Access denied":
        return jsonify({'error': 'Access denied'}), 403
    if error:
        return jsonify({'error': error}), 500
    return jsonify(res)

@samba_bp.route('/details')
def samba_details():
    share = request.args.get('share', '').strip()
    path = request.args.get('path', '').strip()
    if not share and path:
        share = path.rstrip('/').split('/')[-1]
    if not share and not path:
        return jsonify({'error': 'Parâmetro path ou share não informado'}), 400
    data, error = get_deep_share_details(share, path if path else None)
    if error:
        return jsonify({
            'share': share,
            'path': path,
            'status': 'warning',
            'details': str(error)
        })
    return jsonify(data if data else {})

@samba_bp.route('/acl/apply', methods=['POST'])
def samba_apply_acl():
    data = request.json or {}
    path = data.get('path')
    if not is_allowed_share_path(path):
        return jsonify({'error': 'Access denied'}), 403
    res, error = run_samba_manager('apply', path, data.get('entity'), data.get('permission'), 'true' if data.get('recursive') else 'false')
    return jsonify({'success': True, 'data': res}) if not error else (jsonify({'error': error}), 500)

@samba_bp.route('/acl/remove', methods=['POST'])
def samba_remove_acl():
    data = request.json or {}
    path = data.get('path')
    if not is_allowed_share_path(path):
        return jsonify({'error': 'Access denied'}), 403
    res, error = run_samba_manager('remove', path, data.get('entity'), 'true' if data.get('recursive') else 'false')
    return jsonify({'success': True, 'data': res}) if not error else (jsonify({'error': error}), 500)
