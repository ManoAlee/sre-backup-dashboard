export interface BitdefenderSummary {
  total_inventory: number;
  total_quarantine: number;
  total_incidents: number;
  security_health_score: number;
}

export interface BitdefenderOverview {
  status: string;
  timestamp: string;
  summary: BitdefenderSummary;
  health_score: number;
}

export interface QuarantineItem {
  endpointName?: string;
  endpointIP?: string;
  threatName?: string;
  quarantinedOn?: string;
  details?: {
    filePath?: string;
    hash?: string;
  };
  [key: string]: any;
}

export interface InventoryItem {
  id?: string;
  name?: string;
  ip?: string;
  operatingSystem?: string;
  agentStatus?: string;
  lastSeen?: string;
  [key: string]: any;
}

export interface IncidentItem {
  id?: string;
  type?: string;
  severity?: string;
  description?: string;
  timestamp?: string;
  [key: string]: any;
}
