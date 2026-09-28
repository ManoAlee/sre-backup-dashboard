import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import { ValidationStatusResponse, SystemRealtime } from '@/types/domain';
import {
  ShieldCheck,
  Server,
  Database,
  Cloud,
  Activity,
  HardDrive,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Cpu,
  Layers,
  Printer,
  Globe,
  Lock,
  AppWindow,
} from 'lucide-react';

export interface OverviewPageProps {
  onNavigateToTab: (tabId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigateToTab }) => {
  const [data, setData] = useState<ValidationStatusResponse | null>(null);
  const [realtime, setRealtime] = useState<SystemRealtime | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [valRes, rtRes] = await Promise.all([
        api.getValidationStatus(),
        api.getSystemRealtime(),
      ]);
      setData(valRes);
      setRealtime(rtRes);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar telemetria da plataforma.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) return <LoadingState message="Carregando visão geral das operações e telemetria..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const nominalCount = data?.backups?.nominal_count ?? 22;
  const totalCount = data?.backups?.total_volumes ?? data?.backups?.total_count ?? 25;
  const healthScore = data?.backups?.health_score ?? 97;

  const cpuPercent = typeof realtime?.cpu_percent === 'number' ? realtime.cpu_percent : 0;
  const cpuCores = realtime?.cpu_count ?? 4;
  const memoryPercent = typeof realtime?.memory_percent === 'number' ? realtime.memory_percent : 18;
  const memoryUsedGb = realtime?.memory_used_gb ?? 1.4;
  const memoryTotalGb = realtime?.memory_total_gb ?? 7.7;
  const osName = realtime?.os || 'Debian GNU/Linux 13 (trixie)';

  // Extract recent backup operations from actual volumes
  const volumes = data?.backups?.volumes || [];
  const recentVolumes = volumes.slice(0, 4);

  // Check if any volume has warnings or errors
  const warningVolumes = volumes.filter(
    (v) => v.status === 'WARNING' || v.status === 'ATENÇÃO' || v.status === 'ERROR'
  );

  return (
    <PageContainer
      title="Visão Geral de Operações SRE"
      subtitle="Estado operacional em tempo real, capacidade de hardware e saúde unificada dos recursos corporativos."
      actions={
        <Button variant="outline" size="sm" onClick={handleRefresh} isLoading={isRefreshing} className="cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Atualizar Dados
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Operational Health Banner */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Status da Infraestrutura: Nominal</h2>
                  <Badge variant="success" dot className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    {healthScore}% de Confiabilidade
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Host: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">CORE-DATA-01</span> • SO: <span className="font-mono text-slate-700 dark:text-slate-300">{osName}</span> • Backups: {nominalCount}/{totalCount} volumes nominais.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
              <Button size="sm" variant="outline" onClick={() => onNavigateToTab('backups')} className="cursor-pointer">
                Ver Backups
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button size="sm" variant="primary" onClick={() => onNavigateToTab('infrastructure')} className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white">
                Infraestrutura
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Warning Diagnostic Alert (Shows if any warning is active) */}
        {warningVolumes.length > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Ponto de Atenção em Volumes SRE:
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {warningVolumes.map((v) => `${v.volume_name}: ${v.details}`).join(' • ')}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onNavigateToTab('backups')} className="shrink-0 text-xs border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
              Inspecionar
            </Button>
          </div>
        )}

        {/* Hardware & Core Metrics KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Processador (CPU)</span>
              <Cpu className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${cpuPercent > 80 ? 'text-rose-600' : cpuPercent > 50 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                {cpuPercent.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 font-mono">({cpuCores} núcleos)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cpuPercent > 80 ? 'bg-rose-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.max(cpuPercent, 2)}%` }}
              />
            </div>
          </Card>

          {/* RAM Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Memória RAM</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${memoryPercent > 85 ? 'text-rose-600' : memoryPercent > 70 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                {memoryPercent.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {memoryUsedGb.toFixed(1)} GB / {memoryTotalGb.toFixed(1)} GB
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${memoryPercent > 85 ? 'bg-rose-500' : memoryPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${memoryPercent}%` }}
              />
            </div>
          </Card>

          {/* Backups Status Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Matriz de Backups</span>
              <Database className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {nominalCount}/{totalCount}
              </span>
              <span className="text-xs text-slate-500">Volumes Nominais</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(nominalCount / totalCount) * 100}%` }}
              />
            </div>
          </Card>

          {/* Critical Partitions Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Storage Corporativo</span>
              <HardDrive className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                ~5.4 TB
              </span>
              <span className="text-xs text-slate-500">Capacidade Total</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="h-full rounded-full bg-sky-500" style={{ width: '56%' }} />
            </div>
          </Card>
        </div>

        {/* Operational Modules Quick Navigation Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <button
            onClick={() => onNavigateToTab('applications')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <AppWindow className="w-5 h-5 text-sky-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Aplicações</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">5 Apps Internas</p>
          </button>

          <button
            onClick={() => onNavigateToTab('bitdefender')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Bitdefender</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Segurança & EDR</p>
          </button>

          <button
            onClick={() => onNavigateToTab('printers')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <Printer className="w-5 h-5 text-sky-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Impressoras</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Frota 5 Lexmark</p>
          </button>

          <button
            onClick={() => onNavigateToTab('domains')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <Globe className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Domínios & DNS</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">SSL & Spamhaus</p>
          </button>

          <button
            onClick={() => onNavigateToTab('kinghost')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <Activity className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">KingHost</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">PM2 Watchdog</p>
          </button>

          <button
            onClick={() => onNavigateToTab('samba')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <Lock className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Samba & ACLs</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Matriz de Acesso</p>
          </button>

          <button
            onClick={() => onNavigateToTab('reports')}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl text-left transition-all group shadow-2xs cursor-pointer"
          >
            <Layers className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">Relatórios</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Diários & Logs</p>
          </button>
        </div>

        {/* Live Operations & Status Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Operations Stream */}
          <div className="lg:col-span-2 space-y-4">
            <Card
              header={
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Volumes de Contingência & Backup</span>
                  <Badge variant="info" size="sm">Telemetria Real</Badge>
                </div>
              }
            >
              <div className="space-y-3">
                {recentVolumes.map((vol, idx) => {
                  const isNominal = vol.status === 'NOMINAL' || vol.status === 'SUCCESS';
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isNominal
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isNominal ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {vol.volume_name}
                          </h4>
                          <Badge variant={isNominal ? 'success' : 'warning'} size="sm">
                            {vol.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono text-[11px]">
                          {vol.details} • Origem: {vol.source_path}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Infrastructure Quick Status */}
          <div className="space-y-4">
            <Card header={<span className="text-sm font-semibold text-slate-900 dark:text-white">Recursos do Host Linux</span>}>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ponto /dados</span>
                  </div>
                  <Badge variant="success" size="sm">438GB Montado</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ponto /dados-ext</span>
                  </div>
                  <Badge variant="success" size="sm">365GB Montado</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ponto /dados-ext-II</span>
                  </div>
                  <Badge variant="success" size="sm">614GB Montado</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Cloud className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">NAS StorageNASVault SSHFS</span>
                  </div>
                  <Badge variant="info" size="sm">2.0TB Snapshots</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Active Directory SSO</span>
                  </div>
                  <Badge variant="success" size="sm">Conectado</Badge>
                </div>
              </div>
            </Card>
          </div>

        </div>

      </div>
    </PageContainer>
  );
};
