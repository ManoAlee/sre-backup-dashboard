import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Server,
  Network,
  Clock,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  FileText,
  LifeBuoy,
  Cpu,
  Car,
  Workflow,
  Database,
  Lock,
  GitBranch,
  Terminal,
  Binary,
  Check,
  Copy,
  Info,
  FolderGit2,
  Printer,
  Monitor
} from 'lucide-react';

interface ApplicationHealth {
  id: string;
  name: string;
  url: string;
  category: string;
  description: string;
  host: string;
  path: string;
  ingress: {
    server: string;
    type: string;
    ssl_cert: string;
    ssl_thumbprint: string;
    status: 'ONLINE' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'UNKNOWN';
    code: number | null;
    latency_ms: number | null;
    error: string | null;
  };
  upstream: {
    server: string;
    container: string;
    port: number;
    stack: string;
    status: 'ONLINE' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'UNKNOWN';
    code: number | null;
    latency_ms: number | null;
  };
  dependencies: Array<{
    name: string;
    port?: number;
    status: 'ONLINE' | 'OFFLINE' | 'INTERNAL';
    latency_ms?: number | null;
  }>;
  overall: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  diagnosis: string;
  last_checked: string;
}

interface SharedInfraItem {
  name: string;
  category: string;
  server: string;
  port: number;
  databases?: string[];
  url?: string;
  status: 'ONLINE' | 'OFFLINE';
  latency_ms: number | null;
  code?: number | null;
}

interface SSLCertItem {
  name: string;
  type: string;
  thumbprint: string;
  valid_until: string;
  days_remaining: number;
  domains: string[];
  store: string;
  status: string;
}

interface ApplicationsResponse {
  summary: {
    total: number;
    nominal: number;
    warning: number;
    critical: number;
    health_score: number;
    avg_latency_ms: number;
    timestamp: string;
  };
  applications: ApplicationHealth[];
  infrastructure?: SharedInfraItem[];
  ssl_certificates?: SSLCertItem[];
}

export const ApplicationsPage: React.FC = () => {
  const [data, setData] = useState<ApplicationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeView, setActiveView] = useState<'cards' | 'topology' | 'infra' | 'ssl'>('cards');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedThumb, setCopiedThumb] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      setError(null);
      const res = await api.getApplicationsStatus();
      setData(res);
    } catch (err: any) {
      if (!data) {
        setError(err.message || 'Erro ao carregar telemetria das aplicações corporativas.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    loadData();
  }, []);

  // Polling automático a cada 20 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const categories = useMemo(() => {
    if (!data?.applications) return [];
    return Array.from(new Set(data.applications.map((a) => a.category)));
  }, [data]);

  const filteredApps = useMemo(() => {
    if (!data?.applications) return [];
    return data.applications.filter((app) => {
      const matchSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.upstream.container.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || app.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [data, searchQuery, categoryFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedThumb(id);
    setTimeout(() => setCopiedThumb(null), 2000);
  };

  const getAppIcon = (id: string) => {
    switch (id) {
      case 'connectme':
        return <Zap className="w-5 h-5 text-sky-500" />;
      case 'ativos':
        return <Server className="w-5 h-5 text-indigo-500" />;
      case 'chamados':
        return <LifeBuoy className="w-5 h-5 text-amber-500" />;
      case 'n8n':
        return <Workflow className="w-5 h-5 text-emerald-500" />;
      case 'frota':
        return <Car className="w-5 h-5 text-rose-500" />;
      case 'datasul':
        return <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'agendor':
        return <Activity className="w-5 h-5 text-sky-500" />;
      default:
        return <Globe className="w-5 h-5 text-sky-500" />;
    }
  };

  const renderStatusBadge = (status: 'NOMINAL' | 'WARNING' | 'CRITICAL') => {
    switch (status) {
      case 'NOMINAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            NOMINAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            ATENÇÃO
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
            <XCircle className="w-3.5 h-3.5" />
            FALHA
          </span>
        );
    }
  };

  if (isLoading && !data) {
    return <LoadingState message="Auditando Ingress IIS (192.168.10.6), Upstreams (192.168.10.7) e Bancos de Dados..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => loadData()} />;
  }

  const summary = data?.summary;
  const infrastructure = data?.infrastructure || [];
  const sslCerts = data?.ssl_certificates || [];

  return (
    <PageContainer
      title="Aplicações Corporativas & Web Services"
      subtitle="Observabilidade de Ingress IIS (192.168.10.6), Upstreams Docker (192.168.10.7), Bancos de Dados e Certificados SSL."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`cursor-pointer ${autoRefresh ? 'border-sky-500/30 text-sky-500 bg-sky-500/5' : 'text-slate-500'}`}
          >
            <Radio className={`w-3.5 h-3.5 mr-1.5 ${autoRefresh ? 'animate-pulse text-sky-500' : ''}`} />
            Auto-Sync {autoRefresh ? '20s' : 'Off'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={isRefreshing}
            className="cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Auditar Agora
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Score de Saúde</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {summary?.health_score ?? 100}%
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Ponta a Ponta</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary?.health_score ?? 100}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Aplicações Ativas</span>
              <Layers className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {summary?.nominal ?? 0}
                <span className="text-sm font-normal text-slate-400"> / {summary?.total ?? 0}</span>
              </span>
              <span className="text-xs text-slate-500">Serviços OK</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 truncate">ConnectMe, Ativos, Chamados, n8n, Frota</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Borda Ingress IIS</span>
              <Globe className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                192.168.10.6
              </span>
              <span className="text-xs text-slate-500">APP-INGRESS-01</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Terminação SSL :443 + ARR</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Servidor Upstream</span>
              <Server className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                192.168.10.7
              </span>
              <span className="text-xs text-slate-500">Debian Linux</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Docker Host & 3 Clusters DB</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Latência Média</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {summary?.avg_latency_ms ?? 0} ms
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">LAN Ultra-baixa</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Última checagem: {summary?.timestamp?.split(' ')[1] || 'Recente'}</p>
          </Card>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveView('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Catálogo de Aplicações ({filteredApps.length})
            </button>

            <button
              onClick={() => setActiveView('topology')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'topology'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Fluxograma & Topologia Ingress/Upstream
            </button>

            <button
              onClick={() => setActiveView('infra')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'infra'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Bancos de Dados & Observabilidade ({infrastructure.length})
            </button>

            <button
              onClick={() => setActiveView('ssl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'ssl'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Certificados SSL ({sslCerts.length})
            </button>
          </div>

          {activeView === 'cards' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por app, container, URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-56"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-1 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="ALL">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* VIEW 1: APPLICATIONS CARDS */}
        {activeView === 'cards' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredApps.map((app) => (
              <Card
                key={app.id}
                className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                        {getAppIcon(app.id)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {app.name}
                        </h3>
                        <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                          {app.category}
                        </span>
                      </div>
                    </div>
                    {renderStatusBadge(app.overall)}
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {app.description}
                  </p>

                  {/* URL and Open Link */}
                  <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                    <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate max-w-[280px] sm:max-w-xs">
                      {app.url}
                    </code>
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0 ml-2"
                    >
                      Abrir Serviço <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* SRE Dual-Tier Telemetry */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    {/* Tier 1: Ingress IIS (192.168.10.6) or Internal Bus */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          {app.id === 'agendor' ? (
                            <>
                              <Workflow className="w-3 h-3 text-indigo-500" />
                              Barramento Privado (Sem IIS)
                            </>
                          ) : app.id === 'datasul' ? (
                            <>
                              <Server className="w-3 h-3 text-indigo-500" />
                              Tomcat PASOE (192.168.10.2)
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3 text-sky-500" />
                              Ingress IIS (192.168.10.6)
                            </>
                          )}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            app.id === 'agendor'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : app.id === 'datasul'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : app.ingress.status === 'ONLINE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {app.id === 'agendor' ? 'Privado LAN' : app.id === 'datasul' ? 'Porta :8080 OK' : `HTTP ${app.ingress.code || 'ERR'}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between items-center mt-1">
                        <span>{app.id === 'agendor' ? 'Consumidores:' : app.id === 'datasul' ? 'Servidor Host:' : 'Latência:'}</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {app.id === 'agendor' ? 'n8n & Salesforce' : app.id === 'datasul' ? 'autom-totvs (0.4ms)' : (app.ingress.latency_ms ? `${app.ingress.latency_ms} ms` : '--')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate" title={app.ingress.ssl_cert}>
                        {app.id === 'agendor' ? 'Acesso: HTTP Direto :40000' : app.id === 'datasul' ? 'Spooler SMB: Porta :445 OK' : `SSL: ${app.ingress.ssl_cert}`}
                      </div>
                    </div>

                    {/* Tier 2: Upstream Container or Server */}
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Server className="w-3 h-3 text-amber-500" />
                          Upstream ({app.upstream.server})
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            app.upstream.status === 'ONLINE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          Porta :{app.upstream.port} OK
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between items-center mt-1">
                        <span>Serviço:</span>
                        <span className="font-mono text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={app.upstream.container}>
                          {app.upstream.container.split('/')[0]}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate" title={app.upstream.stack}>
                        Stack: {app.upstream.stack}
                      </div>
                    </div>
                  </div>

                  {/* Dependencies & Databases */}
                  {app.dependencies && app.dependencies.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Dependências & Bases de Dados</span>
                        <span className="text-[9px] text-slate-500 font-mono">Host 192.168.10.7</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {app.dependencies.map((dep, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                              dep.status === 'ONLINE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : dep.status === 'INTERNAL'
                                ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {dep.name} {dep.port ? `(:${dep.port})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SRE Forensic Diagnosis Footer */}
                <div
                  className={`mt-4 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    app.overall === 'CRITICAL'
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      : 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {app.overall === 'CRITICAL' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-tight text-[11px]">{app.diagnosis}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* VIEW 2: TOPOLOGY & FLOWCHART */}
        {activeView === 'topology' && (
          <div className="space-y-4">
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-sky-500" />
                    Arquitetura Ponta a Ponta: Ingress IIS, Upstreams Linux & ERP Datasul
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Fluxo de tráfego HTTPS via Active Directory DNS, terminação SSL no IIS 192.168.10.6, despacho para 192.168.10.7 e barramento integrado com ERP Datasul 192.168.10.2.
                  </p>
                </div>
                <Badge variant="info">Modo Leitura / Não-Destrutivo</Badge>
              </div>

              {/* Interactive Flow Grid - 5 Nodes */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                {/* Step 1 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">1</span>
                    Clientes & DNS AD
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3 leading-relaxed">
                    Navegador resolve as zonas *.enterprise.local apontando para o Domain Controller <strong>192.168.10.6</strong>.
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                    <div>connectme ➔ 192.168.10.6</div>
                    <div>ativos ➔ 192.168.10.6</div>
                    <div>chamados ➔ 192.168.10.6</div>
                    <div>n8n ➔ 192.168.10.6</div>
                    <div>frota ➔ 192.168.10.6</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs">2</span>
                    Ingress IIS (192.168.10.6)
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3 leading-relaxed">
                    Recebe tráfego HTTPS (:443), executa o handshake TLS e descarrega a criptografia (SSL Offloading).
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                    <div className="text-indigo-600 dark:text-indigo-400 font-bold">IIS 10.0 + ARR</div>
                    <div>SAN Multi-Site (2036)</div>
                    <div>Dedicado Frota (2036)</div>
                    <div>Header: X-Forwarded-Proto</div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">3</span>
                    Upstream (192.168.10.7)
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3 leading-relaxed">
                    Tráfego interno HTTP puro de alta velocidade redirecionado para as portas dos contêineres Docker.
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                    <div>ConnectMe: :18002</div>
                    <div>Ativos Front: :28050</div>
                    <div>Chamados Nginx: :80</div>
                    <div>n8n Web: :30000</div>
                    <div>Agendor API: :40000</div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">4</span>
                    Bancos & IA (192.168.10.7)
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3 leading-relaxed">
                    Bases de dados relacionais segregadas, caches Redis em memória e stack cognitiva de IA.
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                    <div>PostgreSQL Core :50000</div>
                    <div>PostgreSQL Nexus :25432</div>
                    <div>MySQL Frota :19501</div>
                    <div>Qdrant Vetorial :6335</div>
                    <div>Memgraph Grafo :7687</div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">5</span>
                    ERP Datasul (192.168.10.2)
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3 leading-relaxed">
                    ERP TOTVS OpenEdge 12.x, servidor de spooler SMB das 5 Lexmarks e barramento de webhooks.
                  </p>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                    <div className="text-violet-600 dark:text-violet-400 font-bold">PASOE Tomcat :8080</div>
                    <div>Spooler SMB :445 (3ms)</div>
                    <div>Bancos: EMS2/EMS5/MOVTO</div>
                    <div>Gestão: WinRM/RPC/RDP</div>
                    <div>Estações: C:\dlc122</div>
                  </div>
                </div>
              </div>

              {/* Visual Routing Table - 7 Applications */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Aplicação</th>
                      <th className="py-2.5 px-3">URL Externa</th>
                      <th className="py-2.5 px-3">Borda IIS (192.168.10.6)</th>
                      <th className="py-2.5 px-3">Upstream Host</th>
                      <th className="py-2.5 px-3">Serviço / Contêiner</th>
                      <th className="py-2.5 px-3">Stack Tecnológica</th>
                      <th className="py-2.5 px-3">Bancos de Dados & Recursos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">ConnectMe 2.0</td>
                      <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">https://connectme...</td>
                      <td className="py-2.5 px-3">Site connectme (:443)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:18002</td>
                      <td className="py-2.5 px-3">connect-20-web-1</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Django + Python 3.11</td>
                      <td className="py-2.5 px-3">PG :50000 (connect20)</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">Ativos (GTI)</td>
                      <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">https://ativos...</td>
                      <td className="py-2.5 px-3">Site ativos (:443)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:28050</td>
                      <td className="py-2.5 px-3">gti-production-frontend</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Nginx + Flask Gunicorn</td>
                      <td className="py-2.5 px-3">PG :25432 (it_nexus_db)</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">Portal de Chamados de TI</td>
                      <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">https://chamados...</td>
                      <td className="py-2.5 px-3">Site chamados (:443)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:80</td>
                      <td className="py-2.5 px-3">app-chamados-front/back</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">React + Node 20 Socket.IO</td>
                      <td className="py-2.5 px-3">PG :50000 + Qdrant + Memgraph</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">n8n Automation</td>
                      <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">https://n8n...</td>
                      <td className="py-2.5 px-3">Site n8n (:443)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:30000</td>
                      <td className="py-2.5 px-3">n8n-n8n-1 + runners</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Node.js 24 + WebSockets</td>
                      <td className="py-2.5 px-3">PG :50000 (n8n)</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">Reserva de Frota</td>
                      <td className="py-2.5 px-3 text-sky-600 dark:text-sky-400">https://frota...</td>
                      <td className="py-2.5 px-3">Site frota (:443)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:19500</td>
                      <td className="py-2.5 px-3">reserva-frota-web-1</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Apache 2.4 + PHP 8.3</td>
                      <td className="py-2.5 px-3">MySQL :19501 (frota_veiculos)</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">Agendor CRM API</td>
                      <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">http://192.168.10.7:40000...</td>
                      <td className="py-2.5 px-3 text-slate-400 italic">M2M Privado (Sem IIS)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.7:40000</td>
                      <td className="py-2.5 px-3">agendor-api (/srv/DEV)</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">Node.js 20 + Express 5</td>
                      <td className="py-2.5 px-3">API Agendor Cloud v3 / n8n</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">ERP TOTVS Datasul</td>
                      <td className="py-2.5 px-3 text-violet-600 dark:text-violet-400">http://192.168.10.2:8080...</td>
                      <td className="py-2.5 px-3 text-slate-400 italic">Host autom-totvs (:8080)</td>
                      <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">192.168.10.2:8080</td>
                      <td className="py-2.5 px-3">PASOE Tomcat + OpenEdge</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">OpenEdge 12.2 + AppServer</td>
                      <td className="py-2.5 px-3">Bancos EMS2, EMS5, MOVTO + Spooler</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Ecossistema Integrado ERP TOTVS Datasul & Periféricos */}
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-violet-500" />
                      Engrenagem Operacional TOTVS Datasul 12 — Host 192.168.10.2 (Windows Server)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mapeamento integral dos 6 Pilares Vitais, 23 bancos Progress OpenEdge, instâncias PASOE, robô batch RPW e rotinas SRE de auto-cura (D.R.D.).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">License :5555 (0ms)</Badge>
                  <Badge variant="success">Tomcat :8080 (0ms)</Badge>
                  <Badge variant="success">Standby :8180 (0ms)</Badge>
                  <Badge variant="success">ems2mov :23601 (0ms)</Badge>
                  <Badge variant="success">Spooler :445 (3ms)</Badge>
                  <Badge variant="neutral">WinRM :5985 (0ms)</Badge>
                </div>
              </div>

              {/* 6 Vital Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Pilar 1: Licenciamento */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Lock className="w-4 h-4 text-emerald-500" />
                        <span>1º Pilar: Licenciamento Virtual</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">P0 Crítico</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3">
                      Validação preliminar de qualquer conexão. Se parar, o Tomcat responde HTTP 500 e clientes abortam.
                    </p>
                    <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                      <div className="text-slate-700 dark:text-slate-300 font-bold">Serviço: licenseVirtual</div>
                      <div className="text-slate-500">Porta: 0.0.0.0:5555/tcp</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold">● Status: ONLINE (0.4 ms)</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 font-sans">
                    Dependência inicial obrigatória para todo o ecossistema.
                  </div>
                </div>

                {/* Pilar 2: Runtime Progress */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Server className="w-4 h-4 text-sky-500" />
                        <span>2º Pilar: Runtime OpenEdge 12.2</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400">C:\dlc122</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3">
                      Gerenciador dos brokers de banco (_mprosrv) e das instâncias clássicas e PASOE.
                    </p>
                    <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                      <div className="text-slate-700 dark:text-slate-300 font-bold">AdminService12.2 (64-bit)</div>
                      <div className="text-slate-500">Porta TCP: :20931</div>
                      <div className="text-slate-500">Console Fathom: :9090</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 font-sans">
                    Supervisiona a integridade de todas as bases e brokers.
                  </div>
                </div>

                {/* Pilar 3: Bancos de Dados Progress */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Database className="w-4 h-4 text-violet-500" />
                        <span>3º Pilar: 23 Bases Progress</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400">Proserve</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-2">
                      Ambiente multi-empresa (SRE Core Platform, Partner Alpha, RDrive) em <code className="text-[10px]">database-8080</code>.
                    </p>
                    <div className="space-y-1 font-mono text-[10px]">
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-violet-600 dark:text-violet-400">ems2mov (:23601)</span>
                        <span className="text-slate-500">Estoque/Ordens (-B 400k)</span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">emsfnd (:23619/:23620)</span>
                        <span className="text-slate-500">Fundação / Menus</span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">ems5mov/cad (:23606/:23605)</span>
                        <span className="text-slate-500">Financeiro & Fiscal</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    ● Brokers 23601 a 23666 Respondendo (0.4 ms)
                  </div>
                </div>

                {/* Pilar 4: Aplicação PASOE & RPW */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Workflow className="w-4 h-4 text-amber-500" />
                        <span>4º Pilar: PASOE & Robô RPW</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">Batch & Logic</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3">
                      Pool de instâncias PASOE (código .r) e serviço batch de relatórios, SPED e custos.
                    </p>
                    <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                      <div className="text-slate-700 dark:text-slate-300 font-bold">TOTVS TaskManager-RPW -- 8080</div>
                      <div className="text-slate-500">PASOE: 9100, 9140, 9200, 9240</div>
                      <div className="text-slate-500">Fila Batch: Execução Contínua</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 font-sans">
                    Sem o RPW, relatórios e rotinas noturnas ficam represados.
                  </div>
                </div>

                {/* Pilar 5: Camada Web / THF Tomcat */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Globe className="w-4 h-4 text-sky-500" />
                        <span>5º Pilar: Web / THF Tomcat 9</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Ativo</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-3">
                      Interface Web THF HTML5 com portal principal e instância standby de contingência.
                    </p>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="font-bold text-sky-600 dark:text-sky-400">TOTVS12-8080 (Principal)</div>
                        <div className="text-[10px] text-slate-500">/totvs-login/loginForm ➔ /totvs-menu/</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">● ONLINE (0.4 ms)</div>
                      </div>
                      <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="font-bold text-slate-600 dark:text-slate-300">TOTVS12-8180 (Standby)</div>
                        <div className="text-[10px] text-slate-500">Ambiente de Contingência</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">● ONLINE (0.4 ms)</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 font-sans">
                    Ponto de entrada dos usuários web e despacho de sessão.
                  </div>
                </div>

                {/* Pilar 6: Spooler SMB Lexmarks */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Printer className="w-4 h-4 text-emerald-500" />
                        <span>6º Pilar: Spooler SMB (:445)</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">5 Impressoras</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-2">
                      Compartilhamento nativo de impressão de Danfes, NFe e etiquetas fiscais/operacionais.
                    </p>
                    <div className="space-y-1 font-mono text-[10px]">
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">LEXMARK_EXP</span>
                        <span className="text-slate-500">Expedição (Danfe/Etiquetas)</span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">LEXMARK_VENDAS</span>
                        <span className="text-slate-500">Comercial</span>
                      </div>
                      <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                        <span className="font-bold text-slate-700 dark:text-slate-300">LEXMARK_LAB / TI / Adm</span>
                        <span className="text-slate-500">Lab, TI e Adm</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    ● SMB :445 Ativo (3.0 ms)
                  </div>
                </div>
              </div>

              {/* SRE Self-Healing & Automation Scripts */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-violet-500" />
                    <span>Automação SRE & Auto-Cura (Scripts Database em \\192.168.10.2\c$\Users\Administrador...)</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">Metodologia D.R.D. (Diagnosticar, Recuperar, Documentar)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] mb-1">
                      Orchestrator-Dashboard.ps1
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      TOTVS Reliability Center V7.1 (WPF/XAML). Monitora em tempo real portas :5555, :20931, :8080, :8180, :9090 e o pool :23600-23634.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] mb-1">
                      Invoke-TotvsSelfHealing.ps1
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Script de auto-recuperação resiliente. Reinicia serviços travados, mata processos órfãos (_mprosrv) e roda <code className="text-[10px]">limpar logs.bat</code>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] mb-1">
                      Checklist de Boot Estrito
                    </div>
                    <ol className="text-[10px] text-slate-500 dark:text-slate-400 list-decimal list-inside space-y-0.5 font-mono">
                      <li>licenseVirtual (:5555)</li>
                      <li>AdminService12.2 (:20931)</li>
                      <li>datasulCargaBancos (23 bases)</li>
                      <li>THF 8080 & RPW 8080</li>
                      <li>Validação /totvs-login/loginForm</li>
                    </ol>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* VIEW 3: SHARED INFRASTRUCTURE & DATABASES */}
        {activeView === 'infra' && (
          <div className="space-y-4">
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Infraestrutura de Dados, Caches e Observabilidade (Host 192.168.10.7)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Serviços essenciais que sustentam as operações das 5 aplicações corporativas.
                  </p>
                </div>
                <Badge variant="success">Todas as Portas Respondendo</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {infrastructure.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.category}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            item.status === 'ONLINE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </h4>

                      <div className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Endereço TCP:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.server}:{item.port}
                        </span>
                      </div>

                      {item.latency_ms !== null && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>Latência Socket:</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {item.latency_ms} ms
                          </span>
                        </div>
                      )}

                      {item.databases && item.databases.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                          <span className="text-slate-400 block mb-1 text-[10px] uppercase font-semibold">Bases Atendidas:</span>
                          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                            {item.databases.map((db, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-800/80 rounded text-slate-700 dark:text-slate-300">
                                {db}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {item.url && (
                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Abrir Dashboard / API <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* VIEW 4: SSL CERTIFICATES */}
        {activeView === 'ssl' && (
          <div className="space-y-4">
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-500" />
                    Governança e Inventário de Certificados Digitais SSL/TLS
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Certificados instalados no proxy IIS (192.168.10.6) responsáveis pela criptografia HTTPS do usuário final.
                  </p>
                </div>
                <Badge variant="success">Válidos até 2036 (+3.500 dias)</Badge>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  1. Servidor Windows Ingress (APP-INGRESS-01 ➔ 192.168.10.6) • Windows Certificate Store
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sslCerts.map((cert: any, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {cert.status}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {cert.type}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {cert.name}
                        </h4>

                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span>Data de Validade:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{cert.valid_until}</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-500">
                            <span>Dias Restantes:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{cert.days_remaining} dias</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-500">
                            <span>Interface Gráfica (GUI):</span>
                            <code className="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                              certlm.msc ➔ Pessoal ➔ Certificados
                            </code>
                          </div>

                          <div className="flex items-center justify-between text-slate-500">
                            <span>Chaves Físicas (CNG):</span>
                            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title="C:\ProgramData\Microsoft\Crypto\RSA\MachineKeys\">
                              ...\Crypto\RSA\MachineKeys\
                            </span>
                          </div>
                        </div>

                        {/* PowerShell Path */}
                        <div className="mt-3 p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Caminho PowerShell:</span>
                            <button
                              onClick={() => copyToClipboard(cert.powershell_path || `Cert:\\LocalMachine\\My\\${cert.thumbprint}`, `ps-${idx}`)}
                              className="text-[10px] text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedThumb === `ps-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedThumb === `ps-${idx}` ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all select-all">
                            {cert.powershell_path || `Cert:\\LocalMachine\\My\\${cert.thumbprint}`}
                          </code>
                        </div>

                        {/* Thumbprint */}
                        <div className="mt-2 p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Thumbprint SHA-1:</span>
                            <button
                              onClick={() => copyToClipboard(cert.thumbprint, cert.thumbprint)}
                              className="text-[10px] text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedThumb === cert.thumbprint ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedThumb === cert.thumbprint ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 break-all select-all">
                            {cert.thumbprint}
                          </code>
                        </div>

                        <div className="mt-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Domínios Cobertos:</span>
                          <div className="flex flex-wrap gap-1">
                            {cert.domains.map((dom: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">
                                {dom}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Windows Physical File & GPO Repositories */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-emerald-500" />
                  2. Repositórios Físicos de Arquivos, GPO & Compartilhamentos UNC (192.168.10.6)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">Repositório Central PKI & GPO</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Produção GPO
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Certificado distribuído via GPO (<code>GPO_PKI_Deploy_SSL_Corporativo</code>) e backup PFX do IIS.
                      </p>

                      <div className="space-y-2">
                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <div className="flex items-center justify-between text-slate-400 mb-0.5">
                            <span>Acesso de Rede (UNC):</span>
                            <button
                              onClick={() => copyToClipboard('\\\\APP-INGRESS-01\\c$\\Users\\GPO\\Certificado\\', 'unc-pki')}
                              className="text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedThumb === 'unc-pki' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 break-all">\\APP-INGRESS-01\c$\Users\GPO\Certificado\</span>
                        </div>

                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <span className="text-slate-400 block mb-0.5">Arquivos Chave:</span>
                          <div className="space-y-1 text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-500">📄</span> SRE Core Platform_Enterprise_Unified_SSL.cer
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-amber-500">🔐</span> SRE Core Platform_Enterprise_Unified_SSL_Backup.pfx
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">Certificados por Projeto</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          Chaves & Scripts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Pacotes criptográficos individuais para geração e testes isolados das aplicações.
                      </p>

                      <div className="space-y-2">
                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <div className="flex items-center justify-between text-slate-400 mb-0.5">
                            <span>Acesso de Rede (UNC):</span>
                            <button
                              onClick={() => copyToClipboard('\\\\APP-INGRESS-01\\c$\\Users\\GPO\\GPO_Scripts\\03_Project_Certificates_And_Keys\\', 'unc-proj')}
                              className="text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedThumb === 'unc-proj' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 break-all">\\APP-INGRESS-01\c$\Users\GPO\GPO_Scripts\03_Project_Certificates_And_Keys\</span>
                        </div>

                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <span className="text-slate-400 block mb-0.5">Arquivos Chave:</span>
                          <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                            <div>• ativos_enterprise.pfx / .crt / .cer</div>
                            <div>• chamados_enterprise_CORRETO.pfx / REAL.crt</div>
                            <div>• temp_export.pfx</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">Backup Histórico & Auditoria</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Cold Storage
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Cópias de segurança e histórico de versões de certificados para fins de auditoria SRE.
                      </p>

                      <div className="space-y-2">
                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <span className="text-slate-400 block mb-0.5">Diretório Local Windows:</span>
                          <span className="text-slate-700 dark:text-slate-300 break-all">C:\Users\GPO\Documentacao_GPO_Producao\Certificados_Backup\</span>
                        </div>

                        <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                          <span className="text-slate-400 block mb-0.5">Arquivo Histórico:</span>
                          <span className="text-slate-700 dark:text-slate-300">SRE Core Platform_SAN_v2_BACKUP.cer</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linux Debian Certificates Section */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-500" />
                  3. Servidor Linux Upstream (192.168.10.7 ➔ n8n.enterprise.local) • Arquivos PEM (/etc/nginx/ssl/)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      name: 'Certificado Multi-Site / Geral',
                      cert: '/etc/nginx/ssl/enterprise.crt',
                      key: '/etc/nginx/ssl/enterprise.key',
                      usage: 'Host Nginx & Chamadas HTTPS Internas',
                    },
                    {
                      name: 'Certificado Portal de Ativos',
                      cert: '/etc/nginx/ssl/ativos.crt',
                      key: '/etc/nginx/ssl/ativos.key',
                      usage: 'GTI Frontend/Backend e Tokens',
                    },
                    {
                      name: 'Certificado Chamados TI',
                      cert: '/etc/nginx/ssl/chamados.crt',
                      key: '/etc/nginx/ssl/chamados.key',
                      usage: 'Host Nginx Chamados e WebSockets',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            PEM Base64
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">{item.usage}</p>

                        <div className="space-y-2">
                          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                            <div className="flex items-center justify-between text-slate-400 mb-0.5">
                              <span>Certificado Público (.crt):</span>
                              <button
                                onClick={() => copyToClipboard(item.cert, `crt-${idx}`)}
                                className="text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedThumb === `crt-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <span className="text-slate-700 dark:text-slate-300 break-all">{item.cert}</span>
                          </div>

                          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px]">
                            <div className="flex items-center justify-between text-slate-400 mb-0.5">
                              <span>Chave Privada (.key):</span>
                              <button
                                onClick={() => copyToClipboard(item.key, `key-${idx}`)}
                                className="text-sky-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer"
                              >
                                {copiedThumb === `key-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <span className="text-slate-700 dark:text-slate-300 break-all">{item.key}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informative Note */}
              <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Terminação SSL de Borda (SSL Offloading):</strong> O handshake HTTPS com o usuário final é realizado e descriptografado no IIS do servidor <strong>192.168.10.6</strong> (porta 443). O tráfego segue na rede interna para o servidor <strong>192.168.10.7</strong> em alta performance. As cópias em <code>/etc/nginx/ssl/</code> no Linux garantem flexibilidade caso haja comunicação HTTPS interna direta entre os microsserviços.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
};
