import subprocess
import json
import time
import socket
import threading
import requests
from concurrent.futures import ThreadPoolExecutor

# Professional SRE Network Targets
LATENCY_TARGETS = {
    "AWS São Paulo": "ec2.sa-east-1.amazonaws.com",
    "Google Cloud Brazil": "storage.googleapis.com",
    "Cloudflare DNS": "1.1.1.1",
    "Google DNS": "8.8.8.8",
    "Miami (Equinix MI1)": "204.48.0.1"
}

class NetworkTelemetry:
    def __init__(self):
        self.speedtest_path = "/scripts/SRE_Dashboard_2026/.venv/bin/speedtest-cli"

    def get_external_ip_info(self):
        """Fetch external IP and basic geolocation info for connectivity audit."""
        try:
            # Using ident.me for clean IP and ip-api for metadata
            res = requests.get("http://ip-api.com/json/", timeout=5)
            if res.status_code == 200:
                data = res.json()
                return {
                    "ip": data.get("query"),
                    "isp": data.get("isp"),
                    "city": data.get("city"),
                    "country": data.get("country"),
                    "org": data.get("org")
                }
        except: pass
        return {"ip": "Unknown", "isp": "N/A", "city": "N/A"}

    def measure_latency(self, host):
        try:
            cmd = ["ping", "-c", "3", "-W", "2", host]
            output = subprocess.check_output(cmd).decode()
            if "avg" in output:
                avg = output.split("/")[-3]
                return float(avg)
        except: pass
        return "Timeout"

    def get_multi_region_telemetry(self):
        results = {}
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_label = {executor.submit(self.measure_latency, host): label for label, host in LATENCY_TARGETS.items()}
            for future in future_to_label:
                label = future_to_label[future]
                try:
                    results[label] = future.result()
                except:
                    results[label] = "Timeout"
        return results

    def run_bandwidth_test(self):
        try:
            # Senior: Add timeout and --secure to prevent hangs
            cmd = [self.speedtest_path, "--json", "--secure"]
            output = subprocess.check_output(cmd, text=True, timeout=60)
            data = json.loads(output)
            return {
                "status": "success",
                "download": round(data['download'] / 1_000_000, 2), # Mbps
                "upload": round(data['upload'] / 1_000_000, 2), # Mbps
                "ping": data['ping'],
                "isp": data.get('client', {}).get('isp', 'N/A'),
                "server": f"{data.get('server', {}).get('name', 'Unknown')} ({data.get('server', {}).get('location', 'N/A')})",
                "timestamp": data.get('timestamp')
            }
        except Exception as e:
            return {"status": "error", "msg": str(e)}

def get_network_snapshot():
    telemetry = NetworkTelemetry()
    latencies = telemetry.get_multi_region_telemetry()
    ip_info = telemetry.get_external_ip_info()
    
    return {
        "latencies": latencies,
        "external_ip": ip_info,
        "timestamp": time.time()
    }
