import {
  ValidationStatusResponse,
  DomainHealthItem,
  PrintersResponse,
  RevalidateResponse,
  SambaShare,
} from '../types/domain';

const API_BASE_URL = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options?.headers,
      },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Telemetry & Infrastructure
  public getValidationStatus(): Promise<ValidationStatusResponse> {
    return this.request<ValidationStatusResponse>('/validation_status');
  }

  public getSchedules(): Promise<any[]> {
    return this.request<any[]>('/schedules');
  }

  public getNetworkNodes(): Promise<any[]> {
    return this.request<any[]>('/network/nodes');
  }

  public getSystemRealtime(): Promise<any> {
    return this.request<any>('/system/realtime');
  }

  public runSpeedtest(): Promise<any> {
    return this.request<any>('/network/speedtest', {
      method: 'POST',
    });
  }

  // Applications SRE Monitoring
  public getApplicationsStatus(): Promise<any> {
    return this.request<any>('/applications/status');
  }

  // Printers
  public getPrinters(): Promise<PrintersResponse> {
    return this.request<PrintersResponse>('/printers');
  }

  public getPrintersSummary(): Promise<any> {
    return this.request<any>('/printers');
  }

  public printTestPage(ip: string): Promise<any> {
    return this.request<any>('/printers/test', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
  }

  public triggerPrintTest(printerId: string, type: string): Promise<any> {
    return this.request<any>('/printers/test', {
      method: 'POST',
      body: JSON.stringify({ printer_id: printerId, type }),
    });
  }

  // KingHost Monitoring
  public getKingHostStatus(): Promise<any> {
    return this.request<any>('/kinghost/status');
  }

  public getKingHostRunbook(): Promise<any> {
    return this.request<any>('/kinghost/runbook');
  }

  public executeKingHostRunbook(step: string, command: string): Promise<any> {
    return this.request<any>('/kinghost/runbook/execute', {
      method: 'POST',
      body: JSON.stringify({ step, command }),
    });
  }

  public getKingHostLogs(serverId: string): Promise<any> {
    return this.request<any>(`/kinghost/logs/${serverId}`);
  }

  // Backups
  public triggerRevalidation(): Promise<RevalidateResponse> {
    return this.request<RevalidateResponse>('/revalidate', {
      method: 'POST',
    });
  }

  public getJobLog(jobId: string): Promise<{ job_id: string; log_content: string; file?: string }> {
    return this.request<{ job_id: string; log_content: string; file?: string }>(`/job_log/${jobId}`);
  }

  public getActiveJobs(): Promise<any[]> {
    return this.request<any[]>('/jobs/active');
  }

  // Domains
  public getDomainHealth(): Promise<Record<string, DomainHealthItem>> {
    return this.request<Record<string, DomainHealthItem>>('/domain/health');
  }

  public triggerMxCheck(domain: string): Promise<any> {
    return this.request<any>('/domain/trigger-mx', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  }

  // Samba
  public getSambaShares(refresh = false): Promise<SambaShare[]> {
    return this.request<SambaShare[]>(`/samba/shares${refresh ? '?refresh=1' : ''}`);
  }

  public getSambaShareDetails(shareName: string): Promise<any> {
    return this.request<any>(`/samba/details?share=${encodeURIComponent(shareName)}`);
  }

  public getSambaUsers(refresh = false): Promise<any[]> {
    return this.request<any[]>(`/samba/users${refresh ? '?refresh=1' : ''}`);
  }

  public getSambaGroups(refresh = false): Promise<any[]> {
    return this.request<any[]>(`/samba/groups${refresh ? '?refresh=1' : ''}`);
  }

  public getSambaAccessMap(): Promise<any> {
    return this.request<any>('/samba/access-map');
  }

  public getShareAcls(path: string): Promise<any> {
    return this.request<any>(`/samba/share-acls?path=${encodeURIComponent(path)}`);
  }

  // Reports & Docs
  public getDocsList(): Promise<any> {
    return this.request<any>('/docs/list');
  }

  public getDocContent(path: string, type: string): Promise<any> {
    return this.request<any>(`/docs/content?path=${encodeURIComponent(path)}&type=${encodeURIComponent(type)}`);
  }
}

export const api = new ApiClient();
