import sys
from datetime import datetime, timezone
from sslyze import Scanner, ServerScanRequest, ServerNetworkLocation, ServerScanStatusEnum, ScanCommandAttemptStatusEnum

def test_scan(hostname):
    print(f"Scanning {hostname}...")
    try:
        scan_request = ServerScanRequest(server_location=ServerNetworkLocation(hostname=hostname))
    except Exception as e:
        print(f"Error creating scan request: {e}")
        return

    scanner = Scanner()
    scanner.queue_scans([scan_request])
    
    for result in scanner.get_results():
        if result.scan_status == ServerScanStatusEnum.ERROR_NO_CONNECTIVITY:
            print(f"Connectivity error: {result.connectivity_error_trace}")
            return
        
        scan_result = result.scan_result
        cert_attempt = scan_result.certificate_info
        if cert_attempt.status == ScanCommandAttemptStatusEnum.COMPLETED:
            cert_result = cert_attempt.result
            for deployment in cert_result.certificate_deployments:
                leaf_cert = deployment.received_certificate_chain[0]
                not_after = leaf_cert.not_valid_after_utc
                days_left = (not_after - datetime.now(timezone.utc)).days
                subject = leaf_cert.subject.rfc4514_string()
                issuer = leaf_cert.issuer.rfc4514_string()
                print(f"Subject: {subject}")
                print(f"Issuer: {issuer}")
                print(f"Days left: {days_left}")
        else:
            print("Certificate scan command failed")

if __name__ == "__main__":
    test_scan("enterprise.local")
