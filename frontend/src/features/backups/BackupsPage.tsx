import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabOption } from '@/components/ui/Tabs';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import { BackupJobItem } from '@/types/domain';
import {
  Database,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  Search,
  Filter,
  Copy,
  Check,
  Download,
  Terminal,
  Cloud,
  HardDrive,
  Server,
  Layers,
  WrapText,
  Shield,
  Info,
  FolderGit2,
  ExternalLink,
  Activity,
  Cpu,
  Clock,
  Radio,
  Pause,
} from 'lucide-react';

export const BackupsPage: React.FC = () => {
  const [items, setItems] = useState<BackupJobItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidateMessage, setRevalidateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLazarusInfo, setShowLazarusInfo] = useState<boolean>(true);

  // Real-time Active Processes Sentinel State
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [isLiveMonitoring, setIsLiveMonitoring] = useState<boolean>(true);
  const [lastMonitorTick, setLastMonitorTick] = useState<Date>(new Date());
  const [isRefreshingJobs, setIsRefreshingJobs] = useState<boolean>(false);

  // Modal Log State
  const [selectedJob, setSelectedJob] = useState<BackupJobItem | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [logSearch, setLogSearch] = useState<string>('');
  const [logFileName, setLogFileName] = useState<string>('');
  const [wrapLog, setWrapLog] = useState<boolean>(true);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  const fetchActiveJobs = async () => {
    try {
      setIsRefreshingJobs(true);
      const res = await api.getActiveJobs();
      setActiveJobs(Array.isArray(res) ? res : []);
      setLastMonitorTick(new Date());
    } catch (e) {
      console.error('Erro ao consultar processos ativos de backup:', e);
    } finally {
      setIsRefreshingJobs(false);
    }
  };

  const loadData = async () => {
    try {
      setError(null);
      const res = await api.getValidationStatus();
      if (res?.backups?.volumes && Array.isArray(res.backups.volumes) && res.backups.volumes.length > 5) {
        setItems(res.backups.volumes);
      } else {
        setItems([]);
      }
      await fetchActiveJobs();
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar validação de volumes de backup.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time process polling
  useEffect(() => {
    if (!isLiveMonitoring) return;
    const interval = setInterval(() => {
      fetchActiveJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isLiveMonitoring]);

  const handleInspectLog = async (job: BackupJobItem) => {
    setSelectedJob(job);
    setIsLoadingLog(true);
    setLogContent('');
    setLogSearch('');
    setLogFileName('');
    try {
      const res = await api.getJobLog(job.job_id);
      if (res) {
        setLogContent((res as any).log_content || (res as any).content || 'Nenhum conteúdo de log disponível para esta rotina.');
        setLogFileName((res as any).file || (res as any).filename || `${job.job_id}.log`);
      }
    } catch (err: any) {
      setLogContent(`Erro ao carregar log: ${err.message || 'Arquivo não encontrado'}`);
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleCopyTarget = (target: string, id: string) => {
    navigator.clipboard.writeText(target);
    setCopiedTarget(id);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  const handleCopyLog = () => {
    navigator.clipboard.writeText(logContent);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const handleDownloadLog = () => {
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFileName || `${selectedJob?.job_id || 'backup'}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRevalidate = async () => {
    try {
      setIsRevalidating(true);
      setRevalidateMessage(null);
      const res = await api.triggerRevalidation();
      setRevalidateMessage(res.message || 'Re-validação de integridade iniciada com sucesso!');
      await loadData();
      await fetchActiveJobs();
    } catch (err: any) {
      setRevalidateMessage(`Erro na re-validação: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setIsRevalidating(false);
    }
  };

  const nominalCount = useMemo(() => items.filter((i) => i.status === 'NOMINAL').length, [items]);
  const warningCount = useMemo(() => items.filter((i) => i.status === 'ATENÇÃO').length, [items]);

  const filterTabs: TabOption[] = [
    { id: 'all', label: 'Todos os Volumes', count: items.length },
    { id: 'nominal', label: 'Nominal / Validado', count: nominalCount },
    { id: 'warning', label: 'Alertas / Lazarus', count: warningCount },
    { id: 'cloud', label: 'Nuvem (OneDrive)', count: items.filter((i) => (i.target_cloud || '').includes('OneDrive')).length },
    { id: 'special', label: 'Físico / VMs / Bancos', count: items.filter((i) => !(i.target_cloud || '').includes('OneDrive')).length },
  ];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status & Tier Filtering
      if (filter === 'nominal' && item.status !== 'NOMINAL') return false;
      if (filter === 'warning' && item.status !== 'ATENÇÃO') return false;
      if (filter === 'cloud' && !(item.target_cloud || '').includes('OneDrive')) return false;
      if (filter === 'special' && (item.target_cloud || '').includes('OneDrive')) return false;

      // Search Filtering
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.volume_name.toLowerCase().includes(q) ||
          item.job_id.toLowerCase().includes(q) ||
          (item.source_path || '').toLowerCase().includes(q) ||
          (item.target_cloud || '').toLowerCase().includes(q) ||
          (item.details || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  const filteredLogLines = useMemo(() => {
    if (!logContent) return '';
    if (!logSearch.trim()) return logContent;
    const q = logSearch.toLowerCase();
    const lines = logContent.split('\n');
    const matched = lines.filter((l) => l.toLowerCase().includes(q));
    if (matched.length === 0) return `Nenhuma linha encontrada para o filtro: "${logSearch}"`;
    return matched.join('\n');
  }, [logContent, logSearch]);

  const columns: Column<BackupJobItem>[] = [
    {
      key: 'volume_name',
      header: 'Volume Departamental & Origem',
      sortable: true,
      render: (item) => (
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0 mt-0.5">
            <FolderGit2 className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
              {item.volume_name}
            </span>
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate block">
              {item.job_id} • {item.source_path}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'target_cloud',
      header: 'Destino na Nuvem (Microsoft Graph / Repositório)',
      render: (item) => {
        const targetStr = item.target_cloud || '';
        const isAlessandro = targetStr.includes('Alessandro');
        const isAlex = targetStr.includes('Alex');
        const isUsb = targetStr.includes('USB') || targetStr.includes('Air-Gap') || targetStr.includes('AEGIS');
        const isNas = targetStr.includes('StorageNASVault') || targetStr.includes('Kopia') || targetStr.includes('Hyper-V');
        const isDatasul = targetStr.includes('Totvs') || targetStr.includes('SQL');
        return (
          <div className="flex items-center gap-2 max-w-md">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isAlessandro && <Badge variant="info" size="sm">OneDrive Alessandro</Badge>}
                {isAlex && <Badge variant="neutral" size="sm">OneDrive Alex</Badge>}
                {isUsb && <Badge variant="success" size="sm">USB Air-Gap (Local)</Badge>}
                {isNas && <Badge variant="info" size="sm">NAS WD (Kopia VM)</Badge>}
                {isDatasul && <Badge variant="neutral" size="sm">Totvs SQL Dump</Badge>}
                {!isAlessandro && !isAlex && !isUsb && !isNas && !isDatasul && (
                  <Badge variant="success" size="sm">Repositório Central</Badge>
                )}
              </div>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate block mt-0.5" title={item.target_cloud}>
                {item.target_cloud}
              </span>
            </div>
            <button
              onClick={() => handleCopyTarget(targetStr, item.job_id)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors shrink-0"
              title="Copiar destino de sincronização"
            >
              {copiedTarget === item.job_id ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status de Integridade & Validação',
      render: (item) => {
        const isWarning = item.status === 'ATENÇÃO';
        const detailsStr = item.details || '';
        const isLazarus = detailsStr.includes('Lazarus') || detailsStr.includes('caminhos longos');
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Badge variant={isWarning ? 'warning' : 'success'} size="sm">
                {item.status}
              </Badge>
              {isLazarus && (
                <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded font-mono text-[9px] font-bold">
                  LAZARUS PROTOCOL
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              {item.details}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Auditoria de Logs',
      render: (item) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleInspectLog(item)}
          className="cursor-pointer text-xs group hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all"
        >
          <Terminal className="w-3.5 h-3.5 mr-1.5 text-sky-500 group-hover:scale-110 transition-transform" />
          Ver Log
        </Button>
      ),
    },
  ];

  if (isLoading) return <LoadingState message="Carregando matriz de backups, logs Rclone e integridade Kopia..." />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <PageContainer
      title="Matriz de Backups SRE 2026"
      subtitle="Auditoria contínua e governança da tríade híbrida: Nuvem (OneDrive via Rclone), Físico (USB via Rsync) e VMs (Kopia)."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar Tabela
          </Button>
          <Button
            size="sm"
            onClick={handleRevalidate}
            isLoading={isRevalidating}
            className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Disparar Re-validação
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Top Summary Triad Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Nuvem (OneDrive / Rclone)</span>
                <Cloud className="w-4 h-4 text-sky-500" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-slate-900 dark:text-white">
                22 Diretórios
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Sincronização departamental contínua via Microsoft Graph API com Lazarus Guard.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>RPO: 24h</span>
              <span>RTO: ~20h</span>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Local Físico (Discos USB Air-Gap)</span>
                <HardDrive className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                Rsync & Shannon Entropy
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Proteção Ransomware com Shannon &lt; 0.8 e isolamento físico pós-execução (AEGIS v2.1).
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>RPO: 24h</span>
              <span>RTO: 4h</span>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Virtualização (Kopia Snapshots)</span>
                <Server className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                Hyper-V Deduplicado
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Snapshots incrementais deduplicados de VMs salvos no NAS StorageNASVault SSHFS.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>RPO: 24h</span>
              <span>RTO: 2h</span>
            </div>
          </Card>
        </div>

        {/* Revalidate Notification Banner */}
        {revalidateMessage && (
          <div className="p-3 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 text-xs rounded-xl flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
              <span>{revalidateMessage}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRevalidateMessage(null)}>Fechar</Button>
          </div>
        )}

        {/* Lazarus Protocol Explanation Alert Banner */}
        {showLazarusInfo && warningCount > 0 && (
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs flex items-start justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Protocolo Lazarus de Proteção Ativo</span>
                  <Badge variant="warning" size="sm">{warningCount} Volumes Afetados</Badge>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed max-w-4xl">
                  O Windows e a API do OneDrive impõem uma restrição máxima de <strong>260 caracteres (MAX_PATH)</strong>. Em volumes corporativos com estruturas profundas (como <em>Engenharia-FA</em>, <em>Contabilidade</em> e <em>COMEX</em>), o motor de backup SRE empacota esses arquivos longos no arquivo <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">00_RECUPERACAO_CAMINHOS_LONGOS.tar.gz</code>, assegurando 100% de integridade sem abortar o sincronismo na nuvem.
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowLazarusInfo(false)} className="text-amber-600 dark:text-amber-400 shrink-0">
              Dispensar
            </Button>
          </div>
        )}

        {/* Real-time Backup Sentinel (Live Process Monitor) */}
        <Card className="bg-slate-900 border border-slate-700/60 dark:border-slate-800 shadow-sm overflow-hidden text-slate-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                {activeJobs.length > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-sky-400 shrink-0" />
                  Monitor de Processos em Tempo Real (Live Sentinel)
                </span>
                {activeJobs.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {activeJobs.length} PROCESSO(S) ATIVO(S)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    STANDBY OPERACIONAL • SRE SENTINEL ATIVO
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs self-end sm:self-auto">
              <span className="text-slate-400 text-[11px] font-mono">
                {lastMonitorTick.toLocaleTimeString()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsLiveMonitoring(!isLiveMonitoring)}
                className="text-xs h-7 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                title={isLiveMonitoring ? 'Pausar polling ao vivo' : 'Retomar polling ao vivo (3s)'}
              >
                {isLiveMonitoring ? (
                  <>
                    <Pause className="w-3 h-3 mr-1 text-amber-400" />
                    Pausar (3s)
                  </>
                ) : (
                  <>
                    <Radio className="w-3 h-3 mr-1 text-emerald-400" />
                    Ao Vivo
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchActiveJobs}
                isLoading={isRefreshingJobs}
                className="text-xs h-7 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="mt-3">
            {activeJobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeJobs.map((job: any, idx: number) => (
                  <div
                    key={job.pid || idx}
                    className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="info" size="sm">
                          {job.engine || 'Backup Worker'}
                        </Badge>
                        <span className="font-mono text-xs text-sky-400 font-bold">
                          PID: {job.pid}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                        {job.cpu_percent !== undefined && (
                          <span className="flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded">
                            <Cpu className="w-2.5 h-2.5 text-slate-300" />
                            {job.cpu_percent}% CPU
                          </span>
                        )}
                        <span className="flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded">
                          <Clock className="w-2.5 h-2.5 text-slate-300" />
                          {job.duration_seconds}s
                        </span>
                        <span className="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                          {job.user}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80 overflow-x-auto truncate">
                      {job.script}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      Nenhum processo de backup em execução neste instante
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Os motores Rclone (Nuvem), Rsync (USB Air-Gap) e Kopia (VMs) estão em repouso nominal aguardando os horários programados.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800 shrink-0">
                  <span className="flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5 text-sky-400" /> 18:00 Nuvem
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Sex 18:00 USB
                  </span>
                  <span className="flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-indigo-400" /> 23:00 VMs
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <Tabs tabs={filterTabs} activeTab={filter} onChange={setFilter} />
          <div className="w-full sm:w-72">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por volume, path ou cloud..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Volumes Table */}
        <DataTable
          keyExtractor={(item) => item.job_id}
          columns={columns}
          data={filteredItems}
          emptyMessage="Nenhum volume encontrado com os filtros atuais."
        />

        {/* Log Inspection Modal */}
        <Modal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title={`Log de Operação: ${selectedJob?.volume_name || ''} (${selectedJob?.job_id || ''})`}
          className="max-w-4xl max-h-[88vh]"
        >
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-500" />
                <span className="font-mono text-xs text-slate-600 dark:text-slate-400 font-bold">
                  {logFileName || `${selectedJob?.job_id}.log`}
                </span>
                <Badge variant={selectedJob?.status === 'ATENÇÃO' ? 'warning' : 'success'} size="sm">
                  {selectedJob?.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWrapLog(!wrapLog)}
                  className="text-xs cursor-pointer"
                  title="Alternar quebra de linha"
                >
                  <WrapText className="w-3.5 h-3.5 mr-1" />
                  {wrapLog ? 'Sem quebra' : 'Quebrar linha'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDownloadLog}
                  className="text-xs cursor-pointer"
                  title="Baixar arquivo de log"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLog}
                  className="text-xs cursor-pointer"
                >
                  {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedLog ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>

            {/* In-log search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar dentro deste log (ex: ERROR, Transferred, Duration, Lazarus)..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {isLoadingLog ? (
              <div className="py-8">
                <LoadingState message="Lendo arquivo de log do servidor em tempo real..." />
              </div>
            ) : (
              <div
                className={`p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-xl max-h-[55vh] overflow-auto border border-slate-800 select-text leading-relaxed shadow-inner ${
                  wrapLog ? 'whitespace-pre-wrap' : 'whitespace-pre'
                }`}
              >
                {filteredLogLines}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" onClick={() => setSelectedJob(null)} className="cursor-pointer">
                Fechar Log
              </Button>
            </div>
          </div>
        </Modal>

      </div>
    </PageContainer>
  );
};
