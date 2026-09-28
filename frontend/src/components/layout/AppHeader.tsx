import React, { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { useTheme } from '@/app/providers';
import {
  LayoutDashboard,
  Layers,
  Globe,
  Printer,
  Database,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  FolderGit2,
  FileText,
  Moon,
  Sun,
  Search,
  LogOut,
  Command,
  Menu,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';

export interface AppHeaderProps {
  onOpenCommand?: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenCommand,
  activeTab,
  onTabChange,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  const tabMapping = [
    { id: 'overview', title: 'Visão Geral', icon: LayoutDashboard, desc: 'Indicadores & KPIs' },
    { id: 'applications', title: 'Aplicações', icon: Layers, desc: 'Apps & Web Services' },
    { id: 'bitdefender', title: 'Bitdefender', icon: ShieldAlert, desc: 'Segurança & Quarentena' },
    { id: 'kinghost', title: 'KingHost', icon: Globe, desc: 'Watchdog PM2' },
    { id: 'printers', title: 'Impressoras', icon: Printer, desc: 'Frota Lexmark' },
    { id: 'backups', title: 'Backups', icon: Database, desc: '22 Volumes Híbridos' },
    { type: 'separator' as const },
    { id: 'infrastructure', title: 'Infraestrutura', icon: Cpu, desc: 'Debian 13 & Discos' },
    { id: 'domains', title: 'Domínios', icon: ShieldCheck, desc: 'DNS, SSL & WAN' },
    { id: 'samba', title: 'Samba & ACLs', icon: FolderGit2, desc: 'Diretórios AD' },
    { id: 'reports', title: 'Relatórios', icon: FileText, desc: 'Documentação & Logs' },
  ];

  const expandableTabsData = tabMapping.map((t) => {
    if ('type' in t && t.type === 'separator') {
      return { type: 'separator' as const };
    }
    return {
      title: t.title!,
      icon: t.icon!,
    };
  });

  const activeIndex = tabMapping.findIndex((t) => 'id' in t && t.id === activeTab);

  const handleTabChange = (index: number | null) => {
    if (index !== null && index >= 0 && index < tabMapping.length) {
      const target = tabMapping[index];
      if ('id' in target && target.id) {
        onTabChange(target.id);
      }
    }
  };

  const handleMobileNav = (tabId: string) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* Left Brand Logo - Sleek & Compact */}
            <div
              className="flex items-center gap-2 shrink-0 cursor-pointer group"
              onClick={() => onTabChange('overview')}
              title="Ir para Visão Geral"
            >
              <img
                src={BRAND.logoCompact}
                alt="SRE Core Platform"
                className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-2 ml-0.5">
                <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-200 leading-none">
                  Plataforma TI
                </span>
                <span className="hidden sm:inline text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                  SRE & Observabilidade 2026
                </span>
              </div>
            </div>

            {/* Center Expandable Tabs Navbar (Visible on Desktop / Laptops) */}
            <div className="hidden lg:flex flex-1 justify-center items-center min-w-0 px-2 overflow-x-auto no-scrollbar">
              <ExpandableTabs
                tabs={expandableTabsData}
                selectedIndex={activeIndex >= 0 ? activeIndex : 0}
                onChange={handleTabChange}
                activeColor="text-sky-600 dark:text-sky-400"
              />
            </div>

            {/* Right Section: Search Command, Status & Quick Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Command palette search trigger */}
              <button
                onClick={onOpenCommand}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 rounded-lg transition-colors cursor-pointer"
                title="Pesquisa Rápida (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline text-slate-500 dark:text-slate-400 text-[11px] font-medium">Buscar</span>
                <kbd className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-mono font-medium text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-2xs">
                  <Command className="w-2.5 h-2.5" /> K
                </kbd>
              </button>

              {/* Health Status Indicator */}
              <Badge variant="success" dot className="hidden md:inline-flex py-1 px-2 text-[11px] font-semibold">
                SRE Nominal
              </Badge>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sair do Sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Hamburger Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Abrir Menu de Navegação"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-rose-500" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile / Tablet Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img src={BRAND.logoCompact} alt="Logo" className="h-6 w-auto" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Menu de Navegação</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Search */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenCommand?.();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-500" />
                  <span>Busca de recursos...</span>
                </span>
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">Ctrl+K</kbd>
              </button>
            </div>

            {/* Drawer Links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {tabMapping.map((item, idx) => {
                if ('type' in item && item.type === 'separator') {
                  return <div key={`sep-${idx}`} className="my-2 border-t border-slate-200 dark:border-slate-800" />;
                }
                const Icon = item.icon!;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMobileNav(item.id!)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800 shadow-2xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate">{item.desc}</div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>SRE Dashboard 2026</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
