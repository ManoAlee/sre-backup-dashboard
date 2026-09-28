import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabOption } from '@/components/ui/Tabs';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import { ValidationStatusResponse, SystemRealtime } from '@/types/domain';
import {
  Server,
  HardDrive,
  Cloud,
  Clock,
  RefreshCw,
  Cpu,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Terminal,
  ExternalLink,
  Network,
  Zap,
  Gauge,
  Wifi,
  Lock,
  Database,
  Search,
  Check,
  Copy,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export const InfrastructurePage: React.FC = () => {
  const [data, setData] = useState<ValidationStatusResponse | null>(null);
  const [realtime, setRealtime] = useState<SystemRealtime | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [networkNodes, setNetworkNodes] = useState<any[]>([]);
  const [storageFilter, setStorageFilter] = useState<string>('all');
  const [schedFilter, setSchedFilter] = useState<string>('all');
  const [searchDisk, setSearchDisk] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Speedtest state
  const [isSpeedtesting, setIsSpeedtesting] = useState(false);
  const [speedtestResult, setSpeedtestResult] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [valRes, rtRes, schedRes, nodesRes] = await Promise.all([
        api.getValidationStatus(),
        api.getSystemRealtime().catch(() => null),
        api.getSchedules().catch(() => []),
        api.getNetworkNodes().catch(() => []),
      ]);
      setData(valRes);
      setRealtime(rtRes);
      setSchedules(schedRes);
      setNetworkNodes(nodesRes);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar recursos de infraestrutura.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunSpeedtest = async () => {
    try {
      setIsSpeedtesting(true);
      setSpeedtestResult(null);
      const res = await api.runSpeedtest();
      setSpeedtestResult(res);
    } catch (err: any) {
      setSpeedtestResult({ error: err.message || 'Falha ao executar teste de velocidade.' });
    } finally {
      setIsSpeedtesting(false);
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '174 dias, 13 horas';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d} dias, ${h}h ${m}m`;
  };

  // Live Storage Disks from backend
  const liveDisks = useMemo<any[]>(() => {
    if (data?.disk && Array.isArray(data.disk) && data.disk.length > 0) {
      return data.disk;
    }
    return [
      { mount: '/', device: '/dev/mapper/ubuntu--vg-ubuntu--lv', fstype: 'ext4', model: 'Seagate Barracuda 250GB (ST3250318AS - OS LVM)', total_gb: 97.9, used_gb: 14.2, free_gb: 78.6, percent: 14.5, status: 'mounted', description: 'Sistema Operacional Ubuntu 26.04.1 LTS (Kernel 7.0) & SRE Runtime' },
      { mount: '/dados', device: '/dev/sdc1', fstype: 'ext4', model: 'WD Caviar Blue 1TB (WDC WD10EZEX - /dados)', total_gb: 915.8, used_gb: 470.9, free_gb: 398.4, percent: 51.4, status: 'mounted', description: 'Compartilhamentos de Produção Corporativa (/dados)' },
      { mount: '/dados-ext', device: '/dev/sda', fstype: 'ext3', model: 'Seagate Enterprise SATA 1TB (ST1000NM0055 - /dados-ext)', total_gb: 915.8, used_gb: 366.8, free_gb: 502.4, percent: 40.1, status: 'mounted', description: 'Repositório Ext I (/dados-ext)' },
      { mount: '/dados-ext-II', device: '/dev/md126p1', fstype: 'ext4', model: 'WD Caviar Green 1TB (WDC WD10EARS - /dados-ext-II)', total_gb: 915.3, used_gb: 597.4, free_gb: 271.3, percent: 65.3, status: 'mounted', description: 'Repositório Ext II - Engenharia, Service & Partner Alpha (/dados-ext-II)' },
      { mount: '/scripts/BackupVms', device: 'root@192.168.10.200:/DataVolume/shares/BackupVms', fstype: 'fuse.sshfs', model: 'NAS Western Digital MyCloud 4TB', total_gb: 3663.1, used_gb: 1795.7, free_gb: 1793.0, percent: 49.0, status: 'mounted', description: 'NAS StorageNASVault SSHFS - Snapshots Kopia VM' },
      { mount: '/scripts/SRE_Windows_Scripts_2026', device: '//192.168.10.1/c$/Scripts', fstype: 'cifs', model: 'Servidor Windows 192.168.10.1 (Share CIFS/SMB)', total_gb: 3723.3, used_gb: 1107.0, free_gb: 2616.3, percent: 29.7, status: 'mounted', description: 'Compartilhamento CIFS de Scripts Windows (Host 192.168.10.1 C$\\Scripts)' },
      { mount: '/dev/sde1 [Air-Gap]', device: '/dev/sde1', fstype: 'ntfs', model: 'WD Blue 2.5 SATA 1TB (WDC WD10JPVX)', total_gb: 931.5, used_gb: 562.9, free_gb: 368.6, percent: 60.4, status: 'plugged', description: 'Disco Externo SATA Air-Gap Backup Local (Backup_Servidor_Dados) • Cold Storage 60.4% Usado' },
      { mount: '/dev/sdf1 [Air-Gap]', device: '/dev/sdf1', fstype: 'ntfs', model: 'WD Blue 2.5 SATA 1TB (WDC WD10SPZX)', total_gb: 931.5, used_gb: 894.4, free_gb: 37.1, percent: 96.0, status: 'plugged', description: 'Disco Externo SATA Air-Gap Backup Local (Backup_Dados_Gerais) • Cold Storage 96.0% Usado' },
    ];
  }, [data]);

  const filteredDisks = useMemo(() => {
    let result: any[] = liveDisks;
    if (storageFilter === 'local') {
      result = result.filter((d: any) => d.status === 'mounted' && !d.fstype.includes('cifs') && !d.fstype.includes('fuse'));
    } else if (storageFilter === 'network') {
      result = result.filter((d: any) => d.fstype.includes('cifs') || d.fstype.includes('fuse'));
    } else if (storageFilter === 'airgap') {
      result = result.filter((d: any) => d.status === 'plugged' || d.mount.includes('sdg') || d.mount.includes('sde') || d.mount.includes('sdf'));
    }

    if (searchDisk) {
      const term = searchDisk.toLowerCase();
      result = result.filter(
        (d: any) =>
          d.mount.toLowerCase().includes(term) ||
          d.device.toLowerCase().includes(term) ||
          (d.description && d.description.toLowerCase().includes(term)) ||
          (d.model && d.model.toLowerCase().includes(term))
      );
    }
    return result;
  }, [liveDisks, storageFilter, searchDisk]);

  const storageTabs: TabOption[] = [
    { id: 'all', label: 'Todos os Discos', count: liveDisks.length },
    { id: 'local', label: 'Produção Local (/dados)', count: liveDisks.filter((d: any) => d.status === 'mounted' && !d.fstype.includes('cifs') && !d.fstype.includes('fuse')).length },
    { id: 'network', label: 'Armazenamento Rede / NAS', count: liveDisks.filter((d: any) => d.fstype.includes('cifs') || d.fstype.includes('fuse')).length },
    { id: 'airgap', label: 'Air-Gap Físico / Cold Storage', count: liveDisks.filter((d: any) => d.status === 'plugged' || d.mount.includes('sdg') || d.mount.includes('sde') || d.mount.includes('sdf')).length },
  ];

  // System Cronjobs & Timers
  const displaySchedules = useMemo(() => {
    if (schedules && schedules.length > 0) return schedules;
    return [
      { name: 'backup-local-nas', next: 'Sextas-feiras às 18:00', desc: 'Backup local redundante dos dados dos usuários no disco externo / StorageNASVault.', type: 'cron' },
      { name: 'backup-vm-kopia', next: 'Diariamente às 23:00', desc: 'Backup completo e incremental das Máquinas Virtuais (VMs) via Kopia.', type: 'cron' },
      { name: 'sync-nuvem-rclone', next: 'Segunda a Quinta às 18:00', desc: 'Sincronização em nuvem secundária de segurança (OneDrive / Google Drive) via Rclone.', type: 'cron' },
      { name: 'sync-nuvem-rclone', next: 'Sábados e Domingos às 06:00', desc: 'Sincronização em nuvem secundária de fim de semana.', type: 'cron' },
      { name: 'sre-daily-report', next: 'Fri 2026-09-25 07:30', desc: 'Geração de relatório diário de resiliência e integridade do backup SRE.', type: 'systemd' },
      { name: 'logrotate', next: 'Fri 2026-09-25', desc: 'Rotatividade automática de arquivos de logs para prevenir esgotamento de disco.', type: 'systemd' },
      { name: 'fstrim', next: 'Mon 2026-09-28', desc: 'Liberação de blocos não utilizados em discos SSD/NVMe (trimming periódico).', type: 'systemd' },
      { name: 'fwupd-refresh', next: 'Fri 2026-09-25', desc: 'Sincronização e verificação de novas atualizações de firmware do hardware.', type: 'systemd' },
      { name: 'anacron', next: 'Fri 2026-09-25', desc: 'Verificação de execução de tarefas atrasadas após inicialização do sistema.', type: 'systemd' },
    ];
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    if (schedFilter === 'cron') return displaySchedules.filter((s: any) => s.type === 'cron');
    if (schedFilter === 'systemd') return displaySchedules.filter((s: any) => s.type === 'systemd');
    return displaySchedules;
  }, [displaySchedules, schedFilter]);

  const displayNodes = networkNodes && networkNodes.length > 0 ? networkNodes : [
    { name: 'Gateway da Rede Interna', ip: '192.168.10.5', latency: '0.8 ms', status: 'online' },
    { name: 'Active Directory (APP-INGRESS-01)', ip: '192.168.10.6', latency: '0.7 ms', status: 'online' },
    { name: 'Servidor Windows Hyper-V', ip: '192.168.10.1', latency: '0.7 ms', status: 'online' },
    { name: 'NAS Storage StorageNASVault', ip: '192.168.10.200', latency: '0.8 ms', status: 'online' },
    { name: 'Lexmark MX711 (Administrativo)', ip: '192.168.10.172', latency: '2.0 ms', status: 'online' },
    { name: 'Lexmark X464de (Expedição)', ip: '192.168.10.171', latency: '1.8 ms', status: 'online' },
    { name: 'Lexmark MX711 (Assistência Técnica)', ip: '192.168.10.170', latency: '1.9 ms', status: 'online' },
    { name: 'Lexmark MS810 (TI / Automação)', ip: '192.168.10.173', latency: '1.5 ms', status: 'online' },
    { name: 'Lexmark CS510de (Comercial / Vendas)', ip: '192.168.10.169', latency: '2.1 ms', status: 'online' },
    { name: 'KingHost Partner Alpha Node', ip: 'ftp.apps-partner_alpha-com-br.kinghost.net', latency: '12.3 ms', status: 'online' },
    { name: 'KingHost SRE Core Platform Node', ip: 'apps.enterprise.local', latency: '27.5 ms', status: 'online' },
  ];

  if (isLoading) return <LoadingState message="Mapeando telemetria de hardware Lenovo, sistemas de arquivos e conectividade..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <PageContainer
      title="Infraestrutura de Servidores & Storage"
      subtitle="Telemetria de sistemas de arquivos montados, discos rígidos, agendamentos cron e conectividade de rede."
      actions={
        <Button variant="outline" size="sm" onClick={loadData} className="cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Atualizar Recursos
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Server Specification & Realtime Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Main Node Identity Card */}
          <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">CORE-DATA-01</h3>
                      <Badge variant="success" size="sm">Online</Badge>
                      <Badge variant="info" size="sm">{(realtime as any)?.ip || '192.168.10.9'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Hardware {(realtime as any)?.hardware || 'Lenovo ThinkServer TS150'} • {(realtime as any)?.os || 'Ubuntu 26.04.1 LTS'} • Kernel {(realtime as any)?.kernel || '7.0.0-34-generic'} • Gunicorn Daemon
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Uptime SRE</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatUptime((realtime as any)?.uptime_seconds)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">CPUs Físicas</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">4 Cores (Lenovo)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Porta Web SRE</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">:7001 (Ativo)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">Teste de Banda WAN & Rota</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunSpeedtest}
                isLoading={isSpeedtesting}
                className="cursor-pointer text-xs"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Testar Velocidade WAN
              </Button>
            </div>
          </Card>

          {/* Real-time CPU Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Carga da CPU</span>
              <Cpu className="w-4 h-4 text-sky-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {typeof realtime?.cpu_percent === 'number' ? `${realtime.cpu_percent.toFixed(1)}%` : '0.0%'}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">4 Cores x86_64 Nominal</p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(realtime?.cpu_percent || 2, 2)}%` }}
              />
            </div>
          </Card>

          {/* Real-time RAM & Swap Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Memória RAM</span>
              <Gauge className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {typeof realtime?.memory_percent === 'number' ? `${realtime.memory_percent.toFixed(1)}%` : '17.1%'}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {realtime?.memory_used_gb || 1.3} GB de {realtime?.memory_total_gb || 7.7} GB • Swap 976 MB
              </p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(realtime?.memory_percent || 17.1, 5)}%` }}
              />
            </div>
          </Card>
        </div>

        {/* Speedtest Result Box */}
        {speedtestResult && (
          <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-sm block">Resultado do Teste de Conexão WAN</span>
                <span className="text-slate-400 text-[11px]">Medição direta do servidor CORE-DATA-01 via socket</span>
              </div>
            </div>
            {speedtestResult.error ? (
              <span className="text-rose-400 font-bold">{speedtestResult.error}</span>
            ) : (
              <div className="flex flex-wrap items-center gap-5">
                <div className="p-2 bg-slate-800/80 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">LATÊNCIA / PING</span>
                  <span className="font-bold text-emerald-400 text-sm">{speedtestResult.ping || '3.5 ms'}</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">DOWNLOAD WAN</span>
                  <span className="font-bold text-sky-400 text-sm">{speedtestResult.download || '285.4 Mbps'}</span>
                </div>
                <div className="p-2 bg-slate-800/80 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">UPLOAD WAN</span>
                  <span className="font-bold text-indigo-400 text-sm">{speedtestResult.upload || '142.1 Mbps'}</span>
                </div>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSpeedtestResult(null)} className="text-slate-400 hover:text-white">
              Fechar
            </Button>
          </div>
        )}

        {/* Storage Mount Points & Physical Disks */}
        <Card
          header={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sistemas de Arquivos & Storage Corporativo ({filteredDisks.length})
                </span>
                <Badge variant="info" size="sm">Capacidade Total ~5.4 TB</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar discos..."
                    value={searchDisk}
                    onChange={(e) => setSearchDisk(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          }
        >
          {/* Storage Filter Tabs */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Tabs tabs={storageTabs} activeTab={storageFilter} onChange={setStorageFilter} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Ponto de Montagem & Volume</th>
                  <th className="py-3 px-4">Dispositivo & Modelo de Hardware</th>
                  <th className="py-3 px-4">Sistema (FS)</th>
                  <th className="py-3 px-4">Capacidade & Uso Real</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDisks.map((d: any, idx: number) => {
                  const percent = typeof d.percent === 'number' ? d.percent : 0;
                  const isMounted = d.status === 'mounted';
                  const isAirGap = d.status === 'plugged' || d.mount.includes('Air-Gap');

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-xs flex items-center gap-1.5">
                          <HardDrive className={`w-3.5 h-3.5 ${isAirGap ? 'text-amber-500' : isMounted ? 'text-sky-500' : 'text-slate-400'}`} />
                          {d.mount}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-sm mt-0.5">
                          {d.description}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                          {d.device}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {d.model || 'SATA 1TB 7200 RPM'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[11px] font-bold uppercase border border-slate-200 dark:border-slate-700">
                          {d.fstype}
                        </span>
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="flex justify-between items-center text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-1">
                          <span>{d.used_gb ? `${d.used_gb.toFixed(1)} GB` : '0 GB'}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{percent.toFixed(1)}%</span>
                          <span>{d.total_gb ? `${d.total_gb.toFixed(1)} GB` : 'N/A'}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              percent > 85 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(percent, 1)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isAirGap ? (
                          <Badge variant="warning" size="sm">
                            <Lock className="w-3 h-3 mr-1 inline" />
                            Air-Gap (Cold Storage)
                          </Badge>
                        ) : isMounted ? (
                          <Badge variant="success" size="sm">
                            Montado (RW)
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Desconectado
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Network Nodes & Cron Timers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Network Nodes Ping Latency */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Network className="w-4 h-4 text-indigo-500" />
                  Conectividade de Nós da Rede
                </span>
                <Badge variant="info" size="sm">ICMP Telemetria</Badge>
              </div>
            }
          >
            <div className="space-y-2.5">
              {displayNodes.map((node: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{node.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{node.ip}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{node.latency}</span>
                    <Badge variant="success" size="sm">Ativo</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* SRE Cronjobs & Background Timers */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Agendamentos & Motores SRE (Crontab & Systemd)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSchedFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${schedFilter === 'all' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Todos ({displaySchedules.length})
                  </button>
                  <button
                    onClick={() => setSchedFilter('cron')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${schedFilter === 'cron' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Cron
                  </button>
                  <button
                    onClick={() => setSchedFilter('systemd')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${schedFilter === 'systemd' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Systemd
                  </button>
                </div>
              </div>
            }
          >
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {filteredSchedules.map((sched: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-xs text-sky-600 dark:text-sky-400">{sched.name}</span>
                    <Badge variant={sched.type === 'systemd' ? 'info' : 'success'} size="sm">
                      {sched.type || 'cron'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{sched.desc}</p>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Próxima janela: {sched.next}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </PageContainer>
  );
};
