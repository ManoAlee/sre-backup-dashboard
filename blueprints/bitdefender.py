from flask import Blueprint, jsonify, request
from services.bitdefender_service import fetch_latest_bitdefender_data

bitdefender_bp = Blueprint('bitdefender', __name__, url_prefix='/api/bitdefender')

@bitdefender_bp.route('/overview')
def get_overview():
    data = fetch_latest_bitdefender_data(force_refresh=False)
    return jsonify({
        "status": data.get("status", "unknown"),
        "timestamp": data.get("timestamp"),
        "summary": data.get("summary", {}),
        "health_score": data.get("summary", {}).get("security_health_score", 100)
    })

@bitdefender_bp.route('/quarantine')
def get_quarantine():
    data = fetch_latest_bitdefender_data(force_refresh=False)
    return jsonify({
        "timestamp": data.get("timestamp"),
        "total": len(data.get("quarantine", [])),
        "items": data.get("quarantine", [])
    })

@bitdefender_bp.route('/inventory')
def get_inventory():
    data = fetch_latest_bitdefender_data(force_refresh=False)
    return jsonify({
        "timestamp": data.get("timestamp"),
        "total": len(data.get("inventory", [])),
        "items": data.get("inventory", [])
    })

@bitdefender_bp.route('/incidents')
def get_incidents():
    data = fetch_latest_bitdefender_data(force_refresh=False)
    return jsonify({
        "timestamp": data.get("timestamp"),
        "total": len(data.get("incidents", [])),
        "items": data.get("incidents", [])
    })

@bitdefender_bp.route('/sync', methods=['POST'])
def trigger_sync():
    data = fetch_latest_bitdefender_data(force_refresh=True)
    return jsonify({
        "message": "Sincronização com o Bitdefender GravityZone concluída com sucesso.",
        "timestamp": data.get("timestamp"),
        "summary": data.get("summary", {})
    })
