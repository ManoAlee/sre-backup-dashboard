import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Server,
  AlertTriangle,
  FileCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  FileCode,
  Mail,
  HardDrive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  fetchBitdefenderOverview,
  fetchBitdefenderQuarantine,
  fetchBitdefenderInventory,
  fetchBitdefenderIncidents,
  triggerBitdefenderSync,
} from '@/services/bitdefenderService';
import { QuarantineItem, InventoryItem, IncidentItem, BitdefenderOverview } from '@/types/bitdefender';

export const BitdefenderPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'quarantine' | 'inventory' | 'incidents'>('quarantine');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Pagination for Quarantine
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const [overview, setOverview] = useState<BitdefenderOverview | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);

  const loadData = async (forceSync = false) => {
    try {
      setLoading(true);
      if (forceSync) {
        setSyncing(true);
        await triggerBitdefenderSync();
      }
      const [ovData, qData, invData, incData] = await Promise.all([
        fetchBitdefenderOverview(),
        fetchBitdefenderQuarantine(),
        fetchBitdefenderInventory(),
        fetchBitdefenderIncidents(),
      ]);

      setOverview(ovData);
      setQuarantine(qData.items || []);
      setInventory(invData.items || []);
      setIncidents(incData.items || []);
    } catch (err) {
      console.error('Erro ao carregar dados do Bitdefender:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const healthScore = overview?.summary?.security_health_score ?? overview?.health_score ?? 90;
  const isHealthy = healthScore >= 80;

  // Categorize quarantine items
  const categoryStats = useMemo(() => {
    let phishing = 0;
    let scripts = 0;
    let devLogs = 0;
    let others = 0;

    quarantine.forEach((item) => {
      const path = (item.details?.filePath || '').toLowerCase();
      const threat = (item.threatName || '').toLowerCase();

      if (path.includes('antigravity') || path.includes('scratch') || path.includes('transcript')) {
        devLogs++;
      } else if (threat.includes('phishing') || path.includes('outlook') || path.includes('olk')) {
        phishing++;
      } else if (threat.includes('script') || threat.includes('vbs') || threat.includes('heur') || path.includes('.ps1') || path.includes('.vbs')) {
        scripts++;
      } else {
        others++;
      }
    });

    return { phishing, scripts, devLogs, others };
  }, [quarantine]);

  // Filtered quarantine items
  const filteredQuarantine = useMemo(() => {
    return quarantine.filter((item) => {
      const path = (item.details?.filePath || '').toLowerCase();
      const threat = (item.threatName || '').toLowerCase();
      const endpoint = (item.endpointName || '').toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = path.includes(term) || threat.includes(term) || endpoint.includes(term);

      if (!matchesSearch) return false;

      if (selectedCategory === 'devLogs') {
        return path.includes('antigravity') || path.includes('scratch') || path.includes('transcript');
      }
      if (selectedCategory === 'phishing') {
        return threat.includes('phishing') || path.includes('outlook') || path.includes('olk');
      }
      if (selectedCategory === 'scripts') {
        return threat.includes('script') || threat.includes('vbs') || threat.includes('heur') || path.includes('.ps1') || path.includes('.vbs');
      }
      if (selectedCategory === 'others') {
        const isDev = path.includes('antigravity') || path.includes('scratch') || path.includes('transcript');
        const isPhish = threat.includes('phishing') || path.includes('outlook') || path.includes('olk');
        const isScript = threat.includes('script') || threat.includes('vbs') || threat.includes('heur') || path.includes('.ps1') || path.includes('.vbs');
        return !isDev && !isPhish && !isScript;
      }

      return true;
    });
  }, [quarantine, searchTerm, selectedCategory]);

  // Paginated quarantine
  const totalPages = Math.ceil(filteredQuarantine.length / itemsPerPage) || 1;
  const paginatedQuarantine = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuarantine.slice(start, start + itemsPerPage);
  }, [filteredQuarantine, currentPage, itemsPerPage]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const ip = (item.ip || '').toLowerCase();
      const os = (item.operatingSystem || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || ip.includes(term) || os.includes(term);
    });
  }, [inventory, searchTerm]);

  return (
    <PageContainer
      title="Bitdefender GravityZone"
      subtitle="Central de observabilidade de segurança endpoint, inventário de ativos e análise de quarentena."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            isLoading={syncing}
            className="cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Sincronizar API
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(false)}
            isLoading={loading && !syncing}
            className="cursor-pointer"
          >
            Atualizar
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Health Score Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Score de Segurança
              </CardTitle>
              {isHealthy ? (
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tracking-tight ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {healthScore}%
                </span>
                <span className="text-xs text-slate-500 font-medium">Conformidade EDR</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quarantine Card */}
          <Card
            className={`bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-2xs ${activeSubTab === 'quarantine' ? 'border-amber-500 dark:border-amber-500/80 ring-1 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            onClick={() => setActiveSubTab('quarantine')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Itens em Quarentena
              </CardTitle>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {overview?.summary?.total_quarantine ?? quarantine.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Ameaças isoladas pelo agente</p>
            </CardContent>
          </Card>

          {/* Inventory Card */}
          <Card
            className={`bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-2xs ${activeSubTab === 'inventory' ? 'border-sky-500 dark:border-sky-500/80 ring-1 ring-sky-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            onClick={() => setActiveSubTab('inventory')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Endpoints Ativos
              </CardTitle>
              <Server className="w-5 h-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {overview?.summary?.total_inventory ?? inventory.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Servidores e estações monitoradas</p>
            </CardContent>
          </Card>

          {/* Incidents Card */}
          <Card
            className={`bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-2xs ${activeSubTab === 'incidents' ? 'border-rose-500 dark:border-rose-500/80 ring-1 ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            onClick={() => setActiveSubTab('incidents')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Incidentes Abertos
              </CardTitle>
              <Activity className="w-5 h-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {overview?.summary?.total_incidents ?? incidents.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">Anomalias ativas não resolvidas</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown (Visible in Quarantine view) */}
        {activeSubTab === 'quarantine' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => { setSelectedCategory('devLogs'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedCategory === 'devLogs' ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Dev & Sandbox Logs</span>
                <FileCode className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{categoryStats.devLogs}</div>
              <span className="text-[10px] text-slate-400">Ambiente de teste isolado</span>
            </button>

            <button
              onClick={() => { setSelectedCategory('phishing'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedCategory === 'phishing' ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tentativas Phishing</span>
                <Mail className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{categoryStats.phishing}</div>
              <span className="text-[10px] text-slate-400">Anexos de e-mail retidos</span>
            </button>

            <button
              onClick={() => { setSelectedCategory('scripts'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedCategory === 'scripts' ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Scripts & Heurística</span>
                <Terminal className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{categoryStats.scripts}</div>
              <span className="text-[10px] text-slate-400">Bloqueios de execução</span>
            </button>

            <button
              onClick={() => { setSelectedCategory('all'); setCurrentPage(1); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Todos os Itens</span>
                <HardDrive className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{quarantine.length}</div>
              <span className="text-[10px] text-slate-400">Volume total retido</span>
            </button>
          </div>
        )}

        {/* Main Content Card with Navigation Tabs */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="border-b border-slate-200 dark:border-slate-800 px-6 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              {/* Tabs */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setActiveSubTab('quarantine'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeSubTab === 'quarantine' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Quarentena ({quarantine.length})
                </button>
                <button
                  onClick={() => { setActiveSubTab('inventory'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeSubTab === 'inventory' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Inventário ({inventory.length})
                </button>
                <button
                  onClick={() => { setActiveSubTab('incidents'); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeSubTab === 'incidents' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Incidentes ({incidents.length})
                </button>
              </div>

              {/* Search Box */}
              <div className="w-full sm:w-72">
                <Input
                  placeholder="Pesquisar ameaça, arquivo, IP..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  icon={<Search className="w-3.5 h-3.5" />}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {loading && !syncing ? (
              <div className="p-12">
                <LoadingState message="Consultando API do Bitdefender GravityZone..." />
              </div>
            ) : (
              <>
                {/* QUARANTINE VIEW */}
                {activeSubTab === 'quarantine' && (
                  <div>
                    {filteredQuarantine.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 text-xs">
                        Nenhum item em quarentena corresponde aos filtros informados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-4">Ameaça Detectada</th>
                              <th className="p-4">Origem / Endpoint</th>
                              <th className="p-4">Caminho do Arquivo (Path)</th>
                              <th className="p-4">Data do Bloqueio</th>
                              <th className="p-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {paginatedQuarantine.map((item, idx) => {
                              const filePath = item.details?.filePath || item.filePath || 'Desconhecido';
                              const isDev = filePath.toLowerCase().includes('antigravity');
                              return (
                                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="p-4">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      <ShieldAlert className={`w-4 h-4 shrink-0 ${isDev ? 'text-sky-500' : 'text-amber-500'}`} />
                                      <span className="font-mono text-[11px]">{item.threatName || 'Ameaça Genérica'}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                      {isDev ? 'Sandbox de Teste' : 'Heurística Ativa'}
                                    </span>
                                  </td>
                                  <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                                    {item.endpointName || 'CORE-DATA-01'}
                                  </td>
                                  <td className="p-4 max-w-xs xl:max-w-md">
                                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate block" title={filePath}>
                                      {filePath}
                                    </span>
                                  </td>
                                  <td className="p-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                    {item.quarantinedOn ? item.quarantinedOn.replace('T', ' ') : 'N/A'}
                                  </td>
                                  <td className="p-4 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => handleCopyPath(filePath)}
                                      className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                      title="Copiar Caminho do Arquivo"
                                    >
                                      {copiedPath === filePath ? (
                                        <Check className="w-4 h-4 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                            <div>
                              Exibindo {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredQuarantine.length)} de {filteredQuarantine.length} itens
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                className="cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </Button>
                              <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                                {currentPage} / {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                className="cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* INVENTORY VIEW */}
                {activeSubTab === 'inventory' && (
                  <div className="overflow-x-auto">
                    {filteredInventory.length === 0 ? (
                      <div className="p-12 text-center text-slate-500 text-xs">
                        Nenhum endpoint encontrado com os filtros atuais.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-4">Nome do Endpoint</th>
                            <th className="p-4">Endereço IP</th>
                            <th className="p-4">Sistema Operacional</th>
                            <th className="p-4">Status do Agente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredInventory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-mono">
                                <Server className="w-4 h-4 text-sky-500 shrink-0" />
                                {item.name || 'Servidor/Estação'}
                              </td>
                              <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                                {item.ip || '192.168.1.x'}
                              </td>
                              <td className="p-4 text-slate-500 font-medium">
                                {item.operatingSystem || 'Windows Server / Linux'}
                              </td>
                              <td className="p-4">
                                <Badge variant="success" dot className="text-xs font-semibold">
                                  Control Center Ativo
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* INCIDENTS VIEW */}
                {activeSubTab === 'incidents' && (
                  <div className="p-6">
                    {incidents.length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <FileCheck className="w-12 h-12 text-sky-500 mx-auto" />
                        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Zero Incidentes EDR/XDR em Aberto</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          A análise heurística comportamental do Bitdefender GravityZone não detectou anomalias ativas ou movimentações laterais não contidas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {incidents.map((inc, idx) => (
                          <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-left">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{inc.description || 'Incidente de Segurança'}</span>
                              <Badge variant="danger">{inc.severity || 'CRÍTICO'}</Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 font-mono">{inc.timestamp || 'Recentemente'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};
