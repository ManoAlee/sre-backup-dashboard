export type HealthStatusType = 'healthy' | 'warning' | 'danger' | 'unknown';

export interface SystemRealtime {
  os?: string;
  cpu_percent?: number;
  cpu_count?: number;
  memory_percent?: number;
  memory_used_gb?: number;
  memory_total_gb?: number;
  disk_percent?: number;
  disk_used_gb?: number;
  disk_total_gb?: number;
  uptime_days?: number;
  load_avg?: number[];
  timestamp?: string;
}

export interface PrintersResponse {
  printers: any[];
}

export interface RevalidateResponse {
  status: string;
  message?: string;
}

export interface CloudAccountInfo {
  remote_name: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent_used: number;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  details?: string;
}

export interface CloudQuota {
  provider: string;
  account_count?: number;
  accounts?: CloudAccountInfo[];
  total_bytes?: number;
  used_bytes?: number;
  free_bytes?: number;
  total_gb?: number;
  used_gb?: number;
  free_gb?: number;
  trash?: number;
  details?: string;
  percent_used?: number;
  status: string;
}

export interface DiskMount {
  device: string;
  mount_point: string;
  fstype: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent_used: number;
}

export interface BackupJobItem {
  job_id: string;
  volume_name: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'RUNNING' | 'NOMINAL' | 'FAIL' | 'ATENÇÃO' | 'ERRO';
  last_run?: string;
  duration_sec?: number;
  size_bytes?: number;
  source_path?: string;
  target_cloud?: string;
  details?: string;
}

export interface DomainHealthItem {
  domain: string;
  dns_ok: boolean;
  ssl_ok: boolean;
  ssl_expiry_days?: number;
  spf_ok: boolean;
  dkim_ok: boolean;
  dmarc_ok: boolean;
  overall_status: 'healthy' | 'warning' | 'danger';
}

export interface SambaShare {
  name: string;
  path: string;
  comment?: string;
  read_only?: boolean;
  valid_users?: string[];
  acl_count?: number;
}

export interface ValidationStatusResponse {
  cloud?: CloudQuota;
  disk?: DiskMount[];
  paths?: Record<string, boolean>;
  vm?: { status: string; last_run?: string; count?: number };
  backups?: {
    volumes?: BackupJobItem[];
    total_volumes?: number;
    total_count?: number;
    nominal_count?: number;
    warning_count?: number;
    error_count?: number;
    health_score?: number;
  };
  system?: {
    total_backups?: number;
    success_rate?: number;
    last_validation?: string;
  };
  status?: string;
}
