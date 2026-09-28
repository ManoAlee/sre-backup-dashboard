import React, { useState } from 'react';
import { ThemeProvider } from '@/app/providers';
import { AppHeader } from '@/components/layout/AppHeader';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { ApplicationsPage } from '@/features/applications/ApplicationsPage';
import { BitdefenderPage } from '@/features/bitdefender/BitdefenderPage';
import { BackupsPage } from '@/features/backups/BackupsPage';
import { InfrastructurePage } from '@/features/infrastructure/InfrastructurePage';
import { DomainsPage } from '@/features/domains/DomainsPage';
import { SambaPage } from '@/features/samba/SambaPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { KingHostPage } from '@/features/kinghost/KingHostPage';
import { PrintersPage } from '@/features/printers/PrintersPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Search, Database, Server, Globe, Network, FileText, Activity, Printer, ShieldAlert, Layers } from 'lucide-react';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  // Check if we are on login path
  const isLoginPage = window.location.pathname === '/login';
  if (isLoginPage) {
    return <LoginPage />;
  }

  const searchCommands = [
    { label: 'Visão Geral & Indicadores', tab: 'overview', icon: <Search className="w-4 h-4 text-sky-500" /> },
    { label: 'Aplicações Corporativas & Web Services', tab: 'applications', icon: <Layers className="w-4 h-4 text-sky-500" /> },
    { label: 'Segurança & Bitdefender GravityZone', tab: 'bitdefender', icon: <ShieldAlert className="w-4 h-4 text-rose-500" /> },
    { label: 'Watchdog KingHost (Node.js & PM2)', tab: 'kinghost', icon: <Activity className="w-4 h-4 text-sky-500" /> },
    { label: 'Impressoras Lexmark & Suprimentos', tab: 'printers', icon: <Printer className="w-4 h-4 text-sky-500" /> },
    { label: 'Matriz de Backups (22 Volumes)', tab: 'backups', icon: <Database className="w-4 h-4 text-sky-500" /> },
    { label: 'Infraestrutura de Servidores & Discos', tab: 'infrastructure', icon: <Server className="w-4 h-4 text-sky-500" /> },
    { label: 'Governança de Domínios & SSL', tab: 'domains', icon: <Globe className="w-4 h-4 text-sky-500" /> },
    { label: 'Compartilhamentos Samba & Permissões ACL', tab: 'samba', icon: <Network className="w-4 h-4 text-sky-500" /> },
    { label: 'Relatórios Operacionais & Diários de Bordo', tab: 'reports', icon: <FileText className="w-4 h-4 text-sky-500" /> },
  ];

  const filteredCommands = searchCommands.filter(c =>
    c.label.toLowerCase().includes(commandSearch.toLowerCase())
  );

  const handleSelectCommand = (tabId: string) => {
    setActiveTab(tabId);
    setIsCommandOpen(false);
    setCommandSearch('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCommand={() => setIsCommandOpen(true)}
      />

      <div className="flex-1">
        {activeTab === 'overview' && <OverviewPage onNavigateToTab={setActiveTab} />}
        {activeTab === 'applications' && <ApplicationsPage />}
        {activeTab === 'bitdefender' && <BitdefenderPage />}
        {activeTab === 'kinghost' && <KingHostPage />}
        {activeTab === 'printers' && <PrintersPage />}
        {activeTab === 'backups' && <BackupsPage />}
        {activeTab === 'infrastructure' && <InfrastructurePage />}
        {activeTab === 'domains' && <DomainsPage />}
        {activeTab === 'samba' && <SambaPage />}
        {activeTab === 'reports' && <ReportsPage />}
      </div>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>SRE Core Platform® — Plataforma Corporativa de Operações e Infraestrutura TI.</span>
          <span>Ambiente Autenticado • AD SSO Guard</span>
        </div>
      </footer>

      {/* Command Center Modal (Ctrl+K) */}
      <Modal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        title="Busca Rápida de Recursos Corporativos"
      >
        <div className="space-y-4">
          <Input
            placeholder="Digite para buscar páginas ou recursos..."
            value={commandSearch}
            onChange={e => setCommandSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
            autoFocus
          />
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {filteredCommands.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectCommand(item.tab)}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors font-medium text-slate-800 dark:text-slate-200"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};
