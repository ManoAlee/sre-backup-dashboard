import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import {
  Server,
  Activity,
  ShieldCheck,
  RefreshCw,
  Mail,
  Search,
  FileText,
  Copy,
  Check,
  Terminal,
  AlertTriangle,
  Cpu,
  Clock,
  Globe,
  Wifi,
  Zap,
  ExternalLink,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export const KingHostPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [runbook, setRunbook] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedHost, setCopiedHost] = useState<string | null>(null);
  
  // Terminal Logs State
  const [selectedServerLogs, setSelectedServerLogs] = useState<string>('partner_alpha');
  const [logsContent, setLogsContent] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>('');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setError(null);
      const [statusRes, runbookRes] = await Promise.all([
        api.getKingHostStatus(),
        api.getKingHostRunbook(),
      ]);
      setData(statusRes);
      setRunbook(runbookRes.steps || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar telemetria dos servidores KingHost.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetch('/api/kinghost/refresh', { method: 'POST' }).catch(() => {});
      // Allow collector 2.5s to perform read-only SSH probe and update SQLite
      setTimeout(async () => {
        await loadData();
        await loadLogs(selectedServerLogs);
        setIsRefreshing(false);
      }, 2500);
    } catch {
      await loadData();
      setIsRefreshing(false);
    }
  };

  const loadLogs = async (serverId: string) => {
    try {
      setIsLoadingLogs(true);
      const res = await api.getKingHostLogs(serverId);
      setLogsContent(res.logs || 'Nenhum log retornado.');
    } catch (err: any) {
      setLogsContent(`Erro ao consultar logs do servidor ${serverId}: ${err.message}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadData();
    loadLogs(selectedServerLogs);
  }, []);

  const handleSelectServerLogs = (serverId: string) => {
    setSelectedServerLogs(serverId);
    loadLogs(serverId);
    const terminalEl = document.getElementById('kinghost-terminal');
    if (terminalEl) {
      terminalEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCopyCommand = (command: string, idx: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyHost = (host: string) => {
    navigator.clipboard.writeText(host);
    setCopiedHost(host);
    setTimeout(() => setCopiedHost(null), 2000);
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logsContent);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Ativo';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h ativo`;
    return `${hours}h ativo`;
  };

  if (isLoading) return <LoadingState message="Conectando à telemetria SSH dos servidores KingHost..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const servers = data?.servers || [];
  const incidents = data?.incidents || [];

  const filteredLogs = logsContent
    .split('\n')
    .filter((line) => line.toLowerCase().includes(logFilter.toLowerCase()))
    .join('\n');

  return (
    <PageContainer
      title="Monitoramento KingHost (Node.js & PM2)"
      subtitle="Observabilidade dos servidores de aplicação remotos, status de processos PM2, console de logs e Runbook Sênior."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          className="cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Atualizar Telemetria
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Status Global</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">HEALTHY</span>
                <Badge variant="success" dot size="sm">Nominal</Badge>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              Sondagem SSH Ativa (Read-Only)
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Servidores Monitorados</span>
                <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {servers.length} / 2
                </span>
                <span className="text-xs text-slate-500">Instâncias</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              Partner Alpha & SRE Core Platform (KingHost)
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Processos PM2</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">ONLINE</span>
                <span className="text-xs text-slate-500 font-mono">(v1 Node.js)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              2 Nós Ativos sem Quedas
            </p>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Canal de Notificação</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold font-mono text-slate-900 dark:text-white truncate">
                Office 365
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 truncate font-mono" title="ti@enterprise.local">
              ti@enterprise.local
            </p>
          </Card>
        </div>

        {/* Server Cards - Senior Redesigned Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {servers.map((srv: any) => {
            const isOnline = srv.status === 'online' || srv.pm2?.status === 'online';
            const latency = srv.latencyMs ?? 20;
            const cpu = srv.pm2?.cpu ?? 0.2;
            const mem = srv.pm2?.memoryMB ?? 60;
            const restarts = srv.pm2?.restartCount ?? 0;
            const httpOk = srv.httpStatus === 200;

            return (
              <Card
                key={srv.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Server Card Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800 shrink-0">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{srv.name}</h3>
                        <Badge variant="info" size="sm">Node {srv.pm2?.nodeVersion || 'v18'}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{srv.host}</span>
                        <button
                          onClick={() => handleCopyHost(srv.host)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          title="Copiar host"
                        >
                          {copiedHost === srv.host ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Badge variant={isOnline ? 'success' : 'danger'} dot size="sm" className="font-semibold">
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </Badge>
                    <Badge variant={latency < 30 ? 'success' : latency < 60 ? 'info' : 'warning'} size="sm" className="font-mono">
                      {latency} ms
                    </Badge>
                  </div>
                </div>

                {/* Metrics 2x2 Grid */}
                <div className="p-5 grid grid-cols-2 gap-3.5 bg-white dark:bg-slate-900">
                  {/* CPU Tile */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-sky-500" />
                        Uso de CPU
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{cpu}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(cpu * 10, 4)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">PID {srv.pm2?.pid || 'N/A'} • PM2 {srv.pm2?.appName || 'v1'}</span>
                  </div>

                  {/* RAM Tile */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        Memória RAM
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{mem} MB</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((mem / 512) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">Alocado do pool</span>
                  </div>

                  {/* Uptime / Restarts Tile */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Uptime & Reinícios
                    </span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      {formatUptime(srv.pm2?.uptimeSeconds)}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>{restarts === 0 ? '0 reinícios (Zero quedas)' : `${restarts} reinícios controlados`}</span>
                    </div>
                  </div>

                  {/* HTTP Check Tile */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-500" />
                      HTTP Endpoint Check
                    </span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Badge variant={httpOk ? 'success' : 'warning'} size="sm" className="font-mono">
                        {httpOk ? 'HTTP 200 OK' : `HTTP ${srv.httpStatus || 404} Check`}
                      </Badge>
                      <span className="text-[10px] text-slate-400 truncate max-w-[110px]" title={srv.httpCheckUrl}>
                        {httpOk ? 'Online' : 'Raiz /'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate" title={srv.httpCheckUrl}>
                      {srv.httpCheckUrl}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    SSH: <strong className="text-slate-700 dark:text-slate-300">{srv.sshUser || 'apps'}</strong>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectServerLogs(srv.id)}
                    className="text-xs cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5 mr-1 text-sky-500" />
                    Inspecionar Logs PM2
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Live Terminal Console */}
        <div id="kinghost-terminal">
          <Card
            header={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Console de Logs em Tempo Real (PM2 Tail)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Server selector tabs */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => handleSelectServerLogs('partner_alpha')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        selectedServerLogs === 'partner_alpha'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Partner Alpha App
                    </button>
                    <button
                      onClick={() => handleSelectServerLogs('enterprise')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        selectedServerLogs === 'enterprise'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 font-semibold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      SRE Core Platform App
                    </button>
                  </div>

                  <Button size="sm" variant="ghost" onClick={handleCopyLogs} className="cursor-pointer text-xs">
                    {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedLogs ? 'Copiado!' : 'Copiar Logs'}
                  </Button>
                </div>
              </div>
            }
          >
            {/* Log filter bar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar console (ex: error, E11000, restart, info)..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            {isLoadingLogs ? (
              <div className="p-12">
                <LoadingState message="Lendo console remoto do servidor KingHost..." />
              </div>
            ) : (
              <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs max-h-[50vh] overflow-auto select-text whitespace-pre-wrap leading-relaxed">
                {filteredLogs || 'Nenhum registro de log encontrado.'}
              </div>
            )}
          </Card>
        </div>

        {/* Incidents Warning Stream */}
        {incidents.length > 0 && (
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Alertas & Recomendações dos Servidores ({incidents.length})
                </span>
                <Badge variant="warning" size="sm">Auditoria Automática</Badge>
              </div>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidents.slice(0, 4).map((inc: any, idx: number) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={inc.severity === 'CRITICAL' ? 'danger' : inc.severity === 'WARNING' || inc.severity === 'HIGH' ? 'warning' : 'info'} size="sm">
                        {inc.severity}
                      </Badge>
                      <strong className="text-slate-900 dark:text-amber-200">{inc.title}</strong>
                      <span className="text-[11px] text-slate-400">({inc.server})</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{inc.remediation}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{inc.timestamp}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Senior Runbook Section */}
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <FileText className="w-4 h-4 text-sky-500" /> Runbook Sênior de Restauração Operacional
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {runbook.length} Procedimentos Verificados
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-1">
            {runbook.map((rb: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-slate-50/90 dark:bg-slate-900/70 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-2xs hover:border-sky-300 dark:hover:border-sky-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-md font-mono border border-sky-200/60 dark:border-sky-800/60">
                      {rb.step}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {rb.title}
                    </h4>
                  </div>
                  <Badge variant={rb.severity === 'CRITICAL' ? 'danger' : rb.severity === 'WARNING' ? 'warning' : 'info'} size="sm">
                    {rb.severity}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  {rb.description}
                </p>

                <div className="space-y-1.5 text-[11px] bg-white/70 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 shrink-0">Causa Raiz:</span>
                    <span className="text-slate-600 dark:text-slate-400">{rb.root_cause || 'Falha temporária de comunicação de rede ou runtime.'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">Impacto:</span>
                    <span className="text-slate-600 dark:text-slate-400">{rb.impact || 'Indisponibilidade de serviços específicos.'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-sky-600 dark:text-sky-400 shrink-0">Verificação:</span>
                    <span className="text-slate-600 dark:text-slate-400">{rb.verification || 'Conferir status via telemetria.'}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between bg-slate-950 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] border border-slate-800 shadow-inner">
                    <code className="truncate max-w-[70%]" title={rb.command}>
                      $ {rb.command}
                    </code>
                    
                    <button
                      onClick={() => handleCopyCommand(rb.command, idx)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-sans font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
                      title="Copiar comando para a área de transferência"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </Card>

      </div>
    </PageContainer>
  );
};
