import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import socket
import ssl
from datetime import datetime, timezone
import dns.resolver
import logging
import requests
import threading
import time
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor, as_completed

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('domain_sentinel')

# Configuration
DOMAINS = ["enterprise.local", "partner_alpha.com.br"]
IP_MONITOR = ["152.250.240.115", "131.196.236.189"]
SMTP_CONFIG_PATH = "/scripts/SRE_Infrastructure/maintenance/monitoring/config/email_config.json"
PROVIDERS = {
    "131.196.236.189": "Digital Play (Link Local)",
    "152.250.240.115": "Vivo (Link Local)",
    "108.167.151.98": "HostGator (Web/Mail)",
    "192.185.213.201": "HostGator (Web/Mail)"
}

# Extensive DNSBL List
DNSBL_LIST = [
    "zen.spamhaus.org", "bl.spamcop.net", "b.barracudacentral.org",
    "dnsbl.sorbs.net", "spam.dnsbl.sorbs.net", "dnsbl-1.uceprotect.net",
    "dnsbl-2.uceprotect.net", "dnsbl-3.uceprotect.net", "bl.mailspike.net",
    "dnsbl.zapbl.net", "psbl.surriel.com", "db.wpbl.info",
    "noptr.spamrats.com", "dyna.spamrats.com", "spam.spamrats.com",
    "bl.spameatingmonkey.net", "backscatter.spameatingmonkey.net"
]

from core.domain_guardian import SeniorSentinel

class DomainSentinel:
    def __init__(self):
        self.resolver = dns.resolver.Resolver()
        self.resolver.nameservers = ['9.9.9.9', '149.112.112.112']
        self.resolver.timeout = 5.0
        self.resolver.lifetime = 5.0
        self.guardian = SeniorSentinel()

    def get_real_ip(self, domain):
        try:
            return socket.gethostbyname(domain)
        except:
            return None

    def check_single_bl(self, ip, bl):
        reverse_ip = ".".join(reversed(ip.split(".")))
        query = f"{reverse_ip}.{bl}"
        try:
            answers = self.resolver.resolve(query, 'A')
            for rdata in answers:
                addr = rdata.address
                if bl == "zen.spamhaus.org" and addr.startswith("127.255.255."):
                    return None
                if addr.startswith("127."):
                    return {"bl": bl, "code": addr}
        except:
            pass
        return None

    def check_blacklists_parallel(self, ip):
        if not ip: return []
        results = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(self.check_single_bl, ip, bl) for bl in DNSBL_LIST]
            for future in as_completed(futures):
                res = future.result()
                if res: results.append(res)
        return results

    def get_ssl_live(self, domain):
        return self.guardian.get_ssl_info(domain)

    def check_smtp_health(self, domain):
        try:
            mxs = self.resolver.resolve(domain, 'MX')
            primary_mx = str(mxs[0].exchange).rstrip('.')
            
            # Try to connect to port 25
            with socket.create_connection((primary_mx, 25), timeout=3) as sock:
                banner = sock.recv(1024).decode(errors='ignore').strip()
                return {
                    "status": "ok",
                    "mx": primary_mx,
                    "banner": banner,
                    "port_25": "open"
                }
        except Exception as e:
            return {"status": "error", "msg": str(e)}

    def count_spf_lookups_recursive(self, domain, visited=None):
        return self.guardian.count_spf_lookups_recursive(domain, visited)

    def check_dnssec(self, domain):
        return self.guardian.check_dnssec(domain)

    def check_bimi(self, domain):
        return self.guardian.check_bimi(domain)

    def get_dns_security(self, domain, current_ip):
        return self.guardian.get_dns_security(domain, current_ip)

    def get_domain_expiry(self, domain):
        return self.guardian.get_domain_expiry(domain)

    def trigger_mxtoolbox_test(self, target_domain):
        """Sends a ping email to MXToolbox to analyze headers and alignment"""
        try:
            with open(SMTP_CONFIG_PATH, 'r') as f:
                full_config = json.load(f)
            
            # Senior logic: Select domain-specific config if available
            config = full_config.get('domains', {}).get(target_domain, full_config)
            
            msg = MIMEMultipart()
            msg['From'] = config['email_from']
            msg['To'] = "ping@tools.mxtoolbox.com"
            msg['Subject'] = f"Health Check Audit: {target_domain}"
            
            body = f"Automatic SRE Sentinel Audit for {target_domain}\nTimestamp: {datetime.now(timezone.utc).isoformat()}"
            msg.attach(MIMEText(body, 'plain'))
            
            smtp_server = config.get('smtp_server', full_config.get('smtp_server'))
            smtp_port = config.get('smtp_port', full_config.get('smtp_port', 587))
            use_tls = config.get('use_tls', full_config.get('use_tls', False)) or smtp_port == 587
            
            if use_tls or smtp_port == 587:
                server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
            server.login(config['smtp_user'], config['smtp_password'])
            server.sendmail(config['email_from'], [msg['To']], msg.as_string())
            server.quit()
            
            return {"status": "ok", "msg": f"Ping email sent to MXToolbox via {config['email_from']}"}
        except Exception as e:
            logger.error(f"MX Trigger Failed for {target_domain}: {e}")
            return {"status": "error", "msg": str(e)}

    def run_full_audit(self, trigger_mx=False):
        report = []
        
        # 1. Audit Domains
        for dom in DOMAINS:
            logger.info(f"Auditing domain: {dom}")
            ip = self.get_real_ip(dom)
            bls = self.check_blacklists_parallel(ip) if ip else []
            ssl_info = self.get_ssl_live(dom)
            smtp = self.check_smtp_health(dom)
            dns_sec = self.get_dns_security(dom, ip)
            expiry = self.get_domain_expiry(dom)
            mx_trigger = self.trigger_mxtoolbox_test(dom) if trigger_mx else {"status": "skipped"}
            dnssec = self.check_dnssec(dom)
            bimi = self.check_bimi(dom)
            
            # Precision Score (Aligned with Dashboard)
            score = 100
            if bls: score -= 30
            if dns_sec["spf"] != "ok": score -= 20
            elif dns_sec.get("spf_lookups", 0) > 10: score -= 10
            
            if dns_sec["dmarc"] != "ok":
                score -= 20
            elif dns_sec.get("dmarc_policy") == "none":
                score -= 5
                
            if dns_sec["dkim"] != "ok": score -= 15
            if dns_sec.get("spf_alignment") != "ok": score -= 5
            
            report.append({
                "target": dom,
                "type": "domain",
                "ip": ip,
                "score": max(0, score),
                "blacklists": bls,
                "ssl": ssl_info,
                "smtp": smtp,
                "security": dns_sec,
                "expiration": expiry,
                "mx_toolbox_trigger": mx_trigger,
                "dnssec": dnssec,
                "bimi": bimi,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        # 2. Audit Infrastructure IPs
        for ip in IP_MONITOR:
            logger.info(f"Auditing infra IP: {ip}")
            bls = self.check_blacklists_parallel(ip)
            # Filter out dynamic IP/local link false positives
            bls = [item for item in bls if item["bl"] not in ("noptr.spamrats.com", "dyna.spamrats.com", "dul.dnsbl.sorbs.net", "dul.dnsbl.sorbs.net")]
            provider = PROVIDERS.get(ip, "Unknown")
            
            report.append({
                "target": ip,
                "type": "ip",
                "provider": provider,
                "score": 100 - (30 if bls else 0),
                "blacklists": bls,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
        return report

if __name__ == "__main__":
    import sys
    trigger = "--trigger-mx" in sys.argv
    sentinel = DomainSentinel()
    full_report = sentinel.run_full_audit(trigger_mx=trigger)
    print(json.dumps(full_report, indent=2))
