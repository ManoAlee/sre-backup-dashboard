import { BitdefenderOverview, QuarantineItem, InventoryItem, IncidentItem } from '@/types/bitdefender';

export const fetchBitdefenderOverview = async (): Promise<BitdefenderOverview> => {
  const response = await fetch('/api/bitdefender/overview');
  if (!response.ok) {
    throw new Error('Falha ao carregar visão geral do Bitdefender');
  }
  return response.json();
};

export const fetchBitdefenderQuarantine = async (): Promise<{ timestamp: string; total: number; items: QuarantineItem[] }> => {
  const response = await fetch('/api/bitdefender/quarantine');
  if (!response.ok) {
    throw new Error('Falha ao carregar itens da quarentena');
  }
  return response.json();
};

export const fetchBitdefenderInventory = async (): Promise<{ timestamp: string; total: number; items: InventoryItem[] }> => {
  const response = await fetch('/api/bitdefender/inventory');
  if (!response.ok) {
    throw new Error('Falha ao carregar inventário do Bitdefender');
  }
  return response.json();
};

export const fetchBitdefenderIncidents = async (): Promise<{ timestamp: string; total: number; items: IncidentItem[] }> => {
  const response = await fetch('/api/bitdefender/incidents');
  if (!response.ok) {
    throw new Error('Falha ao carregar incidentes do Bitdefender');
  }
  return response.json();
};

export const triggerBitdefenderSync = async (): Promise<any> => {
  const response = await fetch('/api/bitdefender/sync', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Falha ao disparar sincronização com Bitdefender');
  }
  return response.json();
};
