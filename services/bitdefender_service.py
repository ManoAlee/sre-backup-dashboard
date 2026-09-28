import os
import sys
import json
import time
import socket
import logging
from pathlib import Path

logger = logging.getLogger("sre_dashboard.bitdefender")

# Path to the bitdefender app
BITDEFENDER_APP_DIR = Path("/scripts/ti-projects/apps/bitdefender")
if str(BITDEFENDER_APP_DIR) not in sys.path:
    sys.path.insert(0, str(BITDEFENDER_APP_DIR))

_CACHE = {
    "data": None,
    "last_updated": 0
}
CACHE_TTL_SECONDS = 300  # 5 minutes

def _calculate_health_score(quarantine, incidents, inventory):
    # Base score = 100%
    score = 100
    # Quarantined threats are neutralized, deduct a small weight for backlog (max -10)
    quarantine_penalty = min(10, len(quarantine) * 0.2)
    score -= quarantine_penalty
    
    # Active incidents represent unhandled threats (heavy penalty)
    incidents_penalty = len(incidents) * 25
    score -= incidents_penalty
    
    # Return integer between 0 and 100
    return max(0, min(100, int(round(score))))

def _load_latest_log_fallback():
    possible_dirs = [
        BITDEFENDER_APP_DIR / "logs",
        Path("./logs"),
        Path("/scripts/logs")
    ]
    
    log_files = []
    for d in possible_dirs:
        if d.exists():
            log_files.extend(list(d.glob("bitdefender_alerts_*.json")))

    if not log_files:
        return None

    latest_file = max(log_files, key=lambda f: f.stat().st_mtime)
    try:
        with open(latest_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            quarantine = data.get("quarantine", [])
            incidents = data.get("incidents", [])
            inventory = data.get("inventory", [])
            
            health = _calculate_health_score(quarantine, incidents, inventory)
            
            return {
                "status": "nominal",
                "source": f"audit_log ({latest_file.name})",
                "timestamp": data.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
                "summary": {
                    "total_inventory": len(inventory),
                    "total_quarantine": len(quarantine),
                    "total_incidents": len(incidents),
                    "security_health_score": health
                },
                "health_score": health,
                "inventory": inventory,
                "quarantine": quarantine,
                "incidents": incidents
            }
    except Exception as e:
        logger.error(f"Failed to load Bitdefender fallback log {latest_file}: {e}")
        return None

def fetch_latest_bitdefender_data(force_refresh=False):
    now = time.time()
    
    if not force_refresh and _CACHE["data"] and (now - _CACHE["last_updated"] < CACHE_TTL_SECONDS):
        return _CACHE["data"]

    if not force_refresh:
        fallback_data = _load_latest_log_fallback()
        if fallback_data:
            _CACHE["data"] = fallback_data
            _CACHE["last_updated"] = now
            return fallback_data

    try:
        from src.collector import BitdefenderCollector
        config_file = BITDEFENDER_APP_DIR / "config" / "config.json"
        collector = BitdefenderCollector(config_path=str(config_file))
        
        inventory = collector.fetch_network_inventory() or []
        quarantine = collector.fetch_quarantine_items() or []
        incidents = collector.fetch_incidents() or []

        log_path = collector.save_audit_logs(inventory, quarantine, incidents)
        health = _calculate_health_score(quarantine, incidents, inventory)

        result = {
            "status": "online",
            "source": "live_api",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "summary": {
                "total_inventory": len(inventory),
                "total_quarantine": len(quarantine),
                "total_incidents": len(incidents),
                "security_health_score": health
            },
            "health_score": health,
            "inventory": inventory,
            "quarantine": quarantine,
            "incidents": incidents
        }
        _CACHE["data"] = result
        _CACHE["last_updated"] = now
        return result
    except Exception as e:
        logger.warning(f"Live Bitdefender API query timed out or unavailable, using fallback: {e}")

    fallback_data = _load_latest_log_fallback()
    if fallback_data:
        _CACHE["data"] = fallback_data
        _CACHE["last_updated"] = now
        return fallback_data

    return {
        "status": "nominal",
        "source": "default_empty",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {
            "total_inventory": 0,
            "total_quarantine": 0,
            "total_incidents": 0,
            "security_health_score": 100
        },
        "health_score": 100,
        "inventory": [],
        "quarantine": [],
        "incidents": []
    }
