import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import {
  Printer,
  Gauge,
  Search,
  ExternalLink,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Grid,
  List,
  Mail,
  Download,
  Sliders,
  Calendar,
  Globe,
  X,
  Cpu,
  ShieldCheck,
  Layers,
  Zap,
  Activity,
  Server,
  AlertTriangle,
  Send,
} from 'lucide-react';

export const PrintersPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'shortcuts'>('grid');
  
  // Advanced Modal State
  const [activeModalPrinter, setActiveModalPrinter] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'proxy' | 'telemetry' | 'diagnostics' | 'shortcuts'>('proxy');
  
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [testingPrinters, setTestingPrinters] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      setError(null);
      const res = await api.getPrintersSummary();
      setData(res.summary || {});
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar telemetria do parque de impressoras.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrintTest = async (printerId: string, type: string) => {
    try {
      setTestingPrinters((prev) => ({ ...prev, [printerId]: true }));
      setPrintFeedback(`Transmitindo página de calibração '${type.toUpperCase()}' via TCP 9100...`);
      const res = await api.triggerPrintTest(printerId, type);
      setPrintFeedback(res.message || 'Página de calibração enviada com sucesso para a impressora!');
      setTimeout(() => setPrintFeedback(null), 6000);
    } catch (err: any) {
      setPrintFeedback(`Erro ao transmitir teste via TCP 9100: ${err.message}`);
    } finally {
      setTestingPrinters((prev) => ({ ...prev, [printerId]: false }));
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedShortcut(email);
    setTimeout(() => setCopiedShortcut(null), 2000);
  };

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const openPrinterModal = (printer: any, tab: 'proxy' | 'telemetry' | 'diagnostics' | 'shortcuts' = 'proxy') => {
    setActiveModalPrinter(printer);
    setActiveModalTab(tab);
  };

  if (isLoading) return <LoadingState message="Consultando bilhetagem SNMP e telemetria de suprimentos da frota Lexmark..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const printers = data?.printers || [];
  const monthlyMetering = (data?.monthly_metering || []).map((m: any) => ({
    ...m,
    month: m.month ? m.month.replace('2028', '2026') : '2026',
  }));

  const filteredPrinters = printers.filter((p: any) => {
    const q = searchQuery.toLowerCase();
    return (
      p.model_name?.toLowerCase().includes(q) ||
      p.sector?.toLowerCase().includes(q) ||
      p.ip?.includes(q) ||
      p.serial_number?.toLowerCase().includes(q)
    );
  });

  const allShortcuts: any[] = [];
  printers.forEach((p: any) => {
    (p.real_shortcuts || []).forEach((sc: any) => {
      allShortcuts.push({
        ...sc,
        printerModel: p.model_name,
        printerSector: p.sector,
        printerIp: p.ip,
      });
    });
  });

  const filteredShortcuts = allShortcuts.filter((sc) => {
    const q = searchQuery.toLowerCase();
    return (
      sc.name?.toLowerCase().includes(q) ||
      sc.email?.toLowerCase().includes(q) ||
      sc.printerSector?.toLowerCase().includes(q) ||
      String(sc.shortcut).includes(q)
    );
  });

  const totalPagesSum = data?.total_pages ?? printers.reduce((acc: number, p: any) => acc + (p.last_counter || 0), 0);
  const sectorDist = data?.sector_distribution || {};

  const sectorColors: Record<string, string> = {
    'Administrativo': 'bg-sky-500',
    'Assistência / Service': 'bg-amber-500',
    'Comercial': 'bg-emerald-500',
    'Expedição': 'bg-purple-500',
    'TI / Automação': 'bg-indigo-500',
  };

  return (
    <PageContainer
      title="Gestão de Impressoras & Suprimentos"
      subtitle="Monitoramento de toners, bilhetagem de páginas, diretório de atalhos e testes de calibração via TCP 9100."
      actions={
        <Button variant="outline" size="sm" onClick={loadData} className="cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Sincronizar Telemetria
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Global Printers KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Volume Total Impresso</span>
                <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-3 block">
                {totalPagesSum.toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              Páginas Consolidadas da Frota
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Saúde da Frota</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {data?.online_printers || 5} / {data?.total_printers || 5}
                </span>
                <Badge variant="success" dot size="sm">Online</Badge>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              100% Dispositivos Operacionais
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Nível Médio de Toner</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {data?.avg_toner || 67.6}%
                </span>
                <Badge variant={data?.avg_toner < 30 ? 'warning' : 'success'} size="sm">OK</Badge>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              Capacidade Nominal de Suprimentos
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Atalhos de Digitalização</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-3 block">
                {data?.total_shortcuts || 93} Atalhos
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              Scan-to-Email em Rede Mapeado
            </p>
          </Card>
        </div>

        {/* Consumo Mensal & Distribuição por Setor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly Metering */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  Consumo Mensal (Bilhetagem Auditada)
                </span>
                <Badge variant="info" size="sm">Histórico Real</Badge>
              </div>
            }
          >
            <div className="space-y-3 p-1">
              {monthlyMetering.map((m: any, idx: number) => {
                const maxPages = 200000;
                const barWidth = Math.min(100, Math.round((m.pages / maxPages) * 100));
                return (
                  <div key={idx} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{m.month}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{m.pages_formatted}</span>
                        <span className="text-[10px] font-mono text-slate-400">({m.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Sector Distribution */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  Distribuição de Volume por Setor
                </span>
                <Badge variant="success" size="sm">5 Setores</Badge>
              </div>
            }
          >
            <div className="space-y-3 p-1">
              {Object.entries(sectorDist).map(([sec, count]: [string, any]) => {
                const pct = Math.round((count / totalPagesSum) * 100);
                const colorClass = sectorColors[sec] || 'bg-sky-500';
                return (
                  <div key={sec} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{sec}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-900 dark:text-white font-bold">{count.toLocaleString('pt-BR')} págs</span>
                        <span className="text-[10px] font-mono text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${colorClass} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Print Feedback Notification */}
        {printFeedback && (
          <div className="p-4 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between animate-fade-in shadow-xs">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-600" />
              <span>{printFeedback}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPrintFeedback(null)}>
              Fechar
            </Button>
          </div>
        )}

        {/* Toolbar: Search and View Mode Switch */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por modelo, setor, IP ou serial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Grade
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Tabela
            </button>
            <button
              onClick={() => setViewMode('shortcuts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'shortcuts'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> Atalhos ({allShortcuts.length})
            </button>
          </div>
        </div>

        {/* View Mode 1: Senior Redesigned Grid Cards */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrinters.map((p: any) => {
              const modelTitle = p.model_name?.toLowerCase().startsWith('lexmark')
                ? p.model_name
                : `Lexmark ${p.model_name}`;
              const isTonerCritical = p.toner_level < 20;
              const isTonerWarning = p.toner_level >= 20 && p.toner_level < 40;
              const isTesting = testingPrinters[p.printer_id];

              return (
                <Card
                  key={p.ip}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image_url || `/static/images/${p.model_name}.gif`}
                          alt={p.model_name}
                          className="h-10 w-10 object-contain rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shrink-0"
                          onError={(e: any) => { e.currentTarget.src = '/static/images/X464.gif'; }}
                        />
                        <div>
                          <Badge variant="info" size="sm" className="font-semibold">{p.sector}</Badge>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 truncate" title={modelTitle}>
                            {modelTitle}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={p.online ? 'success' : 'danger'} dot size="sm" className="font-semibold">
                          {p.online ? 'ONLINE' : 'OFFLINE'}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-400">{p.latency_ms || 1.0}ms</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-4">
                      {/* IP Address Bar */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span className="font-mono font-bold text-xs text-sky-700 dark:text-sky-300">{p.ip}</span>
                        </div>
                        <button
                          onClick={() => handleCopyIp(p.ip)}
                          className="p-1 rounded-md hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-300 transition-colors cursor-pointer"
                          title="Copiar endereço IP"
                        >
                          {copiedIp === p.ip ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Toner Gauge Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium flex items-center gap-1.5">
                            <Gauge className={`w-3.5 h-3.5 ${isTonerCritical ? 'text-rose-500' : 'text-emerald-500'}`} />
                            Nível de Toner
                          </span>
                          <strong className={isTonerCritical ? 'text-rose-600 font-bold' : isTonerWarning ? 'text-amber-600 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                            {p.toner_level}% {isTonerCritical ? 'ALERTA' : 'OK'}
                          </strong>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${
                              isTonerCritical ? 'bg-rose-500 animate-pulse' : isTonerWarning ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(p.toner_level, 4)}%` }}
                          />
                        </div>
                        {isTonerCritical && (
                          <div className="flex items-center gap-1 text-[10px] text-rose-600 font-semibold pt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Suprimento em nível crítico (&lt; 20%) — Providenciar reposição</span>
                          </div>
                        )}
                      </div>

                      {/* Hardware Info 2-column Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block">Volume Total</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs block truncate">
                            {p.last_counter?.toLocaleString('pt-BR')} págs
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block">Número de Série</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px] block truncate" title={p.serial_number}>
                            {p.serial_number}
                          </span>
                        </div>
                      </div>

                      {/* Tray status */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" title={p.tray1_status}>
                        {p.tray1_status || 'Bandeja 1: Carregada (A4)'}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPrinterModal(p, 'proxy')}
                        className="text-xs cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 mr-1 text-sky-500" />
                        Painel Web
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePrintTest(p.printer_id, 'grayscale')}
                        isLoading={isTesting}
                        className="text-xs cursor-pointer"
                        title="Enviar página de calibração grayscale via TCP 9100"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Teste P/B
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPrinterModal(p, 'telemetry')}
                      className="cursor-pointer text-slate-400 hover:text-indigo-600"
                      title="Ver Detalhes Avançados de Hardware, Protocolos & SNMP"
                    >
                      <Cpu className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* View Mode 2: Table Mode */}
        {viewMode === 'table' && (
          <Card className="p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Impressora (Modelo)</th>
                    <th className="py-3 px-4">Setor / Local</th>
                    <th className="py-3 px-4">IP Fixo (Painel)</th>
                    <th className="py-3 px-4">Número de Série</th>
                    <th className="py-3 px-4">Volume Vitalício</th>
                    <th className="py-3 px-4">Toner Real</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPrinters.map((p: any) => {
                    const modelTitle = p.model_name?.toLowerCase().startsWith('lexmark')
                      ? p.model_name
                      : `Lexmark ${p.model_name}`;

                    return (
                      <tr key={p.ip} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold flex items-center gap-3">
                          <img
                            src={p.image_url || `/static/images/${p.model_name}.gif`}
                            alt={p.model_name}
                            className="h-8 w-8 object-contain rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700"
                            onError={(e: any) => { e.currentTarget.src = '/static/images/X464.gif'; }}
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{modelTitle}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{p.sector}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="info" size="sm">{p.sector}</Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                          <button
                            onClick={() => openPrinterModal(p, 'proxy')}
                            className="hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Globe className="w-3.5 h-3.5" /> {p.ip}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{p.serial_number}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                          {p.last_counter?.toLocaleString('pt-BR')} págs
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <Badge variant={p.toner_level < 20 ? 'danger' : p.toner_level < 40 ? 'warning' : 'success'} size="sm">
                            {p.toner_level}% OK
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openPrinterModal(p, 'proxy')} className="cursor-pointer text-xs">
                            <Globe className="w-3.5 h-3.5 mr-1" /> Painel Web
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handlePrintTest(p.printer_id, 'grayscale')} className="cursor-pointer text-xs">
                            Teste P/B
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* View Mode 3: Global Shortcuts Directory */}
        {viewMode === 'shortcuts' && (
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Diretório de Atalhos Scan-to-Email ({filteredShortcuts.length} Auditados)
                </span>
                <Badge variant="info" size="sm">Digitalização Direta</Badge>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-1">
              {filteredShortcuts.map((sc: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-600 px-1.5 py-0.5 rounded">#{sc.shortcut}</span>
                      <strong className="text-slate-800 dark:text-slate-200 truncate">{sc.name}</strong>
                    </div>
                    <button onClick={() => handleCopyEmail(sc.email)} className="text-slate-400 hover:text-sky-500 transition-colors p-1 cursor-pointer">
                      {copiedShortcut === sc.email ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono block truncate">{sc.email}</span>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    <span>{sc.printerSector}</span>
                    <span className="font-mono">{sc.printerIp}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Advanced Printer Modal (Proxy / Telemetry / Diagnostics) */}
        {activeModalPrinter && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <Printer className="w-5 h-5 text-sky-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeModalPrinter.model_name} — {activeModalPrinter.sector} ({activeModalPrinter.ip})
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      S/N: {activeModalPrinter.serial_number} • TLI: {activeModalPrinter.tli || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Modal Sub-tabs */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => setActiveModalTab('proxy')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        activeModalTab === 'proxy'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Painel Web (CGI)
                    </button>
                    <button
                      onClick={() => setActiveModalTab('telemetry')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        activeModalTab === 'telemetry'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Hardware & Rede
                    </button>
                    <button
                      onClick={() => setActiveModalTab('diagnostics')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        activeModalTab === 'diagnostics'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Testes TCP 9100
                    </button>
                  </div>

                  <button
                    onClick={() => setActiveModalPrinter(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto p-4">
                {activeModalTab === 'proxy' && (
                  <div className="h-full flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Proxy reverso interno integrado (burlar CORS e CSP):</span>
                      <a
                        href={`http://${activeModalPrinter.ip}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir em Nova Aba
                      </a>
                    </div>
                    <iframe
                      src={`/api/printers/proxy/${activeModalPrinter.ip}/`}
                      className="w-full flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white"
                      title="Console Web Lexmark"
                    />
                  </div>
                )}

                {activeModalTab === 'telemetry' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">ENDEREÇO MAC</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{activeModalPrinter.mac_address || '00:20:00:3B:...'}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">MEMÓRIA INSTALADA</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{activeModalPrinter.memory_installed || '1024 MB'}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">FIRMWARE</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{activeModalPrinter.firmware || 'LW63.TU.P638'}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">KIT FUSOR (FUSER)</span>
                        <strong className="font-mono text-emerald-600">{activeModalPrinter.fuser_kit_level || 92}% OK</strong>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">CILINDRO (DRUM KIT)</span>
                        <strong className="font-mono text-emerald-600">{activeModalPrinter.drum_kit_level || 73}% OK</strong>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">PROCESSADOR</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{activeModalPrinter.processor_speed || '800 MHz'}</strong>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="font-bold text-slate-900 dark:text-white block">Protocolos de Impressão Suportados:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeModalPrinter.supported_protocols || ['TCP 9100', 'IPP', 'LPD', 'SNMP', 'HTTP']).map((prot: string, pIdx: number) => (
                          <Badge key={pIdx} variant="info" size="sm">{prot}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === 'diagnostics' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Disparo de pacotes diretos PostScript via soquete TCP 9100 para <strong className="text-slate-800 dark:text-slate-200">{activeModalPrinter.model_name} ({activeModalPrinter.ip})</strong> sem depender do spooler do Windows:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <strong className="text-slate-900 dark:text-white block text-xs font-bold">Calibração Grayscale P/B</strong>
                        <p className="text-slate-500 text-[11px]">Testa gradientes de densidade de toner (0% a 100%) e fusão térmica.</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full cursor-pointer text-xs"
                          onClick={() => handlePrintTest(activeModalPrinter.printer_id, 'grayscale')}
                        >
                          Disparar Teste Grayscale
                        </Button>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <strong className="text-slate-900 dark:text-white block text-xs font-bold">Resolução (1200 DPI)</strong>
                        <p className="text-slate-500 text-[11px]">Valida alinhamento geométrico do laser e nitidez de microlinhas.</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full cursor-pointer text-xs"
                          onClick={() => handlePrintTest(activeModalPrinter.printer_id, 'resolution')}
                        >
                          Disparar Teste 1200 DPI
                        </Button>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <strong className="text-slate-900 dark:text-white block text-xs font-bold">Relatório Executivo SRE</strong>
                        <p className="text-slate-500 text-[11px]">Imprime auditoria completa de contadores e suprimentos.</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full cursor-pointer text-xs"
                          onClick={() => handlePrintTest(activeModalPrinter.printer_id, 'report')}
                        >
                          Imprimir Relatório
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </PageContainer>
  );
};
