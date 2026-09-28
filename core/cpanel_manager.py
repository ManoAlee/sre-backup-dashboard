import os
import json
import base64
import requests
import logging
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger("cpanel_manager")

# Load environment variables
try:
    from core.dotenv_loader import load_dotenv
except ImportError:
    from dotenv_loader import load_dotenv
load_dotenv()

# Build the CPANEL_ACCOUNTS dictionary dynamically from env vars
CPANEL_ACCOUNTS = {}

# Parse custom keys matching CPANEL_ACCOUNTS_...
for key, val in os.environ.items():
    if key.startswith("CPANEL_ACCOUNTS_"):
        domain_prefix = key.replace("CPANEL_ACCOUNTS_", "").lower().strip()
        # Map back to domain suffix. We assume .com.br as default, but we can match any.
        try:
            user, token, host = val.split(":", 2)
            base_domain = f"{domain_prefix}.com.br"
            CPANEL_ACCOUNTS[base_domain] = {
                "user": user,
                "token": token,
                "host": host
            }
        except ValueError:
            logger.error(f"Invalid format for env var {key}. Expected user:token:host")

# Fallback defaults if env vars are empty
if "enterprise.local" not in CPANEL_ACCOUNTS:
    CPANEL_ACCOUNTS["enterprise.local"] = {
        "user": os.environ.get("CPANEL_USER", "autom893"),
        "token": os.environ.get("CPANEL_TOKEN", "BT7DEGP7DPYNAO3GZ2OHUV7PVUDTVPUX"),
        "host": os.environ.get("CPANEL_HOST", "cpanel.enterprise.local")
    }

class CPanelManager:
    def _get_account_config(self, domain):
        """Resolves cPanel credentials dynamically based on the domain name."""
        if not domain:
            return CPANEL_ACCOUNTS["enterprise.local"]
            
        domain = domain.lower().strip()
        for base_domain, config in CPANEL_ACCOUNTS.items():
            if domain == base_domain or domain.endswith("." + base_domain):
                return config
                
        # Default fallback if unknown domain
        return CPANEL_ACCOUNTS["enterprise.local"]

    def _get_headers(self, config):
        return {
            "Authorization": f"cpanel {config['user']}:{config['token']}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SRE-Sentinel-Guardian/2026",
            "Accept": "application/json"
        }

    def _api_get(self, domain, module, function, params=None):
        config = self._get_account_config(domain)
        url = f"https://{config['host']}/execute/{module}/{function}"
        headers = self._get_headers(config)
        try:
            res = requests.get(url, headers=headers, params=params, timeout=12, verify=False)
            if res.status_code == 200:
                return res.json()
            else:
                logger.error(f"cPanel UAPI ({domain}) returned status {res.status_code}: {res.text}")
                return {"status": 0, "errors": [f"HTTP error {res.status_code}"]}
        except Exception as e:
            logger.error(f"cPanel connection to {config['host']} failed: {e}")
            return {"status": 0, "errors": [str(e)]}

    def _api_post(self, domain, module, function, data=None):
        config = self._get_account_config(domain)
        url = f"https://{config['host']}/execute/{module}/{function}"
        headers = self._get_headers(config)
        try:
            res = requests.post(url, headers=headers, data=data, timeout=12, verify=False)
            if res.status_code == 200:
                return res.json()
            else:
                logger.error(f"cPanel UAPI ({domain}) returned status {res.status_code}: {res.text}")
                return {"status": 0, "errors": [f"HTTP error {res.status_code}"]}
        except Exception as e:
            logger.error(f"cPanel connection to {config['host']} failed: {e}")
            return {"status": 0, "errors": [str(e)]}

    def list_domains(self, domain):
        """Returns addon domains, subdomains, and main domain from cPanel UAPI for the associated account."""
        res = self._api_get(domain, "DomainInfo", "list_domains")
        if res.get("status") == 1:
            return {
                "success": True,
                "data": res.get("data", {})
            }
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def fetch_txt_records(self, zone_name):
        """Fetches and decodes all TXT records (SPF, DMARC, DKIM) for a zone."""
        res = self._api_get(zone_name, "DNS", "parse_zone", {"zone": zone_name})
        if res.get("status") == 1:
            raw_records = res.get("data", [])
            txt_records = []
            for rec in raw_records:
                if rec.get("type") == "record" and rec.get("record_type") == "TXT":
                    try:
                        dname = base64.b64decode(rec.get("dname_b64", "")).decode("utf-8", errors="ignore").rstrip(".")
                        data_parts = [base64.b64decode(d).decode("utf-8", errors="ignore") for d in rec.get("data_b64", [])]
                        data_str = "".join(data_parts)
                        txt_records.append({
                            "line_index": rec.get("line_index"),
                            "name": dname,
                            "ttl": rec.get("ttl"),
                            "record_type": "TXT",
                            "value": data_str
                        })
                    except Exception as parse_err:
                        logger.warning(f"Failed to parse base64 DNS record: {parse_err}")
            return {"success": True, "records": txt_records}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def update_dns_record(self, zone_name, line_index, dname, new_value, ttl=14400):
        """Edits a DNS record by its line index inside cPanel."""
        if not dname.endswith("."):
            dname += "."
            
        edit_payload = [{
            "line_index": int(line_index),
            "dname": dname,
            "record_type": "TXT",
            "data": [new_value],
            "ttl": int(ttl)
        }]
        
        payload = {
            "zone": zone_name,
            "edit": json.dumps(edit_payload)
        }
        
        res = self._api_post(zone_name, "DNS", "mass_edit_zone", payload)
        if res.get("status") == 1:
            return {"success": True, "data": res.get("data")}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def list_email_accounts(self, domain):
        """Returns all email accounts registered under the cPanel account associated with domain."""
        res = self._api_get(domain, "Email", "list_pops_with_disk")
        if res.get("status") == 1:
            return {
                "success": True,
                "data": res.get("data", [])
            }
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def list_forwarders(self, domain):
        """Returns all email forwarders registered under the cPanel account associated with domain."""
        res = self._api_get(domain, "Email", "list_forwarders")
        if res.get("status") == 1:
            return {
                "success": True,
                "data": res.get("data", [])
            }
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def _get_persistence_path(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, "autoresponders_persistence.json")

    def _load_persistence(self):
        path = self._get_persistence_path()
        if not os.path.exists(path):
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading autoresponder persistence: {e}")
            return {}

    def _save_persistence(self, data):
        path = self._get_persistence_path()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving autoresponder persistence: {e}")

    def list_autoresponders(self, domain):
        """Returns all email autoresponders registered under the cPanel account associated with domain."""
        res = self._api_get(domain, "Email", "list_auto_responders")
        if res.get("status") == 1:
            data = res.get("data", [])
            persistence = self._load_persistence()
            # Merge persisted data if present
            for item in data:
                email = item.get("email")
                if email in persistence:
                    p_data = persistence[email]
                    item["from"] = p_data.get("from_name", "")
                    item["interval"] = p_data.get("interval", 8)
                    item["start"] = p_data.get("start_date") or 0
                    item["stop"] = p_data.get("stop_date") or 0
                    item["body"] = p_data.get("body", "")
                    item["is_html"] = p_data.get("is_html", False)
                else:
                    # Fallback default if not in local persistence but returned by cPanel API
                    # UAPI typically returns html: 1 or 0
                    html_val = item.get("html")
                    item["is_html"] = html_val == 1 or html_val == "1"
            return {
                "success": True,
                "data": data
            }
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def add_forwarder(self, domain, source_email, dest_email):
        """Creates a new email forwarder: source_email -> dest_email."""
        data = {
            "email": source_email.split("@")[0],
            "domain": source_email.split("@")[1] if "@" in source_email else domain,
            "fwdopt": "fwd",
            "fwdemail": dest_email,
        }
        res = self._api_post(domain, "Email", "add_forwarder", data)
        if res.get("status") == 1:
            return {"success": True}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def delete_forwarder(self, domain, source_email, dest_email):
        """Deletes an email forwarder by source and destination address."""
        data = {
            "address": source_email,
            "forwarder": dest_email,
        }
        res = self._api_post(domain, "Email", "delete_forwarder", data)
        if res.get("status") == 1:
            return {"success": True}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def delete_autoresponder(self, domain, email):
        """Deletes an autoresponder by email address and updates local persistence."""
        local, at_domain = (email.split("@") + [""])[:2]
        data = {
            "email": local,
            "domain": at_domain or domain
        }
        res = self._api_post(domain, "Email", "delete_auto_responder", data)
        if res.get("status") == 1:
            try:
                persistence = self._load_persistence()
                if email in persistence:
                    del persistence[email]
                    self._save_persistence(persistence)
            except Exception as e:
                logger.error(f"Failed to delete autoresponder from local persistence: {e}")
            return {"success": True}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def modify_autoresponder(self, domain, email, subject, body, from_name="", interval=8, is_html=False, start_type="now", start_date=None, stop_type="never", stop_date=None):
        """Modifies an existing autoresponder with full cPanel field support.
        
        start_type: 'now' or 'date'
        stop_type: 'never' or 'date'
        start_date / stop_date: epoch timestamp (int) when type is 'date'
        """
        local, at_domain = (email.split("@") + [""])[:2]
        data = {
            "email": local,
            "domain": at_domain or domain,
            "subject": subject,
            "body": body,
            "from": from_name,
            "interval": str(interval),
            "charset": "utf-8",
            "is_html": "1" if is_html else "0",
        }

        # Start configuration
        if start_type == "date" and start_date:
            try:
                data["start"] = str(int(float(start_date)))
            except (ValueError, TypeError):
                data["start"] = "0"
        else:
            data["start"] = "0"  # 0 = immediate

        # Stop configuration
        if stop_type == "date" and stop_date:
            try:
                stop_val = int(float(stop_date))
                data["stop"] = str(stop_val)
            except (ValueError, TypeError):
                stop_val = 0
                data["stop"] = "0"
        else:
            stop_val = 0
            data["stop"] = "0"  # 0 = never

        # Track start value to persist
        if start_type == "date" and start_date:
            try:
                start_val = int(float(start_date))
            except (ValueError, TypeError):
                start_val = 0
        else:
            start_val = 0

        res = self._api_post(domain, "Email", "add_auto_responder", data)
        if res.get("status") == 1:
            try:
                persistence = self._load_persistence()
                persistence[email] = {
                    "from_name": from_name,
                    "interval": interval,
                    "start_date": start_val,
                    "stop_date": stop_val,
                    "body": body,
                    "is_html": is_html
                }
                self._save_persistence(persistence)
            except Exception as e:
                logger.error(f"Failed to save autoresponder local persistence: {e}")
            return {"success": True}
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

    def get_autoresponder(self, domain, email):
        """Fetches the details of a single autoresponder, including body, directly from cPanel."""
        res = self._api_get(domain, "Email", "get_auto_responder", {"email": email})
        if res.get("status") == 1:
            data = res.get("data", {})
            is_html_val = data.get("is_html")
            is_html_bool = (is_html_val == 1 or is_html_val == "1" or is_html_val is True)
            
            try:
                persistence = self._load_persistence()
                
                def safe_int(v, default=0):
                    if v is None or v == "":
                        return default
                    try:
                        return int(float(v))
                    except (ValueError, TypeError):
                        return default

                persistence[email] = {
                    "from_name": data.get("from", ""),
                    "interval": safe_int(data.get("interval"), 8),
                    "start_date": safe_int(data.get("start"), 0),
                    "stop_date": safe_int(data.get("stop"), 0),
                    "body": data.get("body", ""),
                    "is_html": is_html_bool
                }
                self._save_persistence(persistence)
            except Exception as e:
                logger.error(f"Failed to sync autoresponder local persistence: {e}")
                
            return {
                "success": True,
                "data": {
                    "email": email,
                    "from": data.get("from", ""),
                    "subject": data.get("subject", ""),
                    "body": data.get("body", ""),
                    "interval": int(data.get("interval", 8)),
                    "is_html": is_html_bool,
                    "start": data.get("start", "0"),
                    "stop": data.get("stop", "0")
                }
            }
        return {"success": False, "errors": res.get("errors", ["Unknown UAPI error"])}

