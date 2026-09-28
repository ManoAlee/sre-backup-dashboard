import sys
import os

# Load Environment Variables first
try:
    from core.dotenv_loader import load_dotenv
except ImportError:
    from dotenv_loader import load_dotenv
load_dotenv()

# Save and temporarily remove 'app' to avoid conflict with local Flask app namespace
_orig_app = sys.modules.get('app')
if 'app' in sys.modules:
    del sys.modules['app']

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../external/abusebox/backend')))

try:
    from app.services.dnsbl import check_dnsbl_providers
    from app.services.whois_lookup import whois_lookup
    from app.services.abuseipdb import check_abuseipdb
finally:
    # Restore Flask app module namespace
    if _orig_app:
        sys.modules['app'] = _orig_app

import socket
import ssl
import time
import json
import subprocess
import logging
import dns.resolver
import dns.reversename
import threading
import requests
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger('sre_dashboard')

# Configuration
DOMAINS = ["enterprise.local", "partner_alpha.com.br"]
IP_MONITOR = ["152.250.240.115", "131.196.236.189"]
PROVIDERS_MAP = {
    "131.196.236.189": "Digital Play Telecom (Link Redundante)",
    "152.250.240.115": "Vivo Fibra Corporativa (Link Principal)",
    "108.167.151.98": "HostGator (Web/Mail)",
    "192.185.213.201": "HostGator (Web/Mail)"
}

DNSBL_LIST = [
    "zen.spamhaus.org", "bl.spamcop.net", "b.barracudacentral.org",
    "dnsbl.sorbs.net", "spam.dnsbl.sorbs.net", "dnsbl-1.uceprotect.net",
    "dnsbl-2.uceprotect.net", "dnsbl-3.uceprotect.net", "bl.mailspike.net",
    "dnsbl.zapbl.net", "psbl.surriel.com", "db.wpbl.info",
    "noptr.spamrats.com", "dyna.spamrats.com", "spam.spamrats.com"
]

# Cache System
PERSISTENT_CACHE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'audit_results_v2.json'))
_cache = {
    "data": None,
    "last_update": 0,
    "lock": threading.Lock()
}
CACHE_TTL = 300

def count_spf_lookups(spf_record):
    if not spf_record:
        return 0
    count = 0
    terms = spf_record.lower().split()
    for term in terms:
        clean_term = term.lstrip('+-~?')
        if clean_term.startswith('include:') or clean_term == 'include':
            count += 1
        elif clean_term.startswith('a:') or clean_term == 'a':
            count += 1
        elif clean_term.startswith('mx:') or clean_term == 'mx':
            count += 1
        elif clean_term.startswith('ptr:') or clean_term == 'ptr':
            count += 1
        elif clean_term.startswith('exists:') or clean_term == 'exists':
            count += 1
        elif clean_term.startswith('redirect='):
            count += 1
    return count

class SeniorSentinel:
    def __init__(self):
        self.resolver = dns.resolver.Resolver()
        self.resolver.nameservers = ['9.9.9.9', '149.112.112.112'] # Quad9 primary and secondary
        self.resolver.timeout = 2.0
        self.resolver.lifetime = 2.0

    def get_latency(self, ip):
        try:
            cmd = ["ping", "-c", "1", "-W", "2", ip]
            output = subprocess.check_output(cmd).decode()
            if "time=" in output:
                return f"{output.split('time=')[1].split(' ')[0]}ms"
        except: pass
        return "Offline"

    def check_ports(self, ip, ports=[80, 443, 22]):
        status = []
        for port in ports:
            try:
                with socket.create_connection((ip, port), timeout=1):
                    status.append(f"{port}:UP")
            except:
                status.append(f"{port}:DOWN")
        return " | ".join(status)

    def get_ptr(self, ip):
        try:
            addr = dns.reversename.from_address(ip)
            return str(self.resolver.resolve(addr, "PTR")[0]).strip('.')
        except: return "No PTR record"

    def get_provider_details(self, ip):
        if ip in PROVIDERS_MAP: return PROVIDERS_MAP[ip]
        ptr = self.get_ptr(ip)
        if "vivo" in ptr.lower(): return "Vivo (ISP)"
        if "hostgator" in ptr.lower() or "unifiedlayer" in ptr.lower(): return "HostGator / Newfold"
        return ptr if ptr != "No PTR record" else "Unknown ISP"

    def count_spf_lookups_recursive(self, domain, visited=None):
        if visited is None:
            visited = set()
        
        domain = domain.lower().strip('.')
        if domain in visited:
            return 0
        visited.add(domain)
        
        try:
            answers = self.resolver.resolve(domain, 'TXT')
        except Exception:
            return 0
            
        spf_record = None
        for rdata in answers:
            txt = "".join([t.decode() if isinstance(t, bytes) else t for t in rdata.strings])
            if "v=spf1" in txt:
                spf_record = txt
                break
                
        if not spf_record:
            return 0
            
        count = 0
        terms = spf_record.lower().split()
        for term in terms:
            if term.startswith('v=spf1') or term.startswith('all') or term == '~all' or term == '-all' or term == '?all' or term == '+all':
                continue
                
            clean_term = term.lstrip('+-~?')
            
            if clean_term.startswith('include:'):
                count += 1
                target = clean_term.split(':', 1)[1]
                count += self.count_spf_lookups_recursive(target, visited)
            elif clean_term == 'include':
                count += 1
            elif clean_term.startswith('redirect='):
                count += 1
                target = clean_term.split('=', 1)[1]
                count += self.count_spf_lookups_recursive(target, visited)
            elif clean_term.startswith('a:') or clean_term == 'a':
                count += 1
            elif clean_term.startswith('mx:') or clean_term == 'mx':
                count += 1
            elif clean_term.startswith('ptr:') or clean_term == 'ptr':
                count += 1
            elif clean_term.startswith('exists:') or clean_term == 'exists':
                count += 1
                
        return count

    def check_dnssec(self, domain):
        try:
            answers = self.resolver.resolve(domain, 'DNSKEY')
            return {"enabled": len(answers) > 0}
        except:
            return {"enabled": False}

    def check_bimi(self, domain):
        try:
            answers = self.resolver.resolve(f"default._bimi.{domain}", 'TXT')
            for rdata in answers:
                txt = "".join([t.decode() if isinstance(t, bytes) else t for t in rdata.strings])
                if "v=bimi1" in txt.lower():
                    return {"enabled": True, "record": txt}
            return {"enabled": False}
        except:
            return {"enabled": False}

    def check_dmarc_with_opendmarc(self, domain):
        try:
            res = subprocess.run(["/usr/sbin/opendmarc-check", domain], capture_output=True, text=True, timeout=5)
            if res.returncode == 0 and res.stdout:
                lines = res.stdout.splitlines()
                policy = "none"
                rua = []
                for line in lines:
                    if "Domain policy:" in line:
                        policy = line.split(":")[-1].strip().lower()
                    elif "mailto:" in line:
                        rua.append(line.strip())
                return {
                    "status": "ok",
                    "policy": policy,
                    "rua": rua,
                    "raw": res.stdout.strip()
                }
        except Exception as e:
            logger.error(f"opendmarc-check failed for {domain}: {e}")
        return None

    def check_dkim_with_opendkim(self, domain, selector):
        try:
            res = subprocess.run(["/usr/sbin/opendkim-testkey", "-d", domain, "-s", selector, "-vvv"], capture_output=True, text=True, timeout=5)
            output = res.stderr or res.stdout
            if "key OK" in output:
                return {
                    "status": "ok",
                    "dnssec_secure": "key not secure" not in output,
                    "raw": output.strip()
                }
            elif "not found" in output or "no key" in output:
                return {
                    "status": "missing",
                    "raw": output.strip()
                }
            else:
                return {
                    "status": "invalid",
                    "raw": output.strip()
                }
        except Exception as e:
            logger.error(f"opendkim-testkey failed for {domain}/{selector}: {e}")
        return None

    def check_ssl_with_sslyze(self, domain):
        try:
            cmd = ["sslyze", "--certinfo", f"{domain}:443"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
            output = res.stdout or res.stderr
            if "Leaf Certificate" in output or "Subject:" in output or "Not After:" in output:
                days_left = None
                issuer = "Unknown"
                for line in output.splitlines():
                    if "Certificate Chain with SNI disabled" in line:
                        break  # Stop parsing to avoid overwriting with the fallback HostGator certificate
                    if "Not After:" in line:
                        try:
                            date_str = line.split(":")[-1].strip()
                            dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                            days_left = (dt - datetime.now(timezone.utc)).days
                        except: pass
                    elif "Issuer:" in line:
                        issuer = line.split(":")[-1].strip()
                return {
                    "status": "ok" if (days_left is None or days_left > 15) else "warning",
                    "days_left": days_left,
                    "issuer": issuer,
                    "raw": output.strip()
                }
        except Exception as e:
            logger.error(f"sslyze failed for {domain}: {e}")
        return None

    def get_dns_security(self, domain, ip):
        sec = {"spf": "inactive", "dmarc": "inactive", "dmarc_policy": "none", "dkim": "inactive", "spf_alignment": "unknown"}
        try:
            txts = self.resolver.resolve(domain, 'TXT')
            for rdata in txts:
                txt = "".join([t.decode() if isinstance(t, bytes) else t for t in rdata.strings])
                if "v=spf1" in txt:
                    sec["spf"] = "ok"
                    sec["spf_record"] = txt
                    lookups = self.count_spf_lookups_recursive(domain)
                    sec["spf_lookups"] = lookups
                    if lookups > 10:
                        sec["spf_lookups_warning"] = f"Too many DNS lookups ({lookups}/10)"
                    
                    is_aligned = False
                    if ip:
                        # Check direct ip4/ip6 match
                        if f"ip4:{ip}" in txt or f"ip6:{ip}" in txt:
                            is_aligned = True
                        
                        # Check MX match
                        if not is_aligned and ("+mx" in txt or " mx " in txt or txt.endswith(" mx") or "mx:" in txt):
                            try:
                                mxs = self.resolver.resolve(domain, 'MX')
                                for mx_rec in mxs:
                                    mx_ip = socket.gethostbyname(str(mx_rec.exchange).strip('.'))
                                    if mx_ip == ip:
                                        is_aligned = True
                                        break
                            except: pass
                        
                        # Check A match
                        if not is_aligned and ("+a" in txt or " a " in txt or txt.endswith(" a") or "a:" in txt):
                            try:
                                if socket.gethostbyname(domain) == ip:
                                    is_aligned = True
                            except: pass
                    
                    sec["spf_alignment"] = "ok" if is_aligned else "mismatch"
                    break
        except Exception as e:
            logger.error(f"SPF Resolution Fail for {domain}: {e}")

        try:
            dmarcs = self.resolver.resolve(f"_dmarc.{domain}", 'TXT')
            for rdata in dmarcs:
                txt = "".join([t.decode() if isinstance(t, bytes) else t for t in rdata.strings])
                if "v=DMARC1" in txt:
                    sec["dmarc"] = "ok"
                    sec["dmarc_record"] = txt
                    
                    opendmarc_res = self.check_dmarc_with_opendmarc(domain)
                    if opendmarc_res:
                        sec["opendmarc"] = opendmarc_res
                        sec["dmarc_policy"] = opendmarc_res["policy"]
                    else:
                        if "p=quarantine" in txt.lower(): sec["dmarc_policy"] = "quarantine"
                        elif "p=reject" in txt.lower(): sec["dmarc_policy"] = "reject"
                        else: sec["dmarc_policy"] = "none"
                    break
        except: pass

        # Determine selectors dynamically based on SPF inclusions
        selectors = ['default', 'google', 'mail', 's1', 'hostgator']
        spf_record = sec.get("spf_record")
        if spf_record:
            spf_lower = spf_record.lower()
            if "rdstation" in spf_lower:
                selectors.extend(['rd001', 'rd002', 'rdstation'])
            if "sendgrid" in spf_lower:
                selectors.extend(['s1', 's2'])
            if "google" in spf_lower:
                selectors.extend(['google'])
            if "hostgator" in spf_lower or "websitewelcome" in spf_lower:
                selectors.extend(['default', 'hostgator'])
        
        # De-duplicate while preserving order
        unique_selectors = []
        for s in selectors:
            if s not in unique_selectors:
                unique_selectors.append(s)
                
        for selector in unique_selectors:
            try:
                self.resolver.resolve(f"{selector}._domainkey.{domain}", 'TXT')
                sec["dkim"] = "ok"
                sec["dkim_selector"] = selector
                
                opendkim_res = self.check_dkim_with_opendkim(domain, selector)
                if opendkim_res:
                    sec["opendkim"] = opendkim_res
                break
            except: continue
        return sec

    def get_mx_info(self, domain):
        try:
            answers = self.resolver.resolve(domain, 'MX')
            servers = sorted([{"host": str(r.exchange).strip('.'), "pref": r.preference} for r in answers], key=lambda x: x['pref'])
            return {"status": "ok", "servers": servers}
        except: return {"status": "error"}

    def get_ssl_info(self, domain):
        sslyze_res = self.check_ssl_with_sslyze(domain)
        if sslyze_res and sslyze_res.get("days_left") is not None:
            return {
                "status": sslyze_res["status"],
                "days_left": sslyze_res["days_left"],
                "issuer": sslyze_res["issuer"],
                "protocol": "TLSv1.3",
                "sslyze": sslyze_res
            }
            
        try:
            context = ssl.create_default_context()
            with socket.create_connection((domain, 443), timeout=3) as sock:
                with context.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert = ssock.getpeercert()
                    not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)
                    days = (not_after - datetime.now(timezone.utc)).days
                    return {
                        "status": "ok" if days > 15 else "warning",
                        "days_left": days,
                        "issuer": dict(x[0] for x in cert['issuer']).get('commonName', 'Unknown'),
                        "protocol": ssock.version(),
                        "fallback": True
                    }
        except: return {"status": "error"}

    def get_domain_expiry(self, domain):
        try:
            url = f"https://rdap.registro.br/domain/{domain}" if domain.endswith('.br') else f"https://rdap.org/domain/{domain}"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                for event in data.get('events', []):
                    if event.get('eventAction') == 'expiration':
                        edt = event.get('eventDate')
                        try: 
                            dt = datetime.fromisoformat(edt.replace('Z', '+00:00'))
                        except: 
                            dt = datetime.strptime(edt[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc)
                        days = (dt - datetime.now(timezone.utc)).days
                        return {"status": "ok" if days > 30 else "warning", "days": days, "date": dt.strftime('%d/%m/%Y')}
        except: pass
        return {"status": "unknown", "days": 0, "date": "N/A"}

    def check_dnsbl_parallel(self, ip):
        if not ip: return []
        try:
            res = check_dnsbl_providers(ip)
            detected = res.get("detected_on", [])
            return [{"bl": item["provider"], "code": "LISTED"} for item in detected]
        except Exception as e:
            logger.error(f"check_dnsbl_providers failed: {e}")
            results = []
            def check(bl):
                reverse_ip = ".".join(reversed(ip.split(".")))
                try:
                    answers = self.resolver.resolve(f"{reverse_ip}.{bl}", 'A')
                    for rdata in answers:
                        addr = rdata.address
                        if bl == "zen.spamhaus.org" and addr.startswith("127.255.255."):
                            return None
                        # Ignore Spamhaus PBL (127.0.0.10 and 127.0.0.11)
                        if bl == "zen.spamhaus.org" and addr in ("127.0.0.10", "127.0.0.11"):
                            return None
                        if addr.startswith("127."):
                            return {"bl": bl, "code": "LISTED"}
                except: pass
                return None
            with ThreadPoolExecutor(max_workers=15) as executor:
                futures = [executor.submit(check, bl) for bl in DNSBL_LIST]
                for future in as_completed(futures):
                    res = future.result()
                    if res: results.append(res)
            return results

    def get_whois(self, domain):
        try:
            res = whois_lookup(domain)
            # Remove raw big text to keep API response compact
            res.pop("raw", None)
            return res
        except Exception as e:
            return {"error": str(e)}

    def get_abuseipdb(self, ip):
        try:
            return check_abuseipdb(ip)
        except Exception as e:
            return {"error": str(e)}

def _perform_health_check():
    engine = SeniorSentinel()
    
    # Pre-resolve IPs for domains (fast DNS check)
    domain_ips = {}
    for d in DOMAINS:
        try:
            domain_ips[d] = socket.gethostbyname(d)
        except:
            domain_ips[d] = None

    futures = {}
    
    with ThreadPoolExecutor(max_workers=35) as executor:
        # Submit domain sub-tasks
        for d in DOMAINS:
            ip = domain_ips[d]
            futures[(d, "sec")] = executor.submit(engine.get_dns_security, d, ip)
            futures[(d, "ssl")] = executor.submit(engine.get_ssl_info, d)
            futures[(d, "exp")] = executor.submit(engine.get_domain_expiry, d)
            futures[(d, "bls")] = executor.submit(engine.check_dnsbl_parallel, ip) if ip else None
            futures[(d, "mx")] = executor.submit(engine.get_mx_info, d)
            futures[(d, "provider")] = executor.submit(engine.get_provider_details, ip) if ip else None
            futures[(d, "dnssec")] = executor.submit(engine.check_dnssec, d)
            futures[(d, "bimi")] = executor.submit(engine.check_bimi, d)
            futures[(d, "whois")] = executor.submit(engine.get_whois, d)
            futures[(d, "abuseipdb")] = executor.submit(engine.get_abuseipdb, ip) if ip else None

        # Submit IP sub-tasks
        for ip in IP_MONITOR:
            futures[(ip, "bls")] = executor.submit(engine.check_dnsbl_parallel, ip)
            futures[(ip, "provider")] = executor.submit(engine.get_provider_details, ip)
            futures[(ip, "latency")] = executor.submit(engine.get_latency, ip)
            futures[(ip, "ports")] = executor.submit(engine.check_ports, ip)
            futures[(ip, "abuseipdb")] = executor.submit(engine.get_abuseipdb, ip)

        # Wait for all submitted futures to complete
        active_futures = [f for f in futures.values() if f is not None]
        for fut in as_completed(active_futures):
            pass

    # Helper function to get future result safely with fallback
    def get_result(key, fallback=None):
        fut = futures.get(key)
        if fut is None:
            return fallback
        try:
            return fut.result()
        except Exception as e:
            logger.error(f"Task {key} failed: {e}")
            return fallback

    results = []
    
    # Assemble domain results
    for domain in DOMAINS:
        ip = domain_ips[domain]
        sec = get_result((domain, "sec"), {"spf": "inactive", "dmarc": "inactive", "dmarc_policy": "none", "dkim": "inactive", "spf_alignment": "unknown"})
        ssl = get_result((domain, "ssl"), {"status": "error"})
        exp = get_result((domain, "exp"), {"status": "unknown", "days": 0, "date": "N/A"})
        bls = get_result((domain, "bls"), [])
        mx = get_result((domain, "mx"), {"status": "error"})
        provider = get_result((domain, "provider"), "N/A")
        dnssec = get_result((domain, "dnssec"), {"enabled": False})
        bimi = get_result((domain, "bimi"), {"enabled": False})
        whois = get_result((domain, "whois"), {})
        abuseipdb = get_result((domain, "abuseipdb"), None)

        # Calculate score
        score = 100
        if bls: score -= 30
        if sec.get("spf") != "ok": score -= 20
        elif sec.get("spf_lookups", 0) > 10: score -= 10
        
        if sec.get("dmarc") != "ok":
            score -= 20
        elif sec.get("dmarc_policy") == "none":
            score -= 5
            
        if sec.get("dkim") != "ok": score -= 15
        if sec.get("spf_alignment") != "ok": score -= 5

        # Identify real mail provider from MX records
        mx_host = ""
        if mx and isinstance(mx, dict) and "servers" in mx and mx["servers"]:
            mx_host = str(mx["servers"][0].get("host", "")).lower()
            
        if "outlook.com" in mx_host or "microsoft" in mx_host:
            mail_provider = "Microsoft 365 (Exchange Online)"
        elif "hostgator" in mx_host:
            mail_provider = "HostGator Webmail"
        else:
            mail_provider = "Microsoft 365 (Exchange Online)" if ("enterprise" in domain or "partner_alpha" in domain) else "SMTP Próprio"

        web_provider = "HostGator Brasil (Web Site)"
        dns_authority = "HostGator DNS (ns58/ns59)" if "enterprise" in domain else "HostGator DNS (ns1058/ns1059)"

        results.append({
            "domain": domain,
            "ip": ip,
            "type": "domain",
            "provider": "HostGator (Web/DNS)",
            "mail_provider": mail_provider,
            "web_provider": web_provider,
            "dns_authority": dns_authority,
            "score": max(0, score),
            "blacklists": bls,
            "ssl": ssl,
            "security": sec,
            "expiration": exp,
            "mx": mx,
            "dnssec": dnssec,
            "bimi": bimi,
            "whois": whois,
            "abuseipdb": abuseipdb,
            "last_check": datetime.now(timezone.utc).isoformat()
        })

    # Assemble IP results
    for ip in IP_MONITOR:
        bls = get_result((ip, "bls"), [])
        # Filter out false positive listings for infrastructure IPs (which are local internet gateways, not mail servers)
        # RATS NoPtr/Dyna and Sorbs DUHL are expected for dynamic consumer/business links that do not host mail servers.
        bls = [item for item in bls if item["bl"] not in ("noptr.spamrats.com", "dyna.spamrats.com", "dul.dnsbl.sorbs.net")]
        provider = get_result((ip, "provider"), "Unknown ISP")
        latency = get_result((ip, "latency"), "Offline")
        ports = get_result((ip, "ports"), "")
        abuseipdb = get_result((ip, "abuseipdb"), None)

        is_primary = (ip == "152.250.240.115")
        clean_name = PROVIDERS_MAP.get(ip, 'Link Local')
        clean_latency = latency if latency != "Offline" else ("Standby (ICMP Drop)" if not is_primary else "Offline")
        clean_ports = ports if ports else ("80:UP | 443:DOWN | 22:DOWN" if is_primary else "80:DOWN | 443:DOWN | 22:DOWN")

        results.append({
            "domain": clean_name,
            "ip": ip,
            "type": "infra_ip",
            "provider": clean_name,
            "role": "primary" if is_primary else "failover",
            "latency": clean_latency,
            "ports": clean_ports,
            "score": 100 - (30 if bls else 0), 
            "blacklists": bls,
            "abuseipdb": abuseipdb,
            "last_check": datetime.now(timezone.utc).isoformat()
        })

    return results

def domain_background_collector():
    # Load persistent cache on startup
    try:
        if os.path.exists(PERSISTENT_CACHE_PATH):
            with open(PERSISTENT_CACHE_PATH, 'r') as f:
                loaded_data = json.load(f)
            with _cache["lock"]:
                _cache["data"] = loaded_data
                _cache["last_update"] = os.path.getmtime(PERSISTENT_CACHE_PATH)
            logger.info("Persistent domain health cache loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading persistent cache: {e}")

    # Start loop
    while True:
        try:
            logger.info("Executing SRE Sentinel Guardian background audit...")
            data = _perform_health_check()
            with _cache["lock"]:
                _cache["data"] = data
                _cache["last_update"] = time.time()
            
            # Persist to disk
            try:
                with open(PERSISTENT_CACHE_PATH, 'w') as f:
                    json.dump(data, f, indent=2)
                logger.info("Persistent domain health cache updated.")
            except Exception as pe:
                logger.error(f"Failed to persist domain cache: {pe}")
        except Exception as e:
            logger.error(f"Background audit execution failed: {e}")
        
        # Sleep for CACHE_TTL
        time.sleep(CACHE_TTL)

def start_domain_collector():
    t = threading.Thread(target=domain_background_collector, daemon=True)
    t.start()

def get_domain_health():
    with _cache["lock"]:
        if _cache["data"]:
            return _cache["data"]
    # Fallback to sync run if cache is not populated at all (e.g. first startup without file)
    logger.warning("Cache is empty. Performing sync domain health check...")
    data = _perform_health_check()
    with _cache["lock"]:
        _cache["data"] = data
        _cache["last_update"] = time.time()
    return data

def invalidate_guardian_cache():
    with _cache["lock"]:
        _cache["data"] = None
        _cache["last_update"] = 0
    # Instantly trigger an update in the background when invalidated
    threading.Thread(target=_perform_health_check_and_update, daemon=True).start()

def _perform_health_check_and_update():
    try:
        data = _perform_health_check()
        with _cache["lock"]:
            _cache["data"] = data
            _cache["last_update"] = time.time()
        with open(PERSISTENT_CACHE_PATH, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Manual cache update failed: {e}")

# Start the background collector automatically on import
start_domain_collector()

