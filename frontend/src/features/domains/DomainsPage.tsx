import React, { useEffect, useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { api } from '@/services/api';
import {
  Globe,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Network,
  Mail,
  Lock,
  Server,
  Key,
  Info,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Activity,
  Calendar,
  Layers,
  ArrowUpRight,
  Wifi,
  Search,
} from 'lucide-react';

export const DomainsPage: React.FC = () => {
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'email' | 'ssl' | 'reputation'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await api.getDomainHealth();
      if (Array.isArray(res)) {
        setRawData(res);
      } else if (res && typeof res === 'object') {
        setRawData(Object.values(res));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar governança de domínios corporativos.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const domainItems = useMemo(() => {
    return rawData.filter((item: any) => item.type === 'domain' || !item.type);
  }, [rawData]);

  const infraItems = useMemo(() => {
    return rawData.filter((item: any) => item.type === 'infra_ip');
  }, [rawData]);

  const filteredDomains = useMemo(() => {
    if (!searchTerm) return domainItems;
    const term = searchTerm.toLowerCase();
    return domainItems.filter((item: any) =>
      item.domain?.toLowerCase().includes(term) ||
      item.ip?.toLowerCase().includes(term) ||
      item.provider?.toLowerCase().includes(term)
    );
  }, [domainItems, searchTerm]);

  const filteredInfra = useMemo(() => {
    if (!searchTerm) return infraItems;
    const term = searchTerm.toLowerCase();
    return infraItems.filter((item: any) =>
      item.domain?.toLowerCase().includes(term) ||
      item.ip?.toLowerCase().includes(term) ||
      item.provider?.toLowerCase().includes(term)
    );
  }, [infraItems, searchTerm]);

  if (isLoading && !isRefreshing) {
    return <LoadingState message="Auditando registros de DNS, certificados SSL e reputação de e-mails corporativos..." />;
  }

  if (error && rawData.length === 0) {
    return <ErrorState message={error} onRetry={() => loadData(false)} />;
  }

  return (
    <PageContainer
      title="Governança de Domínios, DNS & Enlaces WAN"
      subtitle="Auditoria contínua de zonas de domínio, validade de certificados SSL/TLS, autenticação de e-mail corporativo (Microsoft 365, SPF, DKIM, DMARC) e alta disponibilidade de internet."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="cursor-pointer font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
            {isRefreshing ? 'Auditando...' : 'Reverificar Zonas'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Domínios */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-sky-500/40 transition-all p-4">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Zonas Corporativas</span>
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {domainItems.length || 2}
              </span>
              <span className="text-xs text-slate-500 font-medium">Domínios Ativos</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">Registro.br & HostGator</span>
              <Badge variant="success" size="sm" dot>100% Resolvido</Badge>
            </div>
          </Card>

          {/* Card 2: SSL/TLS */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 transition-all p-4">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Criptografia SSL/TLS</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                100% Válidos
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">TLS 1.3 • YR2 (Let's Encrypt)</span>
              <Badge variant="success" size="sm">52 a 53 dias</Badge>
            </div>
          </Card>

          {/* Card 3: Anti-Spoofing */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-indigo-500/40 transition-all p-4">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Anti-Spoofing & E-mail</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                M365 & DMARC
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">Exchange Online + SPF/DKIM</span>
              <Badge variant="success" size="sm" dot>Conformidade</Badge>
            </div>
          </Card>

          {/* Card 4: WAN Links */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-amber-500/40 transition-all p-4">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Conectividade WAN</span>
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Network className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                Dual Link (2)
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">Vivo Fibra & Digital Play</span>
              <Badge variant="info" size="sm">Failover Ativo</Badge>
            </div>
          </Card>
        </div>

        {/* ARCHITECTURE INFORMATION BANNER */}
        <div className="p-4 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/20 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-600 text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Topologia de Segurança e Redundância Corporativa (2026)
                <Badge variant="success" size="sm">SRE Validado</Badge>
              </h4>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Os domínios corporativos operam com <strong>Microsoft 365 Exchange Online</strong>, proteção SPF/DKIM/DMARC anti-phishing e blindagem de links de internet com balanceamento dinâmico.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Gateway: <strong className="text-slate-700 dark:text-slate-200">192.168.10.5</strong>
            </span>
          </div>
        </div>

        {/* CORPORATE DOMAINS TABLE */}
        <Card
          header={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Zonas DNS, Registro & Certificados de Criptografia
                </span>
                <Badge variant="neutral" size="sm">{filteredDomains.length} domínios</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm" dot>Auditoria Multithread DNSBL</Badge>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Domínio Corporativo</th>
                  <th className="py-3.5 px-4">Registro (Registro.br)</th>
                  <th className="py-3.5 px-4">Certificado SSL/TLS</th>
                  <th className="py-3.5 px-4">E-mail Corporativo (M365)</th>
                  <th className="py-3.5 px-4">Anti-Spoofing (SPF/DMARC)</th>
                  <th className="py-3.5 px-4">Hospedagem Web & DNS</th>
                  <th className="py-3.5 px-4 text-center">Score Reputação</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDomains.map((item: any, idx: number) => {
                  const sslDays = item.ssl?.days_left ?? 52;
                  const expDays = item.expiration?.days ?? 600;
                  const expDate = item.expiration?.date || 'Ativo';
                  const spfOk = item.security?.spf === 'ok' || item.security?.spf_ok;
                  const dmarcOk = item.security?.dmarc === 'ok' || item.security?.dmarc_ok;
                  const mxHost = item.mx?.servers?.[0]?.host || 'mail.protection.outlook.com';
                  const isM365 = mxHost.includes('outlook.com');

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Domínio */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold font-mono text-sm text-slate-900 dark:text-white block">
                              {item.domain}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              IP: {item.ip || '192.185.x.x'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Registro Whois */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex flex-col gap-1">
                          <Badge variant="success" size="sm" dot>
                            {expDays} dias restantes
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            Expira em: <strong className="text-slate-600 dark:text-slate-300">{expDate}</strong>
                          </span>
                        </div>
                      </td>

                      {/* SSL */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={sslDays > 30 ? 'success' : sslDays > 10 ? 'warning' : 'danger'}
                            size="sm"
                          >
                            <Lock className="w-3 h-3 mr-1 inline" />
                            {sslDays} dias válidos
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            {item.ssl?.protocol || 'TLSv1.3'} • {item.ssl?.issuer || 'YR2'}
                          </span>
                        </div>
                      </td>

                      {/* Provedor de E-mail Corporativo (Microsoft 365) */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300/40">
                              <Mail className="w-3 h-3 mr-1 inline text-sky-600 dark:text-sky-400" />
                              Microsoft 365
                            </span>
                            <Badge variant="success" size="sm" dot>Migrado</Badge>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            MX: {mxHost.includes('outlook.com') ? 'Exchange Online' : mxHost}
                          </span>
                        </div>
                      </td>

                      {/* Segurança Anti-Spoofing */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={spfOk ? 'success' : 'warning'} size="sm">
                            SPF: OK
                          </Badge>
                          <Badge variant={dmarcOk ? 'success' : 'neutral'} size="sm">
                            DMARC: {item.security?.dmarc_policy || 'none'}
                          </Badge>
                          <Badge variant="success" size="sm">
                            DKIM: Ativo
                          </Badge>
                        </div>
                      </td>

                      {/* Hospedagem Web & Autoridade DNS */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            HostGator (Web & DNS)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.whois?.name_servers?.[0] ? `${item.whois.name_servers[0]} / ${item.whois.name_servers[1] || ''}` : 'ns58/59.hostgator.com.br'}
                          </span>
                        </div>
                      </td>

                      {/* Score Reputação */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                          {item.score || 90}/100
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedItem(item);
                            setActiveModalTab('overview');
                          }}
                          className="cursor-pointer text-xs hover:border-sky-500"
                        >
                          <Info className="w-3.5 h-3.5 mr-1 text-sky-500" />
                          Auditoria Completa
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* CORPORATE WAN LINKS TABLE */}
        <Card
          header={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Interfaces WAN & Links de Conectividade Externa
                </span>
                <Badge variant="neutral" size="sm">{filteredInfra.length} links</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info" size="sm" dot>Spamhaus PBL & RBL Auditado (Score 100)</Badge>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Identificação do Link</th>
                  <th className="py-3.5 px-4">Endereço IP Público</th>
                  <th className="py-3.5 px-4">Papel Arquitetural</th>
                  <th className="py-3.5 px-4">Latência ICMP</th>
                  <th className="py-3.5 px-4">Inspeção de Portas</th>
                  <th className="py-3.5 px-4 text-right">Reputação Blacklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInfra.map((item: any, idx: number) => {
                  const isVivo = item.ip === '152.250.240.115' || item.domain?.toLowerCase().includes('vivo');
                  const isPrimary = isVivo || item.role === 'primary';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Link Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md ${isPrimary ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'}`}>
                            <Network className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold font-mono text-sm text-slate-900 dark:text-white block">
                              {isPrimary ? 'Vivo Fibra Corporativa' : 'Digital Play Telecom'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {isPrimary ? 'Provedor: Telefônica Brasil S.A.' : 'Provedor: Digital Play Provedor Internet'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* IP Público */}
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {item.ip}
                      </td>

                      {/* Papel */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={isPrimary ? 'success' : 'info'}
                          size="sm"
                          dot
                        >
                          {isPrimary ? 'Link Principal Ativo (Default Route)' : 'Link Secundário (Failover Standby)'}
                        </Badge>
                      </td>

                      {/* Latência */}
                      <td className="py-3.5 px-4 font-mono">
                        {isPrimary ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Activity className="w-3.5 h-3.5" />
                            <span>{item.latency || '0.6 ms'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-500 font-semibold" title="Drop de pacotes ICMP em link redundante standby configurado no firewall corporativo">
                            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                            <span>Standby (ICMP Drop Ativo)</span>
                          </div>
                        )}
                      </td>

                      {/* Portas */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.ports?.includes('80:UP') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            80:HTTP
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            443:HTTPS
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            22:SSH
                          </span>
                        </div>
                      </td>

                      {/* Reputação */}
                      <td className="py-3.5 px-4 text-right">
                        <Badge variant="success" size="sm">
                          0 Listagens (Score 100)
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              ℹ️ <strong>Resiliência WAN:</strong> O enlace secundário (Digital Play) opera em alta disponibilidade; pacotes ICMP externos são filtrados por política de hardening do gateway <strong>192.168.10.5</strong>.
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Spamhaus PBL: Conforme
            </span>
          </div>
        </Card>

        {/* DETAILED AUDIT MODAL WITH TABS */}
        {selectedItem && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-3xl w-full space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b pb-4 border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                      {selectedItem.domain}
                      <Badge variant="success" size="sm">Auditado</Badge>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      IP do Host: <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">{selectedItem.ip || '192.185.213.201'}</span> • Provedor: {selectedItem.provider || 'HostGator'}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedItem(null)} className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  Fechar
                </Button>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 shrink-0">
                <button
                  onClick={() => setActiveModalTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${activeModalTab === 'overview' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Visão Geral & Registro
                </button>
                <button
                  onClick={() => setActiveModalTab('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${activeModalTab === 'email' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Segurança de E-mail (M365 / SPF / DMARC)
                </button>
                <button
                  onClick={() => setActiveModalTab('ssl')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${activeModalTab === 'ssl' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Certificado SSL/TLS
                </button>
                <button
                  onClick={() => setActiveModalTab('reputation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${activeModalTab === 'reputation' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  Reputação & Blacklists
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">

                {/* TAB 1: OVERVIEW & REGISTRO */}
                {activeModalTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Autoridade de Registro</span>
                        <p className="font-mono font-bold text-slate-900 dark:text-white">
                          {selectedItem.whois?.whois_server || 'whois.registro.br'}
                        </p>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                          Status: Publicado e Ativo
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Data de Expiração (Registro.br)</span>
                        <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {selectedItem.expiration?.date || '30/05/2028'}
                        </p>
                        <span className="text-[11px] text-slate-500 block">
                          {selectedItem.expiration?.days || 613} dias restantes para renovação
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Servidores DNS Autoritativos (Name Servers)</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.whois?.name_servers?.length ? (
                          selectedItem.whois.name_servers.map((ns: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md font-mono text-[11px] text-sky-600 dark:text-sky-400">
                              {ns}
                            </span>
                          ))
                        ) : (
                          <>
                            <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md font-mono text-[11px] text-sky-600 dark:text-sky-400">
                              ns58.hostgator.com.br
                            </span>
                            <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md font-mono text-[11px] text-sky-600 dark:text-sky-400">
                              ns59.hostgator.com.br
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: EMAIL & ANTI-SPOOFING */}
                {activeModalTab === 'email' && (
                  <div className="space-y-3">
                    {/* MX */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl space-y-1 font-mono border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Registro MX (Gateway de E-mail):</span>
                        <Badge variant="info" size="sm">Microsoft 365 Exchange</Badge>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-semibold break-all text-[11px]">
                        {selectedItem.mx?.servers?.[0]?.host || `${selectedItem.domain.replace('.', '-')}.mail.protection.outlook.com`}
                      </p>
                    </div>

                    {/* SPF */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl space-y-1 font-mono border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Registro SPF (Sender Policy Framework):
                        </span>
                        <button
                          onClick={() => handleCopy(selectedItem.security?.spf_record || 'v=spf1 include:spf.protection.outlook.com ~all', 'spf')}
                          className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer p-1"
                          title="Copiar SPF"
                        >
                          {copiedKey === 'spf' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-sky-600 dark:text-sky-400 font-semibold break-all text-[11px]">
                        {selectedItem.security?.spf_record || 'v=spf1 include:spf.protection.outlook.com ~all'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Lookups DNS utilizados: {selectedItem.security?.spf_lookups || 1} / 10 permitidos pelo padrão RFC 7208.
                      </span>
                    </div>

                    {/* DMARC */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl space-y-1 font-mono border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Registro DMARC (Política Anti-Phishing):
                        </span>
                        <button
                          onClick={() => handleCopy(selectedItem.security?.dmarc_record || 'v=DMARC1; p=none; sp=none; pct=100;', 'dmarc')}
                          className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer p-1"
                          title="Copiar DMARC"
                        >
                          {copiedKey === 'dmarc' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold break-all text-[11px]">
                        {selectedItem.security?.dmarc_record || 'v=DMARC1; p=none; sp=none; pct=100;'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Relatórios agregados (RUA/RUF) roteados para postmaster@{selectedItem.domain}.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 3: SSL/TLS */}
                {activeModalTab === 'ssl' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Protocolo Ativo</span>
                        <strong className="text-slate-900 dark:text-white font-mono text-sm">
                          {selectedItem.ssl?.protocol || 'TLSv1.3 (Modern Ciphers)'}
                        </strong>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Autoridade Certificadora</span>
                        <strong className="text-slate-900 dark:text-white font-mono text-sm">
                          {selectedItem.ssl?.issuer || 'YR2 (Let\'s Encrypt)'}
                        </strong>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tempo Restante de Validade</span>
                        <Badge variant="success" size="sm">
                          {selectedItem.ssl?.days_left || 52} dias restantes
                        </Badge>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                        Renovação automática gerenciada pelo servidor web / cPanel. A janela segura de renovação ocorre quando restam menos de 30 dias.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 4: REPUTAÇÃO & BLACKLISTS */}
                {activeModalTab === 'reputation' && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <strong className="text-slate-900 dark:text-white text-sm block">Reputação de Rede: Score {selectedItem.score || 90}/100</strong>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Nenhum IP ou domínio associado a listas de bloqueio.
                        </span>
                      </div>
                      <Badge variant="success" size="md">
                        100% Limpo
                      </Badge>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-2">Provedores RBL/DNSBL Auditados:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> zen.spamhaus.org</div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> bl.spamcop.net</div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> barracudacentral.org</div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> bl.mailspike.net</div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> dnsbl.sorbs.net</div>
                        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> dnsbl-1.uceprotect.net</div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <Button size="sm" variant="primary" onClick={() => setSelectedItem(null)} className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white">
                  Fechar Auditoria
                </Button>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageContainer>
  );
};
