import os
from flask import jsonify

def is_safe_path(base_dir, target_path):
    """Prevents Path Traversal vulnerabilities by checking if target path stays within base directory."""
    try:
        resolved_target = os.path.abspath(target_path)
        resolved_base = os.path.abspath(base_dir)
        return os.path.commonpath([resolved_target, resolved_base]) == resolved_base
    except Exception:
        return False

def make_api_response(data=None, error=None, status_code=200, **extra):
    """Standardized SRE API Response Wrapper."""
    payload = {}
    if error:
        payload['success'] = False
        payload['error'] = str(error)
    else:
        payload['success'] = True
        if data is not None:
            if isinstance(data, dict):
                payload.update(data)
            else:
                payload['data'] = data
    
    for k, v in extra.items():
        payload[k] = v
        
    return jsonify(payload), status_code
