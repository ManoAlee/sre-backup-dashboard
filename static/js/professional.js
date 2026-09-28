(() => {
  window.onerror = function (msg, url, line, col, error) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.background = 'red';
    div.style.color = 'white';
    div.style.padding = '20px';
    div.style.zIndex = '9999';
    div.innerText = 'Error: ' + msg + '\nLine: ' + line + '\nCol: ' + col + '\nStack: ' + (error ? error.stack : '');
    document.body.appendChild(div);
  };


  const e = React.createElement;
  const root = document.getElementById('root');
  if (!root) { alert('Root element not found!'); return; }
  function useFetch(url, deps, opts) {
    const [state, setState] = React.useState({ loading: true, data: null, error: null });
    React.useEffect(() => {
      let mounted = true;
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timer = null;
      const doFetch = async () => {
        try {
          const fetchOpts = ac ? { signal: ac.signal } : {};
          const r = await fetch(url, fetchOpts);
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (r.statusText || ''));
          const j = await r.json();
          if (mounted) setState({ loading: false, data: j, error: null });
        } catch (err) {
          const isAbort = err && (err.name === 'AbortError' || err.message === 'The user aborted a request.');
          if (isAbort) {
            if (mounted) setState({ loading: false, data: null, error: 'aborted' });
          } else {
            if (mounted) setState({ loading: false, data: null, error: String(err) });
          }
        }
      };
      doFetch();
      if (opts && opts.pollInterval && Number(opts.pollInterval) > 0) {
        timer = setInterval(() => {
          doFetch();
        }, Number(opts.pollInterval));
      }
      return () => {
        mounted = false;
        try { if (ac) ac.abort(); } catch (e) { /* ignore */ }
        if (timer) clearInterval(timer);
      };
    }, Array.isArray(deps) && deps.length ? deps.concat([url, opts && opts.pollInterval]) : [url, opts && opts.pollInterval]);
    return state;
  }

  function ReportsStats({ history }) {
    const stats = React.useMemo(() => {
      if (!history) return { success: 0, fail: 0, total: 0 };
      return {
        total: history.length,
        success: history.filter(h => h.status === 'ok' || h.status === 'success').length,
        fail: history.filter(h => h.status === 'error').length
      };
    }, [history]);

    const heatmapData = React.useMemo(() => {
      const days = [];
      const today = new Date();
      const historyMap = new Map((history || []).map(h => [h.date, h]));
      for (let i = 34; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = historyMap.get(dateStr);
        days.push({ date: dateStr, status: entry ? entry.status : 'empty' });
      }
      return days;
    }, [history]);

    const getStatusColor = (status) => {
      if (status === 'error') return 'bg-red-500/60';
      if (status === 'warning') return 'bg-amber-500/60';
      if (status === 'empty') return 'bg-slate-200';
      return 'bg-emerald-500/60';
    }

    const StatCard = ({ label, value, color, icon }) => e('div', {
      className: 'glass-card p-6 flex flex-col gap-4 group transition-all duration-300 hover:bg-white'
    },
      e('div', { className: 'flex justify-between items-start' },
        e('span', { className: 'text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]' }, label),
        e('span', { className: 'text-xl opacity-20 group-hover:opacity-40 transition-opacity' }, icon)
      ),
      e('div', { className: `text-4xl font-light tracking-tight ${color}` }, value)
    );

    return e('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 px-2 animate-fade-in' },
      e(StatCard, { label: 'Total Execuções', value: stats.total, color: 'text-slate-800', icon: '∑' }),
      e(StatCard, { label: 'Sucessos', value: stats.success, color: 'text-emerald-400', icon: '✓' }),
      e(StatCard, { label: 'Falhas / Erros', value: stats.fail, color: 'text-red-400', icon: '✕' }),

      e('div', { className: 'glass-card p-6 flex flex-col justify-between group hover:bg-white transition-all' },
        e('div', { className: 'text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-4' }, 'Disponibilidade (35d)'),
        e('div', { className: 'grid grid-cols-7 gap-1.5' },
          heatmapData.map((d, i) => e('div', {
            key: i,
            className: `w-full aspect-square rounded-[1px] transition-colors duration-500 ${getStatusColor(d.status)}`,
            title: `${d.date}: ${d.status}`
          }))
        )
      )
    );
  }

  function ReportsTimeline({ history, selectedReport, onSelect, searchTerm, onSearch }) {
    if (!history) return null;

    const filteredHistory = React.useMemo(() => {
      if (!searchTerm) return history;
      const lower = searchTerm.toLowerCase();
      return history.filter(h => h.date.includes(lower) || h.status.toLowerCase().includes(lower));
    }, [history, searchTerm]);

    const grouped = React.useMemo(() => {
      const groups = [];
      let currentMonth = '';
      filteredHistory.forEach(h => {
        const dateObj = new Date(h.date + 'T12:00:00');
        const monthYear = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (monthYear !== currentMonth) {
          groups.push({ type: 'header', label: monthYear.charAt(0).toUpperCase() + monthYear.slice(1) });
          currentMonth = monthYear;
        }
        groups.push({ type: 'item', data: h });
      });
      return groups;
    }, [filteredHistory]);

    return e('div', { className: 'w-full md:w-[350px] flex flex-col p-0 overflow-hidden shrink-0 border-r border-slate-200 h-[850px] animate-fade-in transition-all' },
      // Card-style Search Header
      e('div', { className: 'px-6 py-8 space-y-6' },
        e('div', { className: 'flex justify-between items-baseline px-1' },
          e('h3', { className: 'text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]' }, 'Cronologia'),
          e('span', { className: 'text-[9px] text-slate-600 font-mono' }, filteredHistory.length)
        ),
        e('div', { className: 'relative glass-card bg-white border border-slate-200 rounded-xl overflow-hidden group focus-within:border-blue-500/30 transition-all' },
          e('input', {
            type: 'text',
            placeholder: 'Filtrar registros...',
            value: searchTerm,
            onChange: (ev) => onSearch(ev.target.value),
            className: 'w-full bg-transparent px-10 py-3 text-xs text-slate-900 outline-none placeholder-slate-400'
          }),
          e('span', { className: 'absolute left-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-50 transition-opacity' }, '🔍')
        )
      ),

      e('div', { className: 'flex-1 overflow-y-auto custom-scrollbar px-5 pb-8 space-y-3' },
        grouped.map((node, index) => {
          if (node.type === 'header') {
            return e('div', {
              key: node.label,
              className: 'sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md py-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2'
            }, node.label);
          }

          const h = node.data;
          const isSelected = selectedReport && selectedReport.date === h.date;
          const isError = h.status !== 'ok' && h.status !== 'success';

          return e('div', {
            key: h.date,
            onClick: () => onSelect(h),
            role: 'button',
            tabIndex: 0,
            onKeyDown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') onSelect(h); },
            className: `glass-card p-4 cursor-pointer group transition-all duration-300 border ${isSelected ? 'border-blue-500/40 bg-blue-50/50 translate-x-1' : 'border-slate-100 hover:border-slate-200 hover:bg-white'}`,
            style: { animationDelay: `${index * 30}ms` }
          },
            e('div', { className: 'flex justify-between items-center mb-1' },
              e('span', { className: `text-xs font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500'}` },
                new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
              ),
              e('div', { className: `w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-emerald-500'} ${isSelected ? 'animate-pulse' : ''}` })
            ),
            e('div', { className: 'flex justify-between items-end' },
              e('span', { className: 'text-[10px] text-slate-600 font-mono italic' }, h.date),
              isError && e('span', { className: 'text-[8px] font-black text-red-500/60 uppercase tracking-tighter' }, 'Failure')
            )
          );
        }),

        filteredHistory.length === 0 && e('div', { className: 'p-12 text-center flex flex-col items-center gap-4 text-slate-600' },
          e('div', { className: 'text-4xl opacity-10' }, '🔍'),
          e('div', { className: 'text-[10px] font-black uppercase tracking-widest' }, 'Nenhum resultado')
        )
      )
    );
  }

  function ReportDetail({ report, onBack }) {
    const [useDarkMode, setUseDarkMode] = React.useState(true);
    if (!report) {
      return e('div', { className: 'flex-1 flex flex-col items-center justify-center text-slate-600 p-12 min-h-[600px] glass-card border-dashed bg-white/50 animate-fade-in' },
        e('div', { className: 'text-4xl mb-6 opacity-10 grayscale' }, '📄'),
        e('div', { className: 'text-[10px] font-black uppercase tracking-[0.2em] text-slate-700' }, 'Selecione um registro')
      );
    }

    const isOk = report.status === 'ok' || report.status === 'success';

    return e('div', { className: 'flex-1 flex flex-col relative min-h-[850px] glass-card overflow-hidden animate-fade-in' },
      // Card Header
      e('div', { className: 'px-8 py-10 border-b border-white/5 flex flex-col gap-8 bg-white/[0.01]' },
        e('div', { className: 'flex flex-col md:flex-row justify-between items-start gap-4' },
          e('div', { className: 'flex gap-6 items-center' },
            e('button', { onClick: onBack, className: 'md:hidden p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 transition-all' }, '←'),
            e('div', null,
              e('h2', { className: 'text-xl font-light text-slate-900 tracking-tight' }, 'Relatório de Execução'),
              e('div', { className: 'flex items-center gap-2 mt-1.5' },
                e('div', { className: `w-2 h-2 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse` }),
                e('span', { className: 'text-[10px] font-mono text-slate-600' }, report.date)
              )
            )
          ),
          e('div', { className: 'flex items-center gap-3 w-full md:w-auto' },
            e('button', {
              onClick: () => setUseDarkMode(!useDarkMode),
              className: 'flex-1 md:flex-none px-4 py-2 rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all'
            }, useDarkMode ? 'Eclipse' : 'Solstice'),
            e('a', {
              href: `/api/reports/download/${report.date}`,
              target: '_blank',
              className: 'flex-1 md:flex-none px-4 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all'
            }, 'Download Log')
          )
        ),

        // Metadata Bar
        e('div', { className: 'flex flex-wrap gap-8 py-4 px-6 rounded-xl bg-white/[0.02] border border-white/5' },
          e('div', { className: 'flex flex-col gap-1' },
            e('span', { className: 'text-[8px] font-black text-slate-600 uppercase tracking-widest' }, 'Status'),
            e('span', { className: `text-[10px] font-bold ${isOk ? 'text-emerald-400' : 'text-red-400'}` }, isOk ? 'COMPLETED' : 'FAILED')
          ),
          e('div', { className: 'flex flex-col gap-1' },
            e('span', { className: 'text-[8px] font-black text-slate-600 uppercase tracking-widest' }, 'Audit ID'),
            e('span', { className: 'text-[10px] font-mono text-slate-600' }, report.date.replace(/[^0-9]/g, '').substring(0, 12))
          ),
          e('div', { className: 'flex flex-col gap-1' },
            e('span', { className: 'text-[8px] font-black text-slate-600 uppercase tracking-widest' }, 'Complexity'),
            e('span', { className: 'text-[10px] text-slate-600' }, 'SYSTEM_LOG_v2')
          )
        )
      ),

      // Iframe / Content
      e('div', { className: 'flex-1 bg-white relative' },
        e('iframe', {
          src: `/api/reports/view/${report.date}`,
          className: 'w-full h-full border-none transition-opacity duration-700',
          title: 'Report Content',
          style: {
            filter: useDarkMode ? 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.1)' : 'none',
            backgroundColor: 'white'
          }
        })
      )
    );
  }

  function ReportsHistory() {
    const { data: history, loading, error, refresh } = useFetch('/api/reports/history', []);
    const [selectedReport, setSelectedReport] = React.useState(null);
    const [mobileView, setMobileView] = React.useState('list');
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
      if (selectedReport) setMobileView('detail');
    }, [selectedReport]);

    if (loading) return e('div', { className: 'p-12 flex flex-col justify-center items-center h-[500px]' },
      e('div', { className: 'w-8 h-8 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-4' }),
      e('div', { className: 'text-[10px] text-slate-600 uppercase tracking-widest' }, 'Synchronizing...')
    );

    if (error) return e('div', { className: 'p-24 text-center glass-card' },
      e('div', { className: 'text-red-400 text-xs mb-6 font-mono' }, String(error)),
      e('button', { onClick: () => refresh(), className: 'px-6 py-2 rounded-lg bg-white border border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-600 hover:text-blue-600 transition-all' }, 'Retry Connection')
    );

    return e('div', { className: 'flex flex-col min-h-[calc(100vh-100px)] animate-fade-in' },
      // Layout Header
      e('div', { className: 'flex flex-col md:flex-row md:items-baseline justify-between mb-12 px-4 gap-4' },
        e('div', { className: 'flex items-baseline gap-4' },
          e('h2', { className: 'text-2xl font-light text-slate-900 tracking-tight' }, 'Automation Audit'),
          e('div', { className: 'h-4 w-px bg-slate-200 hidden md:block' }),
          e('span', { className: 'text-[9px] text-slate-500 font-mono tracking-[0.3em] uppercase' }, 'System Logs v2.1')
        ),
        e('button', {
          onClick: refresh,
          className: 'self-start md:self-auto px-5 py-2 rounded-full border border-slate-200 bg-white text-[9px] text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all uppercase font-black tracking-[0.2em]'
        }, 'Refresh Repository')
      ),

      e(ReportsStats, { history }),

      e('div', { className: 'flex-1 flex flex-col md:flex-row gap-8 mt-4 min-h-0' },
        e('div', { className: `${mobileView === 'list' ? 'flex' : 'hidden md:flex'} w-full md:w-auto flex-col` },
          e(ReportsTimeline, {
            history,
            selectedReport,
            searchTerm,
            onSearch: setSearchTerm,
            onSelect: (h) => { setSelectedReport(h); }
          })
        ),
        e('div', { className: `${mobileView === 'detail' ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 pb-12` },
          e(ReportDetail, { report: selectedReport, onBack: () => setMobileView('list') })
        )
      )
    );
  }

  function Header({ onRefresh, auto, toggleAuto, loading, lastUpdated, interval, setInterval, ribbonsEnabled, toggleRibbons }) {
    const intervalOptions = [
      e('option', { key: '5s', value: '5s' }, '5s'),
      e('option', { key: '30s', value: '30s' }, '30s'),
      e('option', { key: '1m', value: '1m' }, '1min'),
      e('option', { key: '5m', value: '5m' }, '5min')
    ];

    return e('div', { className: 'dashboard-header' },
      e('div', { className: 'dashboard-title' }, e('h1', null, 'Dashboard Profissional'), e('p', null, 'Visualização moderna - logs e Samba')),
      e('div', { className: 'dashboard-controls' },
        e('button', { className: 'btn-refresh', onClick: onRefresh, id: 'btn-refresh', 'aria-label': 'Atualizar dados do dashboard', disabled: loading }, loading ? e('div', { className: 'spinner', 'aria-hidden': false }) : 'Atualizar'),
        e('div', { className: 'auto-refresh-toggle' },
          e('div', { className: 'toggle-switch ' + (auto ? 'active' : ''), onClick: toggleAuto, role: 'switch', 'aria-checked': String(auto), tabIndex: 0, 'aria-label': 'Alternar auto-refresh' }),
          e('div', { className: 'last-update' }, auto ? 'Auto-refresh: ON' : 'Auto-refresh: OFF')
        ),
        e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          e('select', { className: 'interval-select', value: interval, onChange: (ev) => setInterval(ev.target.value), 'aria-label': 'Intervalo de auto-refresh' }, ...intervalOptions),
          e('button', { className: 'btn-ghost btn-small', onClick: toggleRibbons, 'aria-pressed': String(ribbonsEnabled), 'aria-label': 'Alternar fitas de fundo', title: ribbonsEnabled ? 'Desativar fitas de fundo' : 'Ativar fitas de fundo', style: { marginLeft: '6px' } }, ribbonsEnabled ? 'Fitas: ON' : 'Fitas: OFF'),
          e('div', { className: 'server-info', style: { marginLeft: '1rem', textAlign: 'right' } },
            e('div', null, window.location.hostname || ''),
            e('div', { className: 'last-update', style: { fontSize: '0.95rem' } }, e('span', { id: 'last-updated' }, lastUpdated || 'Última: --:----')),
            e('div', null, e('span', { id: 'header-alert', className: 'header-alert', style: { display: 'inline-block', marginLeft: '8px' } }, ''))
          )
        )
      )
    );
  }

  function Sparkline({ data, color }) {
    if (!data || data.length < 2) return null;
    const height = 40;
    const width = 120;
    const max = Math.max(...data, 100);
    const min = 0;
    const range = max - min;

    // Smooth line points
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return e('svg', { width: '100%', height: '100%', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', className: 'opacity-50' },
      e('polyline', {
        fill: 'none',
        stroke: color || 'currentColor',
        strokeWidth: '2',
        vectorEffect: 'non-scaling-stroke',
        points: points
      })
    );
  }

  function MetricCard({ label, value, unit, status, history, icon, colorTheme = 'slate', onClick }) {
    const themes = {
      slate: { text: 'text-slate-900', accent: 'text-slate-500', chart: '#64748b' },
      blue: { text: 'text-blue-900', accent: 'text-blue-600', chart: '#3b82f6' },
      purple: { text: 'text-purple-900', accent: 'text-purple-600', chart: '#8b5cf6' },
      emerald: { text: 'text-emerald-900', accent: 'text-emerald-600', chart: '#10b981' },
      amber: { text: 'text-amber-900', accent: 'text-amber-600', chart: '#f59e0b' },
      red: { text: 'text-red-900', accent: 'text-red-600', chart: '#ef4444' },
    };

    const theme = themes[colorTheme] || themes.slate;

    const isLoading = value === null || value === undefined || value === '—' || value === '-';

    return e('div', {
      className: `glass-card group ${isLoading ? 'skeleton' : ''} ${isLoading ? '' : 'cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]'} transition-all duration-500 scale-in`,
      onClick: isLoading ? undefined : onClick,
      style: { minHeight: '160px' }
    },
      // Header
      e('div', { className: 'flex justify-between items-start z-10 relative' },
        e('div', { className: 'flex items-center gap-3' },
          e('div', { className: `p-2 rounded-lg bg-slate-50 border border-slate-100 ${theme.accent} text-xl shadow-sm` }, icon || '📊'),
          e('div', null,
            e('div', { className: 'text-slate-600 text-[10px] font-bold uppercase tracking-widest' }, label),
            status && e('div', { className: `text-[10px] font-medium mt-0.5 ${status.className.includes('success') ? 'text-emerald-400' : status.className.includes('warning') ? 'text-amber-400' : 'text-slate-500'}` }, status.text)
          )
        ),
        // Mini Sparkline
        history && e('div', { className: 'w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity' },
          e(Sparkline, { data: history, color: theme.chart })
        )
      ),

      // Value Area
      e('div', { className: 'mt-6 z-10 relative' },
        isLoading ? e('div', { className: 'skeleton', style: { height: '48px', width: '60%' } }) : e('div', { className: 'flex items-baseline gap-1' },
          e('span', { className: `text-5xl font-light tracking-tighter ${theme.text} drop-shadow-md` }, value),
          unit && e('span', { className: 'text-sm font-medium text-slate-500 mb-1' }, unit)
        )
      ),

      // Footer / Progress Bar (New Design)
      e('div', { className: 'mt-5 relative' },
        e('div', { className: 'h-1 w-full bg-slate-200 rounded-full overflow-hidden' },
          e('div', {
            className: `h-full rounded-full transition-all duration-1000 ${colorTheme === 'red' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : colorTheme === 'amber' ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : colorTheme === 'emerald' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : theme.text.replace('text-', 'bg-').split(' ')[0]}`,
            style: { width: (typeof value === 'number' ? Math.min(value, 100) : (parseFloat(value) || 0)) + '%' }
          })
        )
      ),

      // Decorative corner glow
      e('div', { className: `absolute -bottom-10 -right-10 w-40 h-40 bg-${colorTheme === 'slate' ? 'blue' : colorTheme}-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-${colorTheme === 'slate' ? 'blue' : colorTheme}-500/20 transition-all duration-700` })
    );
  }

  const MemoMetricCard = React.memo(MetricCard);

  function SharesTable({ rows, onShowUsers, onEditACL }) {
    const [q, setQ] = React.useState('');
    const [sortBy, setSortBy] = React.useState('share');
    const [dir, setDir] = React.useState('asc');
    const [sizes, setSizes] = React.useState({});
    const [loadingSizes, setLoadingSizes] = React.useState({});

    const list = Array.isArray(rows) ? rows : (rows && rows.data) ? rows.data : (rows ? Object.values(rows) : []);
    const userCount = (r) => (r.acls && Array.isArray(r.acls)) ? r.acls.length : 0;

    const filtered = (list || []).filter(r => {
      if (!q) {
        if (r.path === '/dados-ext/compras' || r.path === '/dados-ext/.Trash-0') return false;
        return true;
      }
      const s = q.toLowerCase();
      return String(r.share || '').toLowerCase().indexOf(s) !== -1 || String(r.path || '').toLowerCase().indexOf(s) !== -1 || (r.acls || []).join(' ').toLowerCase().indexOf(s) !== -1;
    }).sort((a, b) => {
      let A = a[sortBy] || ''; let B = b[sortBy] || '';
      if (sortBy === 'user_count') { A = userCount(a); B = userCount(b); }
      if (typeof A === 'string') A = A.toLowerCase(); if (typeof B === 'string') B = B.toLowerCase();
      if (A < B) return dir === 'asc' ? -1 : 1; if (A > B) return dir === 'asc' ? 1 : -1; return 0;
    });

    const fetchSize = async (path) => {
      if (!path || sizes[path] || loadingSizes[path]) return;
      setLoadingSizes(prev => ({ ...prev, [path]: true }));
      try {
        const r = await fetch('/api/samba/directory-usage?path=' + encodeURIComponent(path));
        const j = await r.json();
        if (r.ok && j.size_bytes !== undefined) {
          setSizes(prev => ({ ...prev, [path]: j.size_bytes }));
        } else {
          setSizes(prev => ({ ...prev, [path]: -1 }));
        }
      } catch (e) {
        setSizes(prev => ({ ...prev, [path]: -1 }));
      }
      setLoadingSizes(prev => ({ ...prev, [path]: false }));
    };

    React.useEffect(() => {
      if (filtered && filtered.length > 0) {
        const timer = setTimeout(() => {
          filtered.forEach(r => {
            if (r.path) fetchSize(r.path);
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [filtered]);

    const formatSize = (bytes) => {
      if (bytes === undefined) return '';
      if (bytes === -1) return 'Erro';
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return e('div', { className: 'premium-table-container fade-in' },
      e('div', { className: 'flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100' },
        e('div', { className: 'flex items-center gap-3' },
          e('span', { className: 'text-sm font-bold uppercase tracking-widest text-slate-500' }, 'Samba Shares'),
          e('span', { className: 'px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100' }, filtered.length)
        ),
        e('div', { className: 'flex items-center gap-2' },
          e('input', {
            placeholder: 'Pesquisar...',
            'aria-label': 'Pesquisar shares',
            value: q,
            onChange: (ev) => setQ(ev.target.value),
            className: 'bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none transition-colors w-48'
          }),
          e('select', {
            value: sortBy,
            onChange: (ev) => setSortBy(ev.target.value),
            className: 'bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none transition-colors'
          },
            e('option', { value: 'share' }, 'Nome'),
            e('option', { value: 'path' }, 'Path'),
            e('option', { value: 'user_count' }, 'Usuários')
          ),
          e('button', { className: 'btn-ghost p-1.5', onClick: () => setDir(d => d === 'asc' ? 'desc' : 'asc') }, dir === 'asc' ? '↑' : '↓')
        )
      ),
      e('div', { className: 'overflow-x-auto' },
        e('table', { className: 'data-table' },
          e('thead', null,
            e('tr', null,
              e('th', { onClick: () => setSortBy('share'), className: 'cursor-pointer hover:text-blue-600 transition-colors' }, 'Share'),
              e('th', { onClick: () => setSortBy('path'), className: 'cursor-pointer hover:text-blue-600 transition-colors' }, 'Path'),
              e('th', { onClick: () => setSortBy('user_count'), className: 'cursor-pointer hover:text-blue-600 transition-colors' }, 'Usuários'),
              e('th', null, 'Tamanho'),
              e('th', null, 'Ações')
            )
          ),
          e('tbody', null,
            filtered.length === 0 ?
              e('tr', null, e('td', { colSpan: 5, className: 'text-center text-slate-500 py-8' }, 'Nenhuma share encontrada.')) :
              filtered.map((r, i) =>
                e('tr', { key: r.share, style: { animationDelay: i * 50 + 'ms' }, className: 'slide-up' },
                  e('td', { className: 'font-medium text-slate-900' }, r.share),
                  e('td', { className: 'text-slate-500 font-mono text-xs' }, r.path),
                  e('td', null,
                    e('span', {
                      className: 'cursor-pointer hover:scale-105 inline-block transition-transform px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600',
                      onClick: () => onShowUsers && onShowUsers({
                        share: r.share,
                        acls: r.acls || []
                      })
                    }, userCount(r) + ' usuários')
                  ),
                  e('td', null,
                    sizes[r.path] === undefined ?
                      (loadingSizes[r.path] ? e('div', { className: 'animate-pulse h-2 w-12 bg-slate-700 rounded' }) : e('span', { className: 'text-slate-600' }, '---')) :
                      e('span', { className: 'font-mono text-xs text-emerald-400' }, formatBytes(sizes[r.path]))
                  ),
                  e('td', null,
                    e('button', {
                      className: 'btn-neon',
                      style: { fontSize: '0.7rem', padding: '0.25rem 0.75rem' },
                      onClick: () => onEditACL && onEditACL({
                        path: r.path,
                        share: r.share,
                        acls: r.acls || [],
                        type: 'directory'
                      })
                    }, 'Editar ACL')
                  )
                )
              )
          )
        )
      )
    );
  }

  const MemoSharesTable = React.memo(SharesTable);
  function ProcessDetailModal({ process, onClose }) {
    if (!process) return null;
    const pid = process.pid || process.PID || 'Desconhecido';
    const user = process.username || process.user || 'Desconhecido';
    const name = process.name || (process.cmd ? process.cmd.split(' ')[0] : 'Desconhecido');
    const cpuNum = (process.cpu_percent !== undefined) ? Number(process.cpu_percent) : ((process.cpu !== undefined) ? Number(process.cpu) : 0);
    const memNum = (process.memory_percent !== undefined) ? Number(process.memory_percent) : ((process.mem_percent !== undefined) ? Number(process.mem_percent) : 0);
    const cmd = process.cmd || 'N/D';
    const badgeColor = cpuNum > 40 ? '#dc2626' : cpuNum > 20 ? '#f97316' : '#34d399';
    const formatPercent = (value) => (isNaN(value) ? '0.0' : value.toFixed(1));
    const status = process.status || 'Desconhecido';
    const threads = process.num_threads || process.threads || 'N/D';
    const cmdLine = process.cmdline || '';
    const exePath = process.exe || '';

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', {
        className: 'modal-window',
        onClick: (ev) => ev.stopPropagation(),
        style: { maxWidth: '760px', width: '90%', padding: '0', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 15px 40px rgba(0,0,0,0.1)' }
      },
        e('div', { style: { padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          e('div', null,
            e('div', { style: { fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' } }, name),
            e('div', { style: { fontSize: '0.85rem', color: '#64748b' } }, `PID ${pid} · ${user} `)
          ),
          e('button', { className: 'btn-ghost', onClick: onClose, style: { padding: '6px 10px', color: '#64748b' } }, 'Fechar')
        ),
        e('div', { style: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' } },
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' } },
            [['CPU', `${formatPercent(cpuNum)}% `, 'Consumo instantâneo', '#3b82f6'],
            ['Memória', `${formatPercent(memNum)}% `, 'Uso atual', '#a855f7'],
            ['Threads', String(threads), 'Threads ativos', '#eab308'],
            ['Status', status, 'Estado do processo', '#38bdf8']].map(([label, value, help, accent]) =>
              e('div', { key: label, style: { padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' } },
                e('div', { style: { fontSize: '0.75rem', letterSpacing: '0.08rem', color: '#64748b', textTransform: 'uppercase' } }, label),
                e('div', { style: { fontSize: '1.4rem', fontWeight: 600, color: accent } }, value),
                e('div', { style: { fontSize: '0.7rem', color: '#64748b', marginTop: '6px' } }, help)
              )
            )
          ),
          e('div', { style: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', fontSize: '0.85rem', color: '#334155' } },
            e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
              e('span', { style: { fontWeight: 600 } }, 'Linha de comando completa'),
              e('span', { style: { fontSize: '0.7rem', color: '#64748b' } }, cmdLine ? `PID ${pid} ` : '')
            ),
            e('div', { style: { maxHeight: '220px', overflowY: 'auto', paddingRight: '8px' } },
              e('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', margin: 0 } }, cmdLine || 'N/D')
            )
          ),
          exePath && e('div', { style: { fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.05rem' } }, `Binário: ${exePath} `),
          e('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } },
            e('span', { style: { padding: '6px 12px', borderRadius: '999px', background: `${badgeColor} 20`, color: badgeColor, fontSize: '0.8rem', border: `1px solid ${badgeColor} ` } }, 'Processo ativo'),
            e('span', { style: { padding: '6px 12px', borderRadius: '999px', background: '#eff6ff', color: '#2563eb', fontSize: '0.8rem' } }, `Usuário: ${user} `)
          )
        )
      )
    );
  }

  function ProcessTable({ rows, loading }) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [limit, setLimit] = React.useState(50);
    const [detailProcess, setDetailProcess] = React.useState(null);

    const tableRef = React.useRef(null);

    // after render, copy header labels into each td as data-label for mobile layout
    React.useEffect(() => {
      try {
        const container = tableRef.current;
        if (!container) return;
        const ths = Array.from(container.querySelectorAll('thead th')).map(t => t.textContent.trim());
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach(r => {
          const tds = r.querySelectorAll('td');
          tds.forEach((td, i) => {
            if (ths[i]) td.setAttribute('data-label', ths[i]);
          });
        });
      } catch (e) { /* ignore */ }
    }, [rows, loading]);

    // Prefer structured response from backend: {by_cpu: [...], by_mem: [...]}.
    let list = [];
    if (!rows) list = [];
    else if (Array.isArray(rows)) list = rows;
    else if (rows.by_cpu && Array.isArray(rows.by_cpu)) list = rows.by_cpu;
    else if (rows.by_mem && Array.isArray(rows.by_mem)) list = rows.by_mem;
    else if (rows.data && Array.isArray(rows.data)) list = rows.data;
    else list = Object.values(rows).flat ? Object.values(rows).flat() : [].concat.apply([], Object.values(rows));

    // Filter
    const filtered = list.filter(p => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      const name = p.name || (p.cmd ? p.cmd.split(' ')[0] : '');
      const user = p.username || p.user || '';
      const pid = String(p.pid || p.PID || '');
      return name.toLowerCase().includes(s) || user.toLowerCase().includes(s) || pid.includes(s);
    });

    const displayed = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    if (loading && list.length === 0) return e('div', { className: 'table-card' }, e('div', { className: 'table-title' }, 'Processos — Top CPU'), e('div', { className: 'p-4 flex items-center gap-2' }, e('div', { className: 'spinner' }), 'Carregando processos...'));

    const tableCard = e('div', { className: 'premium-table-container fade-in' },
      e('div', { className: 'flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100' },
        e('div', { className: 'flex items-center gap-3' },
          e('span', { className: 'text-sm font-bold uppercase tracking-widest text-slate-500' }, 'Top Processos'),
          e('span', { className: 'text-xs text-slate-600 font-normal normal-case' }, '(Ordenado por CPU/Mem)'),
          loading && e('div', { className: 'text-xs text-blue-600 animate-pulse ml-2' }, '⟳ Atualizando...')
        ),
        e('input', {
          type: 'text',
          className: 'bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none transition-colors w-64',
          placeholder: 'Buscar processo (nome, user, pid)...',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value)
        })
      ),
      e('div', { className: 'overflow-x-auto' },
        e('table', { ref: tableRef, className: 'data-table w-full' },
          e('thead', null,
            e('tr', null,
              e('th', { className: 'w-20' }, 'PID'),
              e('th', null, 'Usuário'),
              e('th', null, 'Processo'),
              e('th', { className: 'text-right' }, 'CPU %'),
              e('th', { className: 'text-right' }, 'Mem %'),
              e('th', null, 'Comando'),
              e('th', { className: 'w-20 text-center' }, 'Ações')
            )
          ),
          e('tbody', null,
            // show skeleton rows when loading and no data
            (loading && list.length === 0) ? [1, 2, 3].map(i => e('tr', { key: 's' + i, className: 'slide-up' },
              e('td', { colSpan: 7 }, e('div', { className: 'skeleton', style: { height: '48px', width: '100%' } }))
            )) : displayed.map((p, idx) => {
              const pid = p.pid || p.PID || ('#' + idx);
              const user = p.username || p.user || '';
              const name = p.name || (p.cmd ? p.cmd.split(' ')[0] : '');
              const cpuNum = (p.cpu_percent !== undefined) ? Number(p.cpu_percent) : ((p.cpu !== undefined) ? Number(p.cpu) : 0);
              const memNum = (p.memory_percent !== undefined) ? Number(p.memory_percent) : ((p.mem_percent !== undefined) ? Number(p.mem_percent) : 0);
              const cpu = cpuNum.toFixed(1);
              const mem = memNum.toFixed(2);
              const cmd = p.cmd || '';
              const cmdLine = p.cmdline || '';
              const cmdDisplay = cmdLine || cmd || 'N/D';

              // Status Color Logic
              const isCritical = cpuNum > 50 || memNum > 50;
              const isWarning = cpuNum > 20 || memNum > 20;
              const rowClass = isCritical ? 'bg-red-500/5 hover:bg-red-500/10' :
                isWarning ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                  'hover:bg-slate-200/30';

              return e('tr', { key: pid, className: `${rowClass} transition-colors slide-up`, style: { animationDelay: Math.min(idx * 30, 1000) + 'ms' } },
                e('td', { className: 'font-mono text-xs text-slate-600' }, String(pid)),
                e('td', { className: 'text-slate-600 text-xs' }, user),
                e('td', null,
                  e('div', { className: 'font-semibold text-slate-800 text-sm truncate max-w-[150px]', title: name }, name)
                ),
                e('td', { className: 'text-right' },
                  e('span', { className: `font-mono text-xs font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}` }, cpu + '%')
                ),
                e('td', { className: 'text-right' },
                  e('span', { className: `font-mono text-xs ${memNum > 50 ? 'text-purple-600' : 'text-slate-500'}` }, mem + '%')
                ),
                e('td', null,
                  e('div', { className: 'text-[10px] text-slate-600 font-mono truncate max-w-[200px]', title: cmdDisplay }, cmdDisplay)
                ),
                e('td', { className: 'text-center' },
                  e('button', {
                    className: 'btn-ghost p-1 text-slate-600 hover:text-white',
                    title: 'Ver detalhes',
                    'aria-label': `Ver detalhes do processo PID ${pid}`,
                    onClick: () => setDetailProcess(p)
                  }, '👁️')
                )
              );
            }))
        ),
        (list.length === 0 && !loading) ? e('div', { className: 'p-8 text-center text-slate-500' }, 'Nenhum processo encontrado.') : null,
        hasMore ? e('div', { className: 'p-4 text-center border-t border-white/5' },
          e('button', { className: 'btn-ghost text-xs uppercase tracking-wider', onClick: () => setLimit(l => l + 50) }, `Carregar mais (${filtered.length - limit})`)
        ) : null
      )
    );

    return e(React.Fragment, null,
      tableCard,
      e(ProcessDetailModal, { process: detailProcess, onClose: () => setDetailProcess(null) })
    );
  }

  const MemoProcessTable = React.memo(ProcessTable);



  // Render a summary card from an already-fetched payload (avoids extra fetches)
  // Enhanced Card for Grid View
  function ScriptStatusCard({ payload }) {
    const data = payload || {};
    const status = data.status || null;

    // Status Logic
    let colorClass = 'text-slate-500';
    let bgClass = 'bg-slate-100';
    let borderClass = 'border-slate-200';
    let icon = '?';
    let statusLabel = 'Desconhecido';

    if (status === 'ok') {
      colorClass = 'text-emerald-700';
      bgClass = 'bg-emerald-50';
      borderClass = 'border-emerald-100';
      icon = '✓';
      statusLabel = 'Sucesso';
    } else if (status === 'warning') {
      colorClass = 'text-amber-700';
      bgClass = 'bg-amber-50';
      borderClass = 'border-amber-100';
      icon = '!';
      statusLabel = 'Atenção';
    } else if (status === 'error') {
      colorClass = 'text-red-700';
      bgClass = 'bg-red-50';
      borderClass = 'border-red-100';
      icon = '✕';
      statusLabel = 'Falha';
    }

    const lastRun = data.last_mtime ? new Date(data.last_mtime * 1000).toLocaleString() : 'Nunca';

    return e('div', {
      className: `glass-card group flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${status === 'error' ? 'animate-pulse-slow border-red-500/30' : ''}`,
    },
      // Status Stripe
      e('div', { className: `absolute top-0 left-0 bottom-0 w-1 ${bgClass.replace('/10', '')}` }),

      e('div', { className: 'p-5 flex flex-col h-full gap-4' },
        // Header
        e('div', { className: 'flex justify-between items-start' },
          e('div', { className: 'flex items-center gap-3' },
            e('div', { className: `w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border ${borderClass} ${bgClass} ${colorClass}` }, icon),
            e('div', null,
              e('h4', { className: 'font-bold text-slate-900 leading-tight' }, data.script || 'Script'),
              e('div', { className: 'text-[10px] text-slate-500 font-mono mt-1' }, lastRun)
            )
          ),
          e('span', { className: `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${borderClass} ${bgClass} ${colorClass}` }, statusLabel)
        ),

        // Summary Content
        e('div', { className: 'flex-1 bg-white rounded-lg p-3 border border-slate-100 text-xs text-slate-700 leading-relaxed font-mono relative' },
          data.summary || 'Aguardando execução...',
          data.advice && e('div', { className: 'mt-2 pt-2 border-t border-slate-100 text-amber-700 flex gap-1.5' },
            e('span', null, '💡'),
            e('span', null, data.advice)
          )
        ),

        // Actions
        e('div', { className: 'flex justify-between items-center pt-1' },
          e('div', { className: 'text-[10px] text-slate-600' }, `ID: ${(data.script || '').substring(0, 8)}...`),
          e('button', {
            className: `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${data.log_path ? 'bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200' : 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500'}`,
            onClick: () => { if (data.log_path && data.openLog) data.openLog(data.log_path); },
            disabled: !data.log_path
          }, e('span', null, '📄'), 'Log Completo')
        )
      )
    );
  }



  function ScriptStatusTable({ list, openLog }) {
    if (!list || list.length === 0) return null;

    return e('div', { className: 'glass-card p-0 overflow-hidden animate-fade-in border border-slate-200' },
      e('div', { className: 'overflow-x-auto' },
        e('table', { className: 'w-full text-left text-sm border-collapse' },
          e('thead', { className: 'bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100' },
            e('tr', null,
              e('th', { className: 'p-4 w-16 text-center' }, 'St'),
              e('th', { className: 'p-4' }, 'Script Details'),
              e('th', { className: 'p-4 hidden md:table-cell' }, 'Execução'),
              e('th', { className: 'p-4' }, 'Resumo & Diagnóstico'),
              e('th', { className: 'p-4 text-right' }, 'Ações')
            )
          ),
          e('tbody', { className: 'divide-y divide-slate-100' },
            list.map(item => {
              const status = item.status || 'unknown';
              const lastRun = item.last_mtime ? new Date(item.last_mtime * 1000).toLocaleString() : 'Nunca';

              let icon = '?';
              let rowClass = 'hover:bg-slate-50/50';
              let statusColor = 'text-slate-500';

              if (status === 'ok') { icon = '✓'; statusColor = 'text-emerald-600'; }
              if (status === 'warning') { icon = '!'; statusColor = 'text-amber-600'; rowClass += ' bg-amber-50/30'; }
              if (status === 'error') { icon = '✕'; statusColor = 'text-red-600'; rowClass += ' bg-red-50/30'; }

              return e('tr', { key: item.script, className: `transition-colors ${rowClass}` },
                e('td', { className: 'p-4 text-center' },
                  e('div', { className: `w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold border border-slate-100 bg-white ${statusColor} shadow-sm` }, icon)
                ),
                e('td', { className: 'p-4' },
                  e('div', { className: 'font-bold text-slate-900' }, item.script),
                  e('div', { className: 'text-xs text-slate-500 font-mono mt-0.5' }, `ID: ${(item.script || '').substring(0, 12)}`)
                ),
                e('td', { className: 'p-4 hidden md:table-cell' },
                  e('div', { className: 'text-xs text-slate-500 font-mono' }, lastRun)
                ),
                e('td', { className: 'p-4' },
                  e('div', { className: `text-sm leading-relaxed ${status === 'error' ? 'text-red-700' : 'text-slate-600'}` }, item.summary),
                  item.advice && e('div', { className: 'mt-1 text-xs text-amber-700/80' }, `💡 ${item.advice}`)
                ),
                e('td', { className: 'p-4 text-right' },
                  e('button', {
                    className: 'px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600 rounded-lg transition-all shadow-sm',
                    onClick: () => { if (openLog && item.log_path) openLog(item.log_path); },
                    disabled: !item.log_path
                  }, 'Ver Log')
                )
              );
            })
          )
        )
      )
    );
  }

  function ScriptStatusDashboard({ list, openLog, reload }) {
    const [viewMode, setViewMode] = React.useState('grid'); // 'grid' | 'table'

    if (!list) return e('div', { className: 'flex justify-center p-12' }, e('div', { className: 'spinner' }));

    const sortedList = [...list].sort((a, b) => {
      const rank = { error: 0, warning: 1, unknown: 2, ok: 3 };
      return (rank[a.status || 'unknown'] || 2) - (rank[b.status || 'unknown'] || 2);
    });

    const stats = {
      total: list.length,
      ok: list.filter(i => i.status === 'ok').length,
      error: list.filter(i => i.status === 'error' || i.status === 'critical').length,
      warning: list.filter(i => i.status === 'warning' || i.status === 'warn').length
    };

    // Inject openLog into payload for card wrapper compatibility
    const listWithActions = sortedList.map(item => ({
      ...item,
      openLog: openLog
    }));

    return e('div', { className: 'space-y-6 animate-fade-in' },
      // Dashboard Header
      e('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2 border-b border-slate-200' },
        e('div', null,
          e('h3', { className: 'text-xl font-bold text-slate-900 flex items-center gap-2' },
            e('span', { className: 'text-blue-600' }, '🤖'), 'Monitor de Scripts & Automação'
          ),
          e('p', { className: 'text-sm text-slate-500 mt-1' }, 'Status em tempo real da execução de backups e scripts de manutenção.')
        ),
        e('div', { className: 'flex items-center gap-3' },
          // View Toggles
          e('div', { className: 'flex p-1 bg-slate-100 rounded-lg border border-slate-200' },
            e('button', {
              onClick: () => setViewMode('grid'),
              className: `px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
            }, e('span', null, '⊞'), 'Cards'),
            e('button', {
              onClick: () => setViewMode('table'),
              className: `px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
            }, e('span', null, '☰'), 'Lista')
          ),
          e('button', {
            onClick: reload,
            className: 'p-2 rounded-lg bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all border border-slate-200 shadow-sm'
          }, '↻')
        )
      ),

      // Stats Ribbon
      e('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
        e('div', { className: 'glass-card p-3 flex items-center justify-between border border-slate-100' },
          e('div', { className: 'text-xs text-slate-600 uppercase font-black tracking-widest' }, 'Total Scripts'),
          e('div', { className: 'text-xl font-bold text-slate-900' }, stats.total)
        ),
        e('div', { className: 'glass-card p-3 flex items-center justify-between border-emerald-100 bg-emerald-50/30' },
          e('div', { className: 'text-xs text-emerald-600 uppercase font-black tracking-widest' }, 'Sucesso'),
          e('div', { className: 'text-xl font-bold text-emerald-600' }, stats.ok)
        ),
        e('div', { className: 'glass-card p-3 flex items-center justify-between border-red-100 bg-red-50/30' },
          e('div', { className: 'text-xs text-red-600 uppercase font-black tracking-widest' }, 'Falhas'),
          e('div', { className: 'text-xl font-bold text-red-600' }, stats.error)
        ),
        e('div', { className: 'glass-card p-3 flex items-center justify-between border-amber-100 bg-amber-50/30' },
          e('div', { className: 'text-xs text-amber-600 uppercase font-black tracking-widest' }, 'Alertas'),
          e('div', { className: 'text-xl font-bold text-amber-600' }, stats.warning)
        )
      ),

      // Content View
      viewMode === 'grid' ?
        e('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' },
          listWithActions.map(item => e(ScriptStatusCard, { key: item.script, payload: item }))
        ) :
        e(ScriptStatusTable, { list: listWithActions, openLog })
    );
  }

  function UsersModal({ item, onClose }) {
    if (!item) return null;
    return e('div', { className: 'modal-backdrop', onClick: onClose }, e('div', { className: 'modal-window bg-white border border-slate-200 shadow-2xl', onClick: (ev) => ev.stopPropagation() },
      e('div', { className: 'mb-4 flex justify-between items-center border-b border-slate-100 pb-4' }, e('h3', { className: 'text-lg font-bold text-slate-900' }, `Usuários — ${item.share} `), e('button', { className: 'text-slate-600 hover:text-slate-600', onClick: onClose }, '✕')),
      e('div', null, e('ul', { className: 'space-y-2' },
        (item.acls || []).filter(a => a.type === 'user').map(u => e('li', { key: u.entity, className: 'p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium' }, `${u.entity} (${u.permissions})`))
      ))
    ));
  }

  function ACLModal({ item, onClose }) {
    const [users, setUsers] = React.useState([]);
    const [groups, setGroups] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('add'); // 'add' | 'transfer' | 'current'
    const [entityType, setEntityType] = React.useState('user');
    const [selectedEntity, setSelectedEntity] = React.useState('');
    const [entityFilter, setEntityFilter] = React.useState('');
    const [permission, setPermission] = React.useState('read');
    const [recursive, setRecursive] = React.useState(true);
    const [status, setStatus] = React.useState(null);
    const [applying, setApplying] = React.useState(false);
    const [currentACLs, setCurrentACLs] = React.useState({ users: [], groups: [] });
    const [loadingACLs, setLoadingACLs] = React.useState(false);
    // Transfer tab state
    const [fromUser, setFromUser] = React.useState('');
    const [toUser, setToUser] = React.useState('');
    const [fromFilter, setFromFilter] = React.useState('');
    const [toFilter, setToFilter] = React.useState('');
    const [transferring, setTransferring] = React.useState(false);

    const fetchACLs = React.useCallback(async () => {
      if (!item) return;
      setLoadingACLs(true);
      try {
        const r = await fetch('/api/samba/share-acls?path=' + encodeURIComponent(item.path));
        const j = await r.json();
        if (r.ok) {
          setCurrentACLs({ users: j.users || [], groups: j.groups || [] });
        }
      } catch (e) { console.error(e); }
      setLoadingACLs(false);
    }, [item]);

    React.useEffect(() => {
      Promise.all([
        fetch('/api/samba/users').then(r => r.json()),
        fetch('/api/samba/groups').then(r => r.json())
      ]).then(([u, g]) => {
        setUsers(Array.isArray(u) ? u : []);
        setGroups(Array.isArray(g) ? g : []);
        setLoading(false);
      }).catch(e => { console.error(e); setLoading(false); });
      fetchACLs();
    }, [item, fetchACLs]);

    const cleanName = (name) => (name || '').replace(/\\040/g, ' ');

    const onApply = async () => {
      if (!selectedEntity) return;
      setApplying(true); setStatus(null);
      try {
        const payload = { path: item.path, entity: (entityType === 'user' ? 'user:' : 'group:') + selectedEntity, permission, recursive };
        const r = await fetch('/api/samba/acl/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (r.ok && j.success) {
          setStatus({ type: 'success', msg: j.message || 'Permissões aplicadas com sucesso!' });
          fetchACLs(); setTimeout(() => setStatus(null), 4000);
        } else { setStatus({ type: 'error', msg: j.error || 'Erro ao aplicar permissões.' }); }
      } catch (e) { setStatus({ type: 'error', msg: String(e) }); }
      setApplying(false);
    };

    const onRemove = async (entityName, isGroup) => {
      if (!confirm(`Revogar acesso de "${cleanName(entityName)}" desta pasta?`)) return;
      setApplying(true);
      try {
        const payload = { path: item.path, entity: (isGroup ? 'group:' : 'user:') + entityName, recursive };
        const r = await fetch('/api/samba/acl/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (r.ok && j.success) {
          setStatus({ type: 'success', msg: 'Permissão removida com sucesso.' });
          fetchACLs(); setTimeout(() => setStatus(null), 4000);
        } else { setStatus({ type: 'error', msg: j.error || 'Erro ao remover.' }); }
      } catch (e) { setStatus({ type: 'error', msg: String(e) }); }
      setApplying(false);
    };

    const onTransfer = async () => {
      if (!fromUser || !toUser) { setStatus({ type: 'error', msg: 'Selecione o usuário de origem e destino.' }); return; }
      if (fromUser === toUser) { setStatus({ type: 'error', msg: 'Origem e destino devem ser diferentes.' }); return; }
      if (!confirm(`Transferir acessos de "${fromUser}" para "${toUser}" nesta pasta?`)) return;

      setTransferring(true); setStatus(null);
      // Find original permission for the from user
      const fromEntry = currentACLs.users.find(u => cleanName(u.name) === fromUser || u.name === fromUser);
      const permToGrant = fromEntry ? fromEntry.perms : 'rwx';
      const permMap = { 'rwx': 'full', 'rw-': 'write', 'r-x': 'read', 'r--': 'read' };
      const permLevel = permMap[permToGrant] || 'read';

      try {
        // 1. Grant new user same perms
        const applyR = await fetch('/api/samba/acl/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.path, entity: 'user:' + toUser, permission: permLevel, recursive: true }) });
        const applyJ = await applyR.json();
        if (!applyR.ok || !applyJ.success) { setStatus({ type: 'error', msg: 'Erro ao conceder acesso ao novo usuário: ' + (applyJ.error || '') }); setTransferring(false); return; }

        // 2. Revoke old user
        const revokeR = await fetch('/api/samba/acl/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.path, entity: 'user:' + fromUser, recursive: true }) });
        const revokeJ = await revokeR.json();
        if (!revokeR.ok || !revokeJ.success) { setStatus({ type: 'error', msg: 'Acesso concedido, mas falha ao revogar o anterior: ' + (revokeJ.error || '') }); }
        else { setStatus({ type: 'success', msg: `✅ Transferência concluída: "${fromUser}" → "${toUser}" com permissão [${permToGrant}].` }); }

        fetchACLs();
        setTimeout(() => setStatus(null), 6000);
      } catch (e) { setStatus({ type: 'error', msg: String(e) }); }
      setTransferring(false);
    };

    if (!item) return null;

    const allUsers = users;
    const filteredFrom = (allUsers || []).filter(x => cleanName(x).toLowerCase().includes(fromFilter.toLowerCase()));
    const filteredTo = (allUsers || []).filter(x => cleanName(x).toLowerCase().includes(toFilter.toLowerCase()));
    const filteredList = (entityType === 'user' ? users : groups).filter(x => cleanName(x).toLowerCase().includes(entityFilter.toLowerCase()));

    const permBadge = (perms) => {
      const p = (perms || '').replace(/\s.*/,'');
      if (p === 'rwx') return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Total' };
      if (p.includes('w') || p === 'rw-') return { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Escrita' };
      if (p.startsWith('r')) return { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Leitura' };
      return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Negado' };
    };

    const tabs = [
      { id: 'add', label: '➕ Adicionar', icon: '➕' },
      { id: 'transfer', label: '🔄 Transferir', icon: '🔄' },
      { id: 'current', label: `📋 Atuais (${currentACLs.users.length + currentACLs.groups.length})`, icon: '📋' },
    ];

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', { className: 'modal-window bg-white border border-slate-200 shadow-2xl', onClick: ev => ev.stopPropagation(), style: { maxWidth: '860px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: '16px' } },

        // Header
        e('div', { className: 'flex justify-between items-start px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0' },
          e('div', null,
            e('h3', { className: 'text-lg font-bold text-slate-900 flex items-center gap-2' }, '🛡️', 'Gerenciar Permissões'),
            e('div', { className: 'text-xs text-slate-500 mt-0.5 font-mono' }, `📂 ${item.share || 'Pasta'} · ${item.path || ''}`)
          ),
          e('button', { className: 'ml-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0', onClick: onClose }, '✕')
        ),

        // Tabs
        e('div', { className: 'flex border-b border-slate-100 px-4 flex-shrink-0 bg-slate-50' },
          tabs.map(t => e('button', {
            key: t.id,
            className: `px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'}`,
            onClick: () => setActiveTab(t.id)
          }, t.label))
        ),

        // Status Banner
        status && e('div', { className: `mx-5 mt-4 px-4 py-3 rounded-lg flex items-start gap-3 text-sm flex-shrink-0 border animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}` },
          e('span', { className: 'text-lg mt-0.5 flex-shrink-0' }, status.type === 'success' ? '✅' : '❌'),
          e('span', null, status.msg)
        ),

        // Content Area
        e('div', { className: 'flex-1 overflow-y-auto p-5 custom-scrollbar' },

          // TAB: ADD PERMISSION
          activeTab === 'add' && e('div', { className: 'space-y-5' },
            e('div', { className: 'grid grid-cols-2 gap-2' },
              ['user', 'group'].map(t => e('button', { key: t, className: `py-3 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${entityType === t ? (t === 'user' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-purple-500 bg-purple-50 text-purple-700') : 'border-slate-200 text-slate-500 hover:border-slate-300'}`, onClick: () => setEntityType(t) },
                t === 'user' ? '👤' : '👥', t === 'user' ? 'Usuário' : 'Grupo'))
            ),

            e('div', null,
              e('label', { className: 'block mb-1.5 text-xs font-bold uppercase text-slate-500' }, entityType === 'user' ? 'Selecionar Usuário' : 'Selecionar Grupo'),
              e('input', { type: 'text', placeholder: 'Buscar...', className: 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-2', value: entityFilter, onChange: ev => { setEntityFilter(ev.target.value); setSelectedEntity(ev.target.value); } }),
              e('div', { className: 'border border-slate-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto bg-white' },
                (loading ? [e('div', { key: 'load', className: 'p-4 text-center text-slate-400 text-sm' }, '⏳ Carregando...')] :
                  filteredList.slice(0, 40).map(x => e('button', { key: x, className: `w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 last:border-0 flex items-center gap-2 ${selectedEntity === cleanName(x) ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-700'}`, onClick: () => { setSelectedEntity(cleanName(x)); setEntityFilter(cleanName(x)); } },
                    e('span', null, entityType === 'user' ? '👤' : '👥'), cleanName(x)
                  ))
                )
              )
            ),

            e('div', null,
              e('label', { className: 'block mb-2 text-xs font-bold uppercase text-slate-500' }, 'Nível de Acesso'),
              e('div', { className: 'grid grid-cols-3 gap-2' },
                [
                  { id: 'read', icon: '👁️', label: 'Leitura', mono: 'r-x', color: 'blue' },
                  { id: 'write', icon: '✏️', label: 'Escrita', mono: 'rw-', color: 'amber' },
                  { id: 'full', icon: '🔓', label: 'Total', mono: 'rwx', color: 'emerald' },
                ].map(p => e('button', { key: p.id, className: `h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-sm ${permission === p.id ? `border-${p.color}-500 bg-${p.color}-50 text-${p.color}-700` : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`, onClick: () => setPermission(p.id) },
                  e('span', { className: 'text-xl' }, p.icon),
                  e('span', { className: 'font-bold text-xs' }, p.label),
                  e('span', { className: 'font-mono text-[10px] opacity-60' }, p.mono)
                ))
              )
            ),

            e('label', { className: 'flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer' },
              e('input', { type: 'checkbox', className: 'w-4 h-4 rounded text-blue-600', checked: recursive, onChange: ev => setRecursive(ev.target.checked) }),
              e('div', null,
                e('div', { className: 'text-sm font-semibold text-slate-700' }, 'Aplicar recursivamente'),
                e('div', { className: 'text-xs text-slate-500' }, 'Inclui todas as subpastas e arquivos')
              )
            ),

            e('button', { className: `w-full py-3 rounded-xl font-bold text-sm transition-all ${applying || !selectedEntity ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200'}`, onClick: onApply, disabled: applying || !selectedEntity },
              applying ? '⏳ Aplicando...' : '✓ Adicionar Permissão'
            )
          ),

          // TAB: TRANSFER
          activeTab === 'transfer' && e('div', { className: 'space-y-5' },
            e('div', { className: 'p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800' },
              '🔄 ', e('strong', null, 'Transferência de Acesso:'), ' Migra as permissões exatas de um colaborador para outro e revoga o acesso do anterior automaticamente.'
            ),

            e('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
              // FROM
              e('div', null,
                e('label', { className: 'block mb-1.5 text-xs font-bold uppercase text-red-500' }, '👤 De (Saindo)'),
                e('input', { type: 'text', placeholder: 'Filtrar usuário anterior...', className: 'w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-300 outline-none mb-2', value: fromFilter, onChange: ev => { setFromFilter(ev.target.value); setFromUser(ev.target.value); } }),
                e('div', { className: 'border border-red-200 rounded-xl max-h-48 overflow-y-auto bg-white' },
                  (currentACLs.users.length > 0 ?
                    currentACLs.users.filter(u => cleanName(u.name).toLowerCase().includes(fromFilter.toLowerCase())).map(u => {
                      const badge = permBadge(u.perms);
                      return e('button', { key: u.name, className: `w-full text-left px-3 py-2.5 text-sm hover:bg-red-50 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2 transition-colors ${fromUser === cleanName(u.name) ? 'bg-red-100 font-semibold' : ''}`, onClick: () => { setFromUser(cleanName(u.name)); setFromFilter(cleanName(u.name)); } },
                        e('span', { className: 'flex items-center gap-2' }, '👤', cleanName(u.name)),
                        e('span', { className: `text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.color}` }, u.perms.split(' ')[0])
                      );
                    })
                    : [...filteredFrom.slice(0, 20)].map(x => e('button', { key: x, className: `w-full text-left px-3 py-2 text-sm hover:bg-red-50 border-b border-slate-50 last:border-0 transition-colors ${fromUser === cleanName(x) ? 'bg-red-100 font-semibold' : ''}`, onClick: () => { setFromUser(cleanName(x)); setFromFilter(cleanName(x)); } }, '👤 ', cleanName(x)))
                  )
                )
              ),

              // TO
              e('div', null,
                e('label', { className: 'block mb-1.5 text-xs font-bold uppercase text-emerald-600' }, '👤 Para (Entrando)'),
                e('input', { type: 'text', placeholder: 'Filtrar novo usuário...', className: 'w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-300 outline-none mb-2', value: toFilter, onChange: ev => { setToFilter(ev.target.value); setToUser(ev.target.value); } }),
                e('div', { className: 'border border-emerald-200 rounded-xl max-h-48 overflow-y-auto bg-white' },
                  filteredTo.slice(0, 20).map(x => e('button', { key: x, className: `w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-50 last:border-0 transition-colors ${toUser === cleanName(x) ? 'bg-emerald-100 font-semibold' : ''}`, onClick: () => { setToUser(cleanName(x)); setToFilter(cleanName(x)); } }, '👤 ', cleanName(x)))
                )
              )
            ),

            fromUser && toUser && fromUser !== toUser && e('div', { className: 'p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-slate-700 flex items-start gap-3' },
              e('span', { className: 'text-xl' }, 'ℹ️'),
              e('div', null,
                e('strong', null, 'Resumo da operação:'),
                e('div', { className: 'mt-1' }, `"${fromUser}" perderá acesso a esta pasta.`),
                e('div', null, `"${toUser}" receberá as mesmas permissões.`)
              )
            ),

            e('button', { className: `w-full py-3 rounded-xl font-bold text-sm transition-all ${transferring || !fromUser || !toUser ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-200'}`, onClick: onTransfer, disabled: transferring || !fromUser || !toUser },
              transferring ? '⏳ Transferindo...' : '🔄 Executar Transferência de Acesso'
            )
          ),

          // TAB: CURRENT PERMISSIONS
          activeTab === 'current' && e('div', { className: 'space-y-4' },
            loadingACLs && e('div', { className: 'flex items-center gap-2 text-slate-500 text-sm' }, e('div', { className: 'spinner w-4 h-4 border-2' }), 'Atualizando permissões...'),

            currentACLs.groups.length === 0 && currentACLs.users.length === 0 && e('div', { className: 'flex flex-col items-center justify-center py-12 text-slate-400' },
              e('span', { className: 'text-5xl mb-3 opacity-30' }, '🔒'),
              e('span', { className: 'text-sm' }, 'Nenhuma permissão explícita')
            ),

            currentACLs.groups.length > 0 && e('div', null,
              e('h5', { className: 'text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1.5' }, '👥 Grupos', e('span', { className: 'text-slate-300' }, `(${currentACLs.groups.length})`)),
              e('div', { className: 'space-y-2' },
                currentACLs.groups.map(g => {
                  const badge = permBadge(g.perms);
                  return e('div', { key: g.name, className: 'flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 group hover:border-slate-300 transition-all' },
                    e('div', { className: 'flex items-start gap-3 min-w-0' },
                      e('div', { className: 'w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 flex-shrink-0 mt-0.5' }, '👥'),
                      e('div', { className: 'min-w-0' },
                        e('div', { className: 'font-medium text-slate-800 text-sm truncate' }, cleanName(g.name)),
                        e('span', { className: `text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.color}` }, `${g.perms.split(' ')[0]} · ${badge.label}`),
                        g.members && g.members.length > 0 && e('div', { className: 'mt-1.5 flex flex-wrap gap-1' },
                          g.members.map(m => e('span', { key: m, className: 'px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-100/30' }, cleanName(m)))
                        )
                      )
                    ),
                    e('button', { className: 'opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-red-400 transition-all flex-shrink-0 mt-0.5', onClick: () => onRemove(g.name, true), title: 'Revogar acesso' }, '🗑')
                  );
                })
              )
            ),

            currentACLs.users.length > 0 && e('div', null,
              e('h5', { className: 'text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1.5' }, '👤 Usuários', e('span', { className: 'text-slate-300' }, `(${currentACLs.users.length})`)),
              e('div', { className: 'space-y-2' },
                currentACLs.users.map(u => {
                  const badge = permBadge(u.perms);
                  return e('div', { key: u.name, className: 'flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 group hover:border-slate-300 transition-all' },
                    e('div', { className: 'flex items-center gap-3 min-w-0' },
                      e('div', { className: 'w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0' }, '👤'),
                      e('div', { className: 'min-w-0' },
                        e('div', { className: 'font-medium text-slate-800 text-sm truncate' }, cleanName(u.name)),
                        e('span', { className: `text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.color}` }, `${u.perms.split(' ')[0]} · ${badge.label}`)
                      )
                    ),
                    e('button', { className: 'opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-red-400 transition-all flex-shrink-0', onClick: () => onRemove(u.name, false), title: 'Revogar acesso' }, '🗑')
                  );
                })
              )
            )
          )
        )
      )
    );
  }

  function LogModal({ visible, onClose, initialPath, initialSearch, initialLines, summary }) {
    const [tree, setTree] = React.useState([]);
    const [flatList, setFlatList] = React.useState([]);
    const [selectedPath, setSelectedPath] = React.useState(null);
    const [content, setContent] = React.useState('');
    const [lines, setLines] = React.useState(initialLines || 1000);
    const [search, setSearch] = React.useState(initialSearch || '');
    const [treeSearch, setTreeSearch] = React.useState('');
    const [expanded, setExpanded] = React.useState({});
    const [loading, setLoading] = React.useState(false);
    const [autoFollow, setAutoFollow] = React.useState(false);
    const [wrap, setWrap] = React.useState(true);
    const contentRef = React.useRef(null);

    // Build tree from flat list of paths
    // Expected structure: ScriptName/Date/Filename.log or ScriptName/Filename.log
    // Helper to build tree from flat entries
    const buildTree = (entries) => {
      const root = {};
      entries.forEach(e => {
        const parts = e.dir ? e.dir.split('/') : [];
        let cur = root;
        parts.forEach(p => {
          if (!cur[p]) cur[p] = { __name: p, __path: null, children: {} };
          cur = cur[p].children;
        });
        cur[e.name] = { __name: e.name, __path: e.path, children: {}, ...e };
      });
      return root;
    };

    React.useEffect(() => {
      if (visible) {
        fetch('/api/list-logs')
          .then(r => r.json())
          .then(data => {
            if (data && data.entries) {
              setFlatList(data.entries);
              setTree(buildTree(data.entries));
              setSelectedPath(prev => prev || (initialPath || data.entries[0].path));
            }
          })
          .catch(console.error);
      }
    }, [visible, initialPath]);

    React.useEffect(() => {
      if (visible && initialPath) {
        setSelectedPath(initialPath);
      }
    }, [visible, initialPath]);

    React.useEffect(() => {
      if (!selectedPath) return;
      setLoading(true);
      fetch('/api/view-log?path=' + encodeURIComponent(selectedPath) + '&lines=' + lines)
        .then(r => r.json())
        .then(data => {
          if (data.error) setContent('Erro: ' + data.error);
          else setContent(data.content || '(Arquivo vazio)');
          setLoading(false);
        })
        .catch(e => {
          setContent('Erro de rede: ' + String(e));
          setLoading(false);
        });
    }, [selectedPath, lines]);

    React.useEffect(() => {
      if (autoFollow && contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }, [content, autoFollow]);


    // Helper to flatten tree for rendering (recursive)
    const treeToArray = (node, level = 0, path = '') => {
      let arr = [];
      Object.keys(node).sort().forEach(k => {
        const item = node[k];
        const key = path + '/' + k;
        // Filter by treeSearch
        if (treeSearch && !key.toLowerCase().includes(treeSearch.toLowerCase()) && !item.children) return;

        arr.push({ ...item, level, key, isDir: !item.__path });
        if (item.children && expanded[key]) {
          arr = arr.concat(treeToArray(item.children, level + 1, key));
        }
      });
      return arr;
    };

    const renderTree = (nodes) => {
      // Helper to count files recursively
      const countFiles = (nodeKey) => {
         // This is tricky with flat list. Better to pre-calculate or use state.
         // For now, let's trust Object.keys(node.children) which only counts immediate children.
         // If we want recursive count, we'd need traversing the original tree object, not this flattened array.
         // But the user requested (24) for folders.
         return 0; // Placeholder if we can't easily access the source tree node from here without lookup
      };
      
      return nodes.map(node => {
        const isSelected = node.__path === selectedPath;
        const isExpanded = expanded[node.key];

        // Find the node in the original tree to get children count (approximate for now)
        // Since 'node' here is from treeToArray, it might not have 'children' attached directly if it was flattened
        // But treeToArray implementation: `arr.push({ ...item, level, key, isDir: !item.__path });` copies properties.
        // So node.children exists if it's a directory.
        
        let fileCount = 0;
        if (node.children) {
             fileCount = Object.keys(node.children).length;
        }

        if (node.isDir) {
          return e(React.Fragment, { key: node.key },
            e('div', {
              className: 'log-tree-node dir hover:bg-slate-200/50 cursor-pointer p-1 rounded flex items-center gap-1 text-sm text-slate-700 select-none transition-colors border border-transparent hover:border-slate-300',
              onClick: () => setExpanded(prev => ({ ...prev, [node.key]: !prev[node.key] })),
              style: { paddingLeft: (node.level * 16 + 8) + 'px' }
            },
              e('span', { className: 'text-yellow-500 opacity-80' }, isExpanded ? '📂' : '📁'),
              e('span', { className: 'font-medium' }, node.__name),
              e('span', { className: 'text-slate-500 text-xs ml-auto mr-2 bg-slate-200 px-1.5 rounded-full' }, fileCount)
            ),
          );
        } else {
          return e('div', {
            key: node.key,
            className: `log-tree-node cursor-pointer p-1 rounded flex items-center gap-2 text-sm transition-colors border border-transparent ${isSelected ? 'bg-blue-600 text-white font-medium shadow-sm' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'}`,
            onClick: () => setSelectedPath(node.__path),
            style: { paddingLeft: (node.level * 16 + 24) + 'px' }
          },
            e('span', { className: isSelected ? 'text-white' : 'text-slate-500' }, '📄'),
            e('span', { className: 'truncate' }, node.__name)
          );
        }
      });
    };

    if (!visible) return null;

    const treeNodes = treeToArray(tree);

    // Summary Banner Logic
    let banner = null;
    if (summary && summary.log_path === selectedPath) {
      const color = summary.status === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        summary.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-red-50 border-red-200 text-red-800';

      banner = e('div', { className: `p-4 mb-0 border-b ${color} flex flex-col gap-2` },
        e('div', { className: 'flex items-center gap-3' },
          e('div', { className: 'text-2xl' }, summary.status === 'ok' ? '✓' : summary.status === 'warning' ? '!' : '✕'),
          e('div', null,
            e('div', { className: 'font-bold text-lg' }, 'Diagnóstico: ' + (summary.summary || 'Sem resumo')),
            summary.advice && e('div', { className: 'text-sm mt-1 font-mono bg-slate-200 p-2 rounded text-slate-700' }, `💡 Sugestão: ${summary.advice}`)
          )
        )
      );
    }

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', { className: 'modal-window bg-white border border-slate-200 shadow-2xl', onClick: (ev) => ev.stopPropagation(), style: { maxWidth: '95vw', width: '1200px', padding: 0, height: '85vh', display: 'flex', flexDirection: 'column' } },
        // Header
        e('div', { className: 'flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50' },
          e('div', { className: 'flex items-center gap-3' },
            e('div', { className: 'p-2 bg-blue-50 rounded-lg text-blue-600 shadow-sm' }, '📄'),
            e('div', null,
              e('h3', { className: 'text-lg font-bold text-slate-900 leading-tight' }, 'Visualizador de Logs'),
              e('div', { className: 'text-xs text-slate-500' }, selectedPath ? selectedPath : 'Selecione um arquivo')
            )
          ),
          e('button', { className: 'text-slate-600 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors', onClick: onClose }, '✕')
        ),

        e('div', { className: 'flex flex-1 overflow-hidden' },
          // Sidebar
          e('div', { className: 'w-1/4 min-w-[250px] border-r border-slate-100 bg-slate-50/50 flex flex-col' },
            e('div', { className: 'p-3 border-b border-slate-100' },
              e('input', {
                className: 'w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-400',
                placeholder: 'Filtrar arquivos...',
                value: treeSearch,
                onChange: (e) => setTreeSearch(e.target.value)
              })
            ),
            e('div', { className: 'flex-1 overflow-y-auto p-2 custom-scrollbar' },
              renderTree(treeNodes)
            )
          ),

          // Content
          e('div', { className: 'flex-1 flex flex-col bg-white' },
            banner,

            // Toolbar
            e('div', { className: 'p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50' },
              e('div', { className: 'flex items-center gap-2' },
                e('input', {
                  className: 'bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none w-64',
                  placeholder: 'Buscar no conteúdo...',
                  value: search,
                  onChange: (e) => setSearch(e.target.value)
                })
              ),
              e('div', { className: 'flex items-center gap-4' },
                e('label', { className: 'flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-slate-900 transition-colors' },
                  e('input', { type: 'checkbox', className: 'rounded border-slate-300 bg-white', checked: autoFollow, onChange: (e) => setAutoFollow(e.target.checked) }),
                  'Auto-scroll'
                ),
                e('label', { className: 'flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-slate-900 transition-colors' },
                  e('input', { type: 'checkbox', className: 'rounded border-slate-300 bg-white', checked: wrap, onChange: (e) => setWrap(e.target.checked) }),
                  'Quebrar Linhas'
                ),
                e('button', {
                  className: 'px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-600 rounded-lg transition-all shadow-sm flex items-center gap-2',
                  onClick: () => window.open('/api/download-log?path=' + encodeURIComponent(selectedPath), '_blank'),
                  disabled: !selectedPath
                }, '⬇ Download')
              )
            ),

            // Log Viewer
            e('div', { className: 'flex-1 relative overflow-hidden flex flex-col' },
              // Smart Toolbar
              e('div', { className: 'bg-slate-50 border-b border-slate-100 p-2 flex items-center gap-2 text-[10px]' },
                e('span', { className: 'text-slate-500 font-black uppercase tracking-widest' }, 'Destaques:'),
                e('button', {
                  className: 'px-2 py-1 rounded bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors font-bold',
                  onClick: () => {
                    // Find next error
                    const el = contentRef.current;
                    if (!el) return;
                    const errorLines = el.querySelectorAll('.log-line-error');
                    if (errorLines.length > 0) {
                      errorLines[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }, '🔴 Erros'),
                e('button', {
                  className: 'px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-colors font-bold',
                  onClick: () => {
                    // Find next warning
                    const el = contentRef.current;
                    if (!el) return;
                    const warnLines = el.querySelectorAll('.log-line-warning');
                    if (warnLines.length > 0) {
                      warnLines[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }, '🟡 Avisos')
              ),
              e('div', {
                ref: contentRef,
                className: `flex-1 overflow-auto font-mono text-xs leading-relaxed custom-scrollbar p-6 ${!wrap ? 'whitespace-pre' : 'whitespace-pre-wrap'} ${loading ? 'flex items-center justify-center text-slate-600' : 'text-slate-700'}`,
                style: { margin: 0, backgroundColor: '#ffffff' }
              },

                loading ? e('div', { className: 'flex flex-col items-center gap-3' }, e('div', { className: 'spinner' }), 'Carregando log...') :
                  (content ?
                    content.split('\n').map((line, idx) => {
                      let className = 'log-line hover:bg-white/5 px-1 rounded-sm';
                      const lower = line.toLowerCase();
                      if (lower.includes('error') || lower.includes('erro') || lower.includes('falha') || lower.includes('failed')) className += ' log-line-error text-red-600 bg-red-50 border-l-2 border-red-500 pl-2';
                      else if (lower.includes('warn') || lower.includes('aviso')) className += ' log-line-warning text-amber-600 bg-amber-50 border-l-2 border-amber-500 pl-2';
                      else if (lower.includes('success') || lower.includes('sucesso')) className += ' text-emerald-600';
                      else if (lower.includes('info')) className += ' text-blue-600';

                      // Highlight search term
                      if (search && lower.includes(search.toLowerCase())) {
                        className += ' bg-yellow-200 text-yellow-800';
                      }

                      return e('div', { key: idx, className: className }, line || ' ');
                    })
                    : e('div', { className: 'flex flex-col items-center justify-center h-full text-slate-500 gap-2' },
                      e('div', { className: 'text-4xl opacity-20' }, '📄'),
                      'Selecione um arquivo para visualizar'
                    ))
              )
            )
          )
        )
      )
    );
  }

  // --- Layout Components ---


  function RenameShareModal({ share, onClose, onSuccess }) {
    const [newName, setNewName] = React.useState(share.name);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (newName === share.name) {
        onClose();
        return;
      }
      if (!newName.match(/^[a-zA-Z0-9_\-]+$/)) {
        setError('Nome inválido. Use apenas letras, números, _ ou -.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/samba/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_name: share.name, new_name: newName })
        });
        const data = await res.json();
        if (res.ok) {
          onSuccess('Compartilhamento renomeado com sucesso!');
          onClose();
        } else {
          setError(data.error || 'Falha ao renomear.');
        }
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
    };

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', { className: 'modal-window max-w-md w-full', onClick: ev => ev.stopPropagation() },
        e('div', { className: 'flex justify-between items-center mb-6' },
          e('h3', { className: 'text-xl font-bold text-slate-800' }, 'Renomear Compartilhamento'),
          e('button', { className: 'text-slate-600 hover:text-white', onClick: onClose }, '✕')
        ),
        error && e('div', { className: 'mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm' }, error),
        e('form', { onSubmit: handleSubmit, className: 'space-y-4' },
          e('div', null,
            e('label', { className: 'block text-xs font-bold text-slate-600 uppercase mb-2' }, 'Novo Nome'),
            e('input', {
              type: 'text',
              value: newName,
              onChange: ev => setNewName(ev.target.value),
              className: 'w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:border-blue-500 outline-none transition-all',
              autoFocus: true,
              required: true
            })
          ),
          e('div', { className: 'flex gap-3 pt-4' },
            e('button', { type: 'button', onClick: onClose, className: 'flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200' }, 'Cancelar'),
            e('button', { type: 'submit', disabled: loading, className: 'flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold' },
              loading ? 'Salvando...' : 'Renomear'
            )
          )
        )
      )
    );
  }

  function CreateShareModal({ onClose, onSuccess }) {
    const [name, setName] = React.useState('');
    const [environment, setEnvironment] = React.useState('/dados');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const environments = ['/dados', '/dados-ext', '/dados-ext-II'];

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!name.match(/^[a-zA-Z0-9_\-]+$/)) {
        setError('Nome inválido. Use apenas letras, números, _ ou -.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/samba/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, environment })
        });
        const data = await res.json();
        if (res.ok) {
          onSuccess(data.message);
          onClose();
        } else {
          setError(data.error || 'Falha ao criar compartilhamento.');
        }
      } catch (err) {
        setError(String(err));
      }
      setLoading(false);
    };

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', { className: 'modal-window max-w-md w-full', onClick: ev => ev.stopPropagation() },
        e('div', { className: 'flex justify-between items-center mb-6 border-b border-white/10 pb-4' },
          e('h3', { className: 'text-xl font-bold text-white flex items-center gap-2' },
            e('span', { className: 'text-emerald-400' }, '📂'), 'Nova Pasta / Share'
          ),
          e('button', { className: 'btn-ghost p-2 rounded-full hover:bg-white/10 text-slate-600', onClick: onClose }, '✕')
        ),

        error && e('div', { className: 'mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm' },
          e('strong', { className: 'block mb-1' }, 'Erro:'), error
        ),

        e('form', { onSubmit: handleSubmit, className: 'flex flex-col gap-4' },
          e('div', null,
            e('label', { className: 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2' }, 'Nome da Pasta'),
            e('input', {
              type: 'text',
              value: name,
              onChange: ev => setName(ev.target.value),
              className: 'w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-slate-400',
              placeholder: 'Ex: projetos_2026',
              autoFocus: true,
              required: true
            }),
            e('p', { className: 'text-[10px] text-slate-500 mt-1 pl-1' }, 'Apenas letras, números, hiféns e underlines.')
          ),

          e('div', null,
            e('label', { className: 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2' }, 'Ambiente (Local)'),
            e('div', { className: 'grid grid-cols-1 gap-2' },
              environments.map(env =>
                e('label', {
                  key: env,
                  className: `flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${environment === env ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-200/30 border-slate-300 hover:border-slate-600'}`
                },
                  e('input', {
                    type: 'radio',
                    name: 'env',
                    value: env,
                    checked: environment === env,
                    onChange: () => setEnvironment(env),
                    className: 'text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-600'
                  }),
                  e('div', { className: 'flex flex-col' },
                    e('span', { className: `${environment === env ? 'text-white font-bold' : 'text-slate-700'}` }, env),
                    e('span', { className: 'text-[10px] text-slate-500' },
                      env === '/dados' ? 'Disco Principal (NVMe/RAID)' : 'Armazenamento Estendido'
                    )
                  )
                )
              )
            )
          ),

          e('div', { className: 'flex gap-3 mt-4 pt-4 border-t border-white/10' },
            e('button', { type: 'button', onClick: onClose, className: 'flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors font-medium text-sm' }, 'Cancelar'),
            e('button', {
              type: 'submit',
              disabled: loading || !name,
              className: 'flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
            },
              loading ? e('div', { className: 'spinner w-4 h-4 border-2' }) : e('span', null, '✨ Criar Pasta')
            )
          )
        )
      )
    );
  }

  function ShareGridItem({ share, onManage, onRename, onDelete }) {
    const isDanger = share.acls && share.acls.some(a => a.entity === 'everyone' || a.entity === 'other');
    const userCount = share.current_users || 0;

    return e('div', { className: 'glass-card p-0 flex flex-col group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:bg-slate-200/60' },
      // Gradient Top Border
      e('div', { className: 'h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-600' }),

      // Header
      e('div', { className: 'p-5 pb-3 flex justify-between items-start' },
        e('div', null,
          e('div', { className: 'flex items-center gap-2 mb-1' },
            e('span', { className: 'text-2xl opacity-80 group-hover:scale-110 transition-transform duration-300' }, '📁'),
            e('h3', { className: 'font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors' }, share.name)
          ),
          e('code', { className: 'text-[10px] text-slate-500 font-mono bg-black/20 px-1.5 py-0.5 rounded' }, share.path)
        ),
        e('div', { className: 'flex gap-2' },
          e('button', { onClick: onRename, className: 'text-slate-500 hover:text-white transition-colors p-1', title: 'Renomear' }, '✏️'),
          isDanger && e('div', { className: 'text-amber-400 text-xs animate-pulse', title: 'Permissões públicas detectadas' }, '⚠️')
        )
      ),

      // Stats / Info
      e('div', { className: 'px-5 py-2 flex-1' },
        e('div', { className: 'flex items-center gap-4 text-xs text-slate-600 font-medium' },
          e('div', { className: 'flex items-center gap-1.5' },
            e('span', { className: `w-2 h-2 rounded-full ${userCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}` }),
            `${userCount} conexões`
          ),
          e('div', { className: 'flex items-center gap-1.5' },
            e('span', { className: 'text-slate-500' }, '🔒'),
            `${(share.acls || []).length} regras`
          )
        )
      ),

      // Actions Footer
      e('div', { className: 'mt-auto border-t border-white/5 p-3 flex gap-2 bg-slate-900/30' },
        e('button', {
          onClick: onManage,
          className: 'flex-1 py-2 rounded-md bg-slate-200 hover:bg-slate-700 text-slate-700 text-xs font-bold border border-slate-300 transition-colors flex items-center justify-center gap-2'
        }, e('span', null, '🛡️'), 'Permissões'),

        e('button', {
          onClick: onDelete,
          className: 'w-10 flex items-center justify-center rounded-md bg-slate-200 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-300 hover:border-red-500/50 transition-colors',
          title: 'Excluir Pasta'
        }, '🗑️')
      )
    );
  }

  function ShareTableRow({ share, onManage, onRename, onDelete }) {
    const userCount = share.current_users || 0;
    return e('tr', { className: 'hover:bg-white/5 transition-colors group' },
      e('td', { className: 'p-4' },
        e('div', { className: 'flex items-center gap-3' },
          e('span', { className: 'text-xl opacity-60' }, '📁'),
          e('div', null,
            e('div', { className: 'font-bold text-slate-800 text-sm' }, share.name),
            e('div', { className: 'text-[10px] text-slate-500 md:hidden' }, share.path)
          )
        )
      ),
      e('td', { className: 'p-4 text-xs text-slate-600 font-mono hidden md:table-cell' }, share.path),
      e('td', { className: 'p-4' },
        e('div', { className: 'flex items-center gap-2 text-slate-700' },
          e('span', { className: `w-2 h-2 rounded-full ${userCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}` }),
          e('span', { className: 'text-xs' }, `${userCount} conexões`)
        )
      ),
      e('td', { className: 'p-4 text-right' },
        e('div', { className: 'flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300' },
          e('button', {
            onClick: onRename,
            className: 'px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-700 text-slate-700 text-xs font-bold border border-slate-300 transition-colors',
            title: 'Renomear'
          }, '✏️'),
          e('button', {
            onClick: onManage,
            className: 'px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-700 text-slate-700 text-xs font-bold border border-slate-300 transition-colors'
          }, 'Editar ACL'),
          e('button', {
            onClick: onDelete,
            className: 'px-2 py-1.5 rounded bg-slate-200 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-slate-300 transition-colors',
            title: 'Excluir'
          }, '🗑️')
        )
      )
    );
  }


  function SambaManager({ shares, onRefresh, onEditACL }) {
    const [filter, setFilter] = React.useState('');
    const [viewMode, setViewMode] = React.useState('grid'); // 'grid' | 'table'
    const [showACLModal, setShowACLModal] = React.useState(null); // item or null
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [renamingItem, setRenamingItem] = React.useState(null);
    const [deletingItem, setDeletingItem] = React.useState(null); // item to delete
    const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
    const [destroyFiles, setDestroyFiles] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const { data: shareData, loading, error } = shares; // Destructure shares object

    const filteredShares = React.useMemo(() => {
      if (!shareData || !Array.isArray(shareData)) return [];
      const lowerFilter = filter.toLowerCase();
      return shareData.filter(s =>
        s.name.toLowerCase().includes(lowerFilter) ||
        s.path.toLowerCase().includes(lowerFilter)
      );
    }, [shareData, filter]);

    const handleDelete = async () => {
      if (!deletingItem) return;
      if (deleteConfirmation !== deletingItem.name) return;

      setIsDeleting(true);
      try {
        const res = await fetch('/api/samba/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: deletingItem.name,
            path: deletingItem.path,
            destroy_files: destroyFiles
          })
        });
        const data = await res.json();
        if (res.ok) {
          onRefresh(); // Refresh list via parent prop
          setDeletingItem(null); // Close modal
          setDeleteConfirmation('');
          setDestroyFiles(false);
        } else {
          alert('Erro ao excluir: ' + (data.error || 'Erro desconhecido'));
        }
      } catch (e) {
        alert('Erro de conexão: ' + e);
      }
      setIsDeleting(false);
    };

    if (loading) return e('div', { className: 'glass-card p-12 flex items-center justify-center' }, e('div', { className: 'spinner mr-3' }), 'Carregando compartilhamentos...');
    if (error) return e('div', { className: 'glass-card p-8 text-red-400 border-red-500/30' }, 'Erro ao carregar Samba: ' + String(error));
    if (shares.data && shares.data.error) {
      return e('div', { className: 'glass-card p-8 text-red-500 border-red-500/30' },
        e('div', { className: 'font-bold mb-2' }, 'Erro no Backend Samba'),
        e('div', null, shares.data.error)
      );
    }

    return e('div', { className: 'space-y-6 fade-in' },
      // Header
      e('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center gap-4' },
        e('div', null,
          e('h2', { className: 'text-2xl font-bold text-slate-800 flex items-center gap-2' },
            e('span', { className: 'text-blue-400' }, '📂'), 'Compartilhamentos Samba'
          ),
          e('p', { className: 'text-slate-600 text-sm mt-1' }, `${filteredShares.length} pastas compartilhadas ativas`)
        ),
        e('div', { className: 'flex items-center gap-3 w-full md:w-auto' },
          e('div', { className: 'relative flex-1 md:w-64' },
            e('input', {
              type: 'text',
              placeholder: 'Pesquisar...',
              value: filter,
              onChange: (e) => setFilter(e.target.value),
              className: 'w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all'
            }),
            e('span', { className: 'absolute left-3 top-2.5 text-slate-500 text-xs' }, '🔍')
          ),
          e('div', { className: 'flex bg-slate-200/50 rounded-lg p-1 border border-slate-300' },
            e('button', {
              onClick: () => setViewMode('grid'),
              className: `p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-white'}`
            }, 'Grid'),
            e('button', {
              onClick: () => setViewMode('table'),
              className: `p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-white'}`
            }, 'Table')
          ),
          e('button', { className: 'p-2 rounded-lg bg-slate-200 text-slate-600 hover:text-white hover:bg-slate-700 transition-all border border-slate-300', onClick: onRefresh }, '↻'),
          e('button', {
            onClick: () => setShowCreateModal(true),
            className: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all border border-emerald-500/20'
          }, e('span', null, '+'), 'Nova Pasta')
        )
      ),

      // Content
      e('div', { className: viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'overflow-x-auto glass-card p-0' },
        viewMode === 'grid' ?
          filteredShares.map(s => e(ShareGridItem, {
            key: s.name,
            share: s,
            onManage: () => setShowACLModal(s),
            onRename: () => setRenamingItem(s),
            onDelete: () => setDeletingItem(s)
          }))
          : e('table', { className: 'w-full text-left border-collapse' },
            e('thead', { className: 'bg-slate-200/50 text-slate-600 text-xs uppercase font-bold tracking-wider' },
              e('tr', null,
                e('th', { className: 'p-4 border-b border-white/5' }, 'Nome'),
                e('th', { className: 'p-4 border-b border-white/5' }, 'Caminho'),
                e('th', { className: 'p-4 border-b border-white/5' }, 'Usuários'),
                e('th', { className: 'p-4 border-b border-white/5 text-right' }, 'Ações')
              )
            ),
            e('tbody', { className: 'divide-y divide-white/5' },
              filteredShares.map(s => e(ShareTableRow, {
                key: s.name,
                share: s,
                onManage: () => setShowACLModal(s),
                onRename: () => setRenamingItem(s),
                onDelete: () => setDeletingItem(s)
              }))
            )
          )
      ),

      // Modals
      showCreateModal && e(CreateShareModal, {
        onClose: () => setShowCreateModal(false),
        onSuccess: (msg) => { onRefresh(); alert(msg); }
      }),

      renamingItem && e(RenameShareModal, {
        share: renamingItem,
        onClose: () => setRenamingItem(null),
        onSuccess: (msg) => { onRefresh(); alert(msg); }
      }),
      // Delete Confirmation Modal
      deletingItem && e('div', { className: 'modal-backdrop', onClick: () => setDeletingItem(null) },
        e('div', { className: 'modal-window max-w-md w-full border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)]', onClick: ev => ev.stopPropagation() },
          e('div', { className: 'flex flex-col gap-4' },
            e('div', { className: 'w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-3xl mx-auto mb-2 border border-red-500/20' }, '🗑️'),
            e('h3', { className: 'text-xl font-bold text-white text-center' }, 'Excluir Compartilhamento?'),
            e('div', { className: 'text-center text-slate-600 text-sm space-y-2' },
              e('p', null, e('span', { className: 'text-red-400 font-mono bg-red-950/30 px-2 py-0.5 rounded' }, deletingItem.name)),
              e('p', null, 'Esta ação removerá o compartilhamento da rede.')
            ),

            e('div', { className: 'bg-red-950/20 border border-red-900/30 p-4 rounded-lg' },
              e('label', { className: 'flex items-start gap-3 cursor-pointer group' },
                e('input', {
                  type: 'checkbox',
                  checked: destroyFiles,
                  onChange: (e) => setDestroyFiles(e.target.checked),
                  className: 'mt-1 w-5 h-5 rounded border-red-800 bg-red-950 text-red-600 focus:ring-red-900'
                }),
                e('div', { className: 'flex-1' },
                  e('span', { className: 'block text-red-200 font-bold text-sm group-hover:text-red-100' }, 'Também excluir arquivos'),
                  e('span', { className: 'block text-red-400/70 text-xs' }, 'CUIDADO: Isso apagará permanentemente a pasta e todo o seu conteúdo do disco.')
                )
              )
            ),

            e('div', null,
              e('label', { className: 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2' }, 'Para confirmar, digite o nome da pasta:'),
              e('input', {
                type: 'text',
                value: deleteConfirmation,
                onChange: (e) => setDeleteConfirmation(e.target.value),
                placeholder: deletingItem.name,
                className: 'w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-white text-center font-mono placeholder-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none'
              })
            ),

            e('div', { className: 'flex gap-3 mt-2' },
              e('button', {
                onClick: () => setDeletingItem(null),
                className: 'flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200'
              }, 'Cancelar'),
              e('button', {
                onClick: handleDelete,
                disabled: deleteConfirmation !== deletingItem.name || isDeleting,
                className: 'flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              }, isDeleting ? 'Excluindo...' : 'Excluir Permanentemente')
            )
          )
        )
      )
    );
  }


  // --- Layout Components ---

  function Sidebar({ active, onChange, isOpen, onClose, persona }) {
    // Accessibility: keyboard navigation + focus management
    const sidebarRef = React.useRef(null);
    const firstFocusable = React.useRef(null);
    const lastFocusable = React.useRef(null);

    React.useEffect(() => {
      const el = sidebarRef.current;
      if (!el) return;

      const handleKey = (e) => {
        // Close on Escape
        if (e.key === 'Escape') {
          onClose && onClose();
        }
        // Trap focus when sidebar is open
        if (isOpen && e.key === 'Tab') {
          const focusable = el.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable.length) return;
          firstFocusable.current = focusable[0];
          lastFocusable.current = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable.current) {
              e.preventDefault();
              lastFocusable.current.focus();
            }
          } else {
            if (document.activeElement === lastFocusable.current) {
              e.preventDefault();
              firstFocusable.current.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKey);
      // Move initial focus to the first menu item when opened
      if (isOpen) {
        setTimeout(() => {
          const firstBtn = el.querySelector('button[role="menuitem"]');
          if (firstBtn) firstBtn.focus();
        }, 50);
      }
      return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);
    // Icons (Lucide style)
    const ICONS = {
      // Monitor (Infra)
      infra: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('rect', { x: 2, y: 3, width: 20, height: 14, rx: 2, ry: 2 }),
        e('line', { x1: 8, y1: 21, x2: 16, y2: 21 }),
        e('line', { x1: 12, y1: 17, x2: 12, y2: 21 })
      ),
      // Shield (Backup)
      jobs: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })
      ),
      // Database (Storage)
      storage: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }),
        e('path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }),
        e('path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' })
      ),
      // Folder (Shares)
      samba: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' })
      ),
      // CPU (Command Center)
      'mcp-live': e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, ry: 2 }),
        e('rect', { x: 9, y: 9, width: 6, height: 6 }),
        e('line', { x1: 9, y1: 1, x2: 9, y2: 4 }),
        e('line', { x1: 15, y1: 1, x2: 15, y2: 4 }),
        e('line', { x1: 9, y1: 20, x2: 9, y2: 23 }),
        e('line', { x1: 15, y1: 20, x2: 15, y2: 23 }),
        e('line', { x1: 20, y1: 9, x2: 23, y2: 9 }),
        e('line', { x1: 20, y1: 15, x2: 23, y2: 15 }),
        e('line', { x1: 1, y1: 9, x2: 4, y2: 9 }),
        e('line', { x1: 1, y1: 15, x2: 4, y2: 15 })
      ),
      // Activity (Observability)
      obs: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' })
      ),
      // File Text (Reports)
      reports: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        e('polyline', { points: '14 2 14 8 20 8' }),
        e('line', { x1: 16, y1: 13, x2: 8, y2: 13 }),
        e('line', { x1: 16, y1: 17, x2: 8, y2: 17 }),
        e('polyline', { points: '10 9 9 9 8 9' })
      ),
      // Book (Docs)
      docs: e('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        e('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
        e('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' })
      )
    };
    // Configuration of menus per Persona
    const PERSONA_MENUS = {
      'OPS': ['infra', 'jobs', 'storage', 'samba', 'mcp-live', 'obs', 'reports', 'docs'],
      'ANALYST': ['infra', 'storage', 'obs', 'reports', 'docs'],
      'MANAGER': ['infra', 'reports', 'docs'],
      'DEV': ['infra', 'mcp-live', 'obs', 'docs', 'jobs']
    };

    const allowedMenus = PERSONA_MENUS[persona] || PERSONA_MENUS['OPS'];

    const menus = [
      { id: 'infra', label: 'Infraestrutura', icon: 'infra' },
      { id: 'jobs', label: 'Backup & Scripts', icon: 'jobs' },
      { id: 'storage', label: 'Armazenamento', icon: 'storage' },
      { id: 'samba', label: 'Compartilhamentos', icon: 'samba' },
      { id: 'mcp-live', label: 'Command Center', icon: 'mcp-live' },
      { id: 'obs', label: 'Observabilidade', icon: 'obs' },
      { id: 'validation', label: 'Validação SRE', icon: 'obs' },
      { id: 'reports', label: 'Relatórios', icon: 'reports' },
      { id: 'docs', label: 'Documentação', icon: 'docs' },
    ].filter(m => allowedMenus.includes(m.id));

    // Mobile/Desktop overlay (always available when open)
    const overlay = isOpen ? e('div', {
      className: 'overlay fade-in', // subtle animation
      role: 'presentation',
      'aria-hidden': 'true',
      onClick: onClose
    }) : null;

    // Prefer reduced motion if user requested
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return e(React.Fragment, null,
      overlay,
      e('aside', {
        id: 'app-sidebar',
        role: 'navigation',
        'aria-label': 'Menu principal',
        'aria-hidden': isOpen ? 'false' : 'true',
        'className': `sidebar ${isOpen ? (prefersReducedMotion ? 'open' : 'open animate-slide-in') : ''}`,
        ref: sidebarRef,
        onMouseLeave: () => { if (isOpen) onClose(); }
      },
        // Header
        e('div', { className: 'sidebar-header' },
          e('div', { className: 'flex items-center gap-3' },
            // e('div', { className: 'w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl' }, 'A'),
            e('div', { className: 'text-2xl font-bold text-blue-800 tracking-widest', style: { fontFamily: '"Outfit", sans-serif', textShadow: '0 0 20px rgba(0,0,0,0.05)' } }, 'SRE CORE PLATFORM')
          ),
          e('button', {
            className: 'text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10',
            onClick: onClose,
            'aria-label': 'Fechar menu'
          }, '✕')
        ),

        // Nav
        e('div', { className: 'sidebar-content custom-scrollbar', role: 'menu' },
          e('div', { className: 'flex flex-col gap-1' },
            menus.map(m => {
              const isActive = active === m.id;
              return e('div', {
                key: m.id,
                className: `nav-item ${isActive ? 'active' : ''}`,
                onClick: () => { onChange(m.id); onClose(); },
                role: 'menuitem',
                tabIndex: 0,
                onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { onChange(m.id); onClose(); } }
              },
                e('div', { className: `w-5 h-5 flex items-center justify-center ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-700'}` },
                  ICONS[m.icon]
                ),
                e('span', null, m.label)
              );
            })
          )
        ),

        // Footer Profile
        e('div', { className: 'sidebar-footer' },
          e('div', { className: 'flex items-center gap-4' },
            e('div', { className: 'relative' },
              e('div', { className: 'w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg border border-white/10' }, 'A'),
              e('div', { className: 'absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full' })
            ),
            e('div', { className: 'flex flex-col' },
              e('span', { className: 'text-sm font-bold text-slate-800' }, 'Administrator'),
              e('span', { className: 'text-[10px] text-blue-400 font-medium tracking-wide uppercase' }, 'System Admin')
            )
          )
        )
      )
    );
  }

  function TopBar({ title, onToggleMenu, isOpen, persona, setPersona }) {
    const personas = [
      { id: 'OPS', label: 'Operations' },
      { id: 'ANALYST', label: 'Analyst' },
      { id: 'MANAGER', label: 'Management' },
      { id: 'DEV', label: 'Developer' }
    ];

    return e('header', { className: 'top-bar' },
      e('div', { className: 'flex items-center gap-4' },
        e('button', { className: `sidebar-toggle-btn ${isOpen ? 'open' : ''}`, onClick: onToggleMenu, 'aria-controls': 'app-sidebar', 'aria-expanded': isOpen ? 'true' : 'false', 'aria-label': isOpen ? 'Fechar menu' : 'Abrir menu' },
          e('span', null),
          e('span', null),
          e('span', null)
        ),
        e('h2', { className: 'text-xl font-bold text-slate-800 tracking-wide uppercase' }, title)
      ),

      e('div', { className: 'flex items-center gap-6' },
        // Persona Switcher
        e('div', { className: 'persona-switcher' },
          personas.map(p =>
            e('button', {
              key: p.id,
              className: `persona-btn ${persona === p.id ? 'active' : ''}`,
              onClick: () => setPersona(p.id)
            }, p.label)
          )
        ),

        // Status Indicators
        e('div', { className: 'flex items-center gap-3 pl-6 border-l border-white/10' },
          e('div', { className: 'status-orbit text-emerald-500', title: 'System Online' }),
          e('div', { className: 'w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-xs shadow-lg' }, 'AD')
        )
      )
    );
  }

  function RcloneStatusCard() {
    const rcloneStatus = useFetch('/api/rclone/status', [], { pollInterval: 30000 });
    const remotes = Array.isArray(rcloneStatus.data) ? rcloneStatus.data : [];

    if (rcloneStatus.loading && remotes.length === 0) return null;
    if (remotes.length === 0) return null;

    return e('div', { className: 'glass-card col-span-1 md:col-span-2 relative overflow-hidden flex flex-col gap-4' },
      e('div', { className: 'flex justify-between items-center border-b border-white/5 pb-2 ml-1 mr-1' },
        e('h3', { className: 'text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2' },
          e('span', { className: 'text-lg' }, '☁️'),
          'Status Cloud (Rclone)'
        ),
        e('div', { className: 'text-[10px] bg-slate-200 px-2 py-1 rounded text-slate-500 font-mono' }, `${remotes.length} Remote(s)`)
      ),

      e('div', { className: 'grid grid-cols-1 gap-3' },
        remotes.map(remote => {
          const isOk = remote.status === 'ok';
          const statusMsg = remote.message || (isOk ? 'Sincronização Ativa' : 'Erro de Conexão');

          return e('div', { key: remote.remote, className: `p-3 rounded-lg border flex items-center gap-4 transition-all hover:bg-slate-200/50 ${isOk ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-red-900/10 border-red-500/20'}` },
            e('div', { className: `w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-lg border ${isOk ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 animate-pulse border-red-500/30'}` },
              isOk ? '✓' : '⚠️'
            ),
            e('div', { className: 'flex-1 min-w-0' },
              e('div', { className: 'flex justify-between items-center' },
                e('h4', { className: 'font-bold text-slate-800 text-sm truncate' }, remote.remote),
                !isOk && e('button', {
                  className: 'text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded hover:bg-red-500/30 transition-colors',
                  onClick: () => prompt(`Execute no terminal: rclone config reconnect ${remote.remote}`)
                }, 'FIX')
              ),
              e('div', { className: `text-xs mt-0.5 truncate ${isOk ? 'text-emerald-400/70' : 'text-red-400/80'}` }, statusMsg)
            )
          );
        })
      )
    );
  }

  function ScheduleOverviewCard() {
    const schedules = useFetch('/api/schedules', []);

    if (!schedules.data || schedules.data.length === 0) return null;

    const formatSchedule = (raw) => {
      try {
        const parts = raw.split(/\s+/);
        if (parts.length < 3) return raw;

        const dateStr = parts[1];
        const timeStr = parts[2].substring(0, 5);

        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        let dayLabel = dateStr.split('-').reverse().join('/');
        if (dateStr === today) dayLabel = 'Hoje';
        else if (dateStr === tomorrow) dayLabel = 'Amanhã';

        let timeLeft = '';
        const match = raw.match(/(\d+(?:h|min|day|s)\s*)+left/);
        if (match) {
          timeLeft = match[0].replace('left', '').trim()
            .replace('day', 'd').replace('min', 'm');
        }

        return { time: `${dayLabel} às ${timeStr} `, timeLeft };
      } catch (e) {
        return { time: raw, timeLeft: '' };
      }
    };

    return e('div', { className: 'glass-card col-span-2' },
      e('h3', { className: 'text-lg font-bold text-white mb-4 flex items-center gap-2' },
        e('span', { className: 'text-xl' }, '📅'),
        'Próximos Agendamentos'
      ),
      e('div', { className: 'flex flex-col gap-3' },
        schedules.data.map((sch, i) => {
          const { time, timeLeft } = formatSchedule(sch.raw);

          return e('div', { key: i, className: 'flex flex-col p-3 bg-slate-200/50 rounded-lg border border-slate-300/50 hover:bg-slate-200 transition-colors' },
            e('div', { className: 'flex items-center justify-between' },
              e('div', { className: 'flex flex-col' },
                e('span', { className: 'font-semibold text-sm text-white' }, sch.name),
                e('div', { className: 'flex items-center gap-2 mt-1' },
                  e('span', { className: 'text-xs text-slate-600' }, 'Próximo:'),
                  e('span', { className: 'text-xs text-blue-300 font-mono' }, time)
                )
              ),
              timeLeft && e('div', { className: 'text-xs font-bold bg-slate-900 px-2 py-1 rounded text-emerald-400 border border-emerald-500/20' },
                '⏳ ' + timeLeft
              )
            ),
            e('details', { className: 'mt-2 text-xs text-slate-500 group' },
              e('summary', { className: 'cursor-pointer hover:text-slate-700 select-none flex items-center gap-1 list-none' }, '▶ Ver Detalhes'),
              e('div', { className: 'mt-2 p-2 bg-slate-100/50 rounded font-mono break-all border border-slate-200' },
                sch.command || 'Comando não disponível'
              )
            )
          );
        })
      )
    );
  }

  // Helper function for byte formatting (assuming it's not defined elsewhere)
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  function StorageBreakdownModal({ path, onClose }) {
    const res = useFetch('/api/storage/du?path=' + encodeURIComponent(path), []);

    return e('div', { className: 'modal-backdrop', onClick: onClose },
      e('div', { className: 'modal-window', onClick: e => e.stopPropagation(), style: { maxWidth: '700px' } },
        e('div', { className: 'flex justify-between items-center mb-6 border-b border-slate-300 pb-4' },
          e('div', null,
            e('h3', { className: 'text-xl font-bold text-slate-800' }, 'Análise de Armazenamento'),
            e('div', { className: 'text-sm text-slate-600 mt-1' }, `Caminho: ${path} `)
          ),
          e('button', { className: 'btn-ghost p-2 rounded-full hover:bg-slate-200', onClick: onClose }, '✕')
        ),
        e('div', { className: 'modal-body' },
          res.loading ? e('div', { className: 'flex items-center justify-center p-12' }, e('div', { className: 'spinner mr-3' }), 'Calculando uso do disco...') :
            res.error ? e('div', { className: 'p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg' }, 'Erro: ' + String(res.error)) :
              e('div', { className: 'flex flex-col gap-4' },
                e('div', { className: 'flex justify-between items-center bg-slate-200/50 p-4 rounded-lg border border-slate-300' },
                  e('span', { className: 'text-slate-600' }, 'Total nesta pasta'),
                  e('span', { className: 'text-xl font-bold text-slate-800' }, formatBytes((res.data.total_kb || 0) * 1024))
                ),
                e('div', { className: 'overflow-y-auto', style: { maxHeight: '500px' } },
                  e('table', { className: 'w-full text-left border-collapse' },
                    e('thead', null,
                      e('tr', { className: 'text-xs uppercase text-slate-500 border-b border-slate-300' },
                        e('th', { className: 'py-2' }, 'Nome'),
                        e('th', { className: 'py-2 text-right' }, 'Tamanho'),
                        e('th', { className: 'py-2 w-1/3' }, 'Uso Relativo')
                      )
                    ),
                    e('tbody', null,
                      (res.data.children || []).map(item => {
                        const sizeBytes = item.size_kb * 1024;
                        const percent = res.data.total_kb > 0 ? (item.size_kb / res.data.total_kb) * 100 : 0;
                        return e('tr', { key: item.name, className: 'border-b border-slate-200/50 hover:bg-slate-200/30 transition-colors' },
                          e('td', { className: 'py-3 pr-4' },
                            e('div', { className: 'flex items-center gap-2' },
                              e('span', { className: 'text-yellow-500' }, '📁'),
                              e('span', { className: 'font-medium text-slate-800 truncate', title: item.name }, item.name)
                            )
                          ),
                          e('td', { className: 'py-3 px-4 text-right font-mono text-slate-700' }, formatBytes(sizeBytes)),
                          e('td', { className: 'py-3 pl-4' },
                            e('div', { className: 'h-2 bg-slate-700 rounded-full overflow-hidden' },
                              e('div', { className: 'h-full bg-blue-500 rounded-full', style: { width: `${percent}% ` } })
                            ),
                            e('div', { className: 'text-xs text-slate-500 mt-1 text-right' }, `${percent.toFixed(1)}% `)
                          )
                        );
                      })
                    )
                  )
                )
              )
        ),
        e('div', { className: 'flex justify-end pt-6 border-t border-slate-300 mt-4' },
          e('button', { className: 'btn-ghost mr-2', onClick: onClose }, 'Fechar')
        )
      )
    );
  }

  function StorageCard() {
    const res = useFetch('/api/system/storage', [], { pollInterval: 60000 });
    const [breakdownPath, setBreakdownPath] = React.useState(null);

    // Initial Loading State
    if (res.loading && !res.data) return e('div', { className: 'glass-card p-8 flex flex-col items-center justify-center min-h-[200px]' },
      e('div', { className: 'w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4' }),
      e('span', { className: 'text-slate-600' }, 'Analisando armazenamento...')
    );

    if (res.error) return e('div', { className: 'glass-card p-8 flex flex-col items-center justify-center min-h-[200px] border-red-500/30' },
      e('span', { className: 'text-3xl mb-2' }, '⚠️'),
      e('span', { className: 'text-red-400 font-bold' }, 'Falha ao carregar storage'),
      e('span', { className: 'text-xs text-red-400/50 mt-2' }, String(res.error))
    );

    const data = Array.isArray(res.data) ? res.data : [];

    return e('div', { className: 'glass-card fade-in' },
      e('div', { className: 'flex justify-between items-center mb-6' },
        e('div', { className: 'flex items-center gap-3' },
          e('div', { className: 'p-2 bg-purple-500/10 rounded-lg text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' }, '📀'),
          e('h3', { className: 'text-lg font-bold text-slate-800 tracking-tight' }, 'Armazenamento Local')
        ),
        e('button', { className: 'btn-ghost p-2 hover:bg-white/5 rounded-full', onClick: () => res.reload && res.reload(), title: 'Atualizar agora' }, '↻')
      ),
      e('div', { className: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6' },
        data.map((d, i) => {
          const p = d.percent;
          let colorClass = 'bg-emerald-500 shadow-[0_0_10px_#10b981]';
          let textClass = 'text-emerald-400';
          let progressBg = 'bg-emerald-500';

          if (p > 70) { colorClass = 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'; textClass = 'text-amber-400'; progressBg = 'bg-amber-500'; }
          if (p > 90) { colorClass = 'bg-red-500 shadow-[0_0_10px_#ef4444]'; textClass = 'text-red-400'; progressBg = 'bg-red-500'; }

          return e('div', {
            key: d.mount,
            className: 'bg-slate-900/40 border border-white/5 rounded-xl p-4 hover:bg-slate-200/60 transition-all cursor-pointer group relative overflow-hidden',
            onClick: () => setBreakdownPath(d.mount),
            style: { animationDelay: i * 100 + 'ms' }
          },
            // Hover Glow
            e('div', { className: 'absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-500' }),

            e('div', { className: 'flex justify-between items-start mb-3 relative z-10' },
              e('div', null,
                e('div', { className: 'font-bold text-md text-slate-800 flex items-center gap-2' },
                  d.mount,
                  d.mount === '/' && e('span', { className: 'text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase' }, 'ROOT')
                ),
                e('div', { className: 'text-[10px] text-slate-500 mt-1 uppercase tracking-wider' }, `${formatBytes(d.used)} usado de ${formatBytes(d.total)}`)
              ),
              e('div', { className: `text-xl font-bold font-mono ${textClass}` }, p + '%')
            ),

            // Progress Bar
            e('div', { className: 'h-1.5 bg-slate-200 rounded-full overflow-hidden relative z-10' },
              e('div', { className: `h-full rounded-full transition-all duration-1000 ${progressBg}`, style: { width: p + '%' } })
            ),

            e('div', { className: 'mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity relative z-10' },
              e('span', { className: 'text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold uppercase tracking-wide' }, 'Analisar', e('span', null, '→'))
            )
          );
        })
      ),
      breakdownPath ? e(StorageBreakdownModal, { path: breakdownPath, onClose: () => setBreakdownPath(null) }) : null
    );
  }
  function ViewValidation() {
    const { data: v, loading, error } = useFetch('/api/validation_status', [], { pollInterval: 30000 });
    if (loading && !v) return e('div', { className: 'flex items-center justify-center p-20' }, e('div', { className: 'spinner' }), 'Sincronizando Telemetria...');
    if (error) return e('div', { className: 'p-8 text-red-500' }, 'Falha na Validação: ' + error);

    const cloud = v.cloud || {};
    const vm = v.vm || {};
    const paths = v.paths || [];

    return e('div', { className: 'view-container fade-in' },
      e('div', { className: 'flex justify-between items-center mb-8' },
        e('div', null,
          e('h2', { className: 'text-2xl font-bold text-slate-100' }, 'Protocolo de Validação AEGIS'),
          e('p', { className: 'text-slate-400 text-sm' }, 'Auditoria em tempo real da infraestrutura e links de nuvem.')
        ),
        e('div', { className: 'px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest pulse-success' }, 'Sistema Ativo')
      ),

      e('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
        // Cloud Card
        e('div', { className: 'glass-card-premium p-6' },
          e('div', { className: 'flex justify-between items-center mb-6' },
            e('h3', { className: 'text-blue-400 font-bold flex items-center gap-2' }, e('span', null, '☁️'), 'Cloud Storage (OneDrive)'),
            e('span', { className: `px-2 py-1 rounded text-[10px] font-bold ${cloud.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}` }, (cloud.status || 'OFFLINE').toUpperCase())
          ),
          cloud.status === 'online' ? e('div', { className: 'space-y-3' },
            [
              { label: 'Espaço Total', val: cloud.total_gb + ' GB' },
              { label: 'Espaço Usado', val: cloud.used_gb + ' GB' },
              { label: 'Espaço Livre', val: cloud.free_gb + ' GB' },
              { label: 'Lixeira', val: cloud.trash + ' GB' }
            ].map(m => e('div', { key: m.label, className: 'flex justify-between border-b border-white/5 pb-2' },
              e('span', { className: 'text-slate-400 text-sm' }, m.label),
              e('span', { className: 'font-mono text-sm text-slate-200' }, m.val)
            ))
          ) : e('div', { className: 'text-red-400 text-sm italic' }, cloud.details || 'Falha crítica na conexão com o provedor.')
        ),

        // VM Backup Card
        e('div', { className: 'glass-card-premium p-6' },
          e('div', { className: 'flex justify-between items-center mb-6' },
            e('h3', { className: 'text-purple-400 font-bold flex items-center gap-2' }, e('span', null, '🖥️'), 'VM Backup Engine'),
            e('span', { className: `px-2 py-1 rounded text-[10px] font-bold ${vm.status === 'configured' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}` }, (vm.status || 'IDLE').toUpperCase())
          ),
          e('div', { className: 'space-y-3' },
            [
              { label: 'Motor de Cópia', val: 'Kopia Enterprise' },
              { label: 'Status Local', val: vm.details || 'Aguardando Telemetria' },
              { label: 'Integridade', val: vm.status === 'configured' ? 'VERIFICADO' : 'PENDENTE' },
              { label: 'Cluster', val: 'VM-PROD-01' }
            ].map(m => e('div', { key: m.label, className: 'flex justify-between border-b border-white/5 pb-2' },
              e('span', { className: 'text-slate-400 text-sm' }, m.label),
              e('span', { className: 'font-mono text-sm text-slate-200' }, m.val)
            ))
          )
        ),

        // Security Card
        e('div', { className: 'glass-card-premium p-6' },
          e('div', { className: 'flex justify-between items-center mb-6' },
            e('h3', { className: 'text-emerald-400 font-bold flex items-center gap-2' }, e('span', null, '🛡️'), 'Aegis Security Engine'),
            e('span', { className: 'px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold' }, 'ACTIVE')
          ),
          e('div', { className: 'space-y-3' },
            [
              { label: 'Orchestrator', val: 'v2.1 (Senior)' },
              { label: 'Pre-Flight Check', val: 'ENABLED' },
              { label: 'Entropy Scanner', val: 'ONLINE' },
              { label: 'Threshold Guard', val: 'ONLINE (15%)' }
            ].map(m => e('div', { key: m.label, className: 'flex justify-between border-b border-white/5 pb-2' },
              e('span', { className: 'text-slate-400 text-sm' }, m.label),
              e('span', { className: 'font-mono text-sm text-slate-200' }, m.val)
            ))
          )
        ),

        // Path Card
        e('div', { className: 'glass-card-premium p-6' },
          e('h3', { className: 'text-slate-300 font-bold mb-6 flex items-center gap-2' }, e('span', null, '📂'), 'Critical Paths Audit'),
          e('div', { className: 'space-y-2' },
            paths.slice(0, 8).map(p => e('div', { key: p.path, className: 'flex justify-between items-center border-b border-white/5 pb-1' },
              e('span', { className: 'text-[11px] text-slate-400 truncate max-w-[200px]' }, p.path),
              e('span', { className: `text-[9px] font-bold ${p.exists ? 'text-emerald-400' : 'text-red-400'}` }, p.exists ? 'OK' : 'MISSING')
            ))
          )
        )
      )
    );
  }

  // --- Views ---

  function ViewInfrastructure({ kpis, metrics, processes, cpuRef, memRef, auto }) {
    const curCpu = kpis.data ? Number(kpis.data.cpu_percent || 0) : null;
    const curMem = kpis.data ? Number(kpis.data.mem_percent || 0) : null;

    // Helper for status colors
    const statusFor = (type, v) => {
      if (v >= 85) return { className: 'badge-danger', text: 'Crítico' };
      if (v >= 60) return { className: 'badge-warning', text: 'Atenção' };
      return { className: 'badge-success', text: 'Normal' };
    };

    // Extract history arrays
    const cpuHistory = React.useMemo(() => (metrics.data || []).map(m => m.cpu), [metrics.data]);
    const memHistory = React.useMemo(() => (metrics.data || []).map(m => m.mem), [metrics.data]);

    return e('div', { className: 'view-container fade-in' },
      e('h2', { className: 'view-title' }, 'Infraestrutura do Servidor'),

      // Top Metrics Grid
      e('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8' },
        // CPU Card
        e(MemoMetricCard, {
          label: 'Processamento (CPU)',
          value: kpis.data ? kpis.data.cpu_percent.toFixed(1) : '—',
          unit: '%',
          icon: '🧠',
          colorTheme: (kpis.data && kpis.data.cpu_percent > 80) ? 'red' : ((kpis.data && kpis.data.cpu_percent > 50) ? 'amber' : 'blue'),
          history: cpuHistory,
          status: { text: 'Total Utilizado', className: 'text-slate-600' },
          onClick: () => cpuRef.current && cpuRef.current.scrollIntoView({ behavior: 'smooth' })
        }),
        // Memory Card
        e(MemoMetricCard, {
          label: 'Memória RAM',
          value: kpis.data ? kpis.data.mem_percent.toFixed(1) : '—',
          unit: '%',
          icon: '💾',
          colorTheme: (kpis.data && kpis.data.mem_percent > 85) ? 'red' : ((kpis.data && kpis.data.mem_percent > 60) ? 'purple' : 'purple'),
          history: memHistory,
          status: { text: `${kpis.data ? formatBytes(kpis.data.mem_used) : '—'} / ${kpis.data ? formatBytes(kpis.data.mem_total) : '—'}`, className: 'text-info' },
          onClick: () => memRef.current && memRef.current.scrollIntoView({ behavior: 'smooth' })
        }),
        // Disk Card
        e(MemoMetricCard, {
          label: 'Disco Principal (/)',
          value: kpis.data ? kpis.data.disk_percent.toFixed(1) : '—',
          unit: '%',
          icon: '💿',
          colorTheme: (kpis.data && kpis.data.disk_percent > 90) ? 'red' : ((kpis.data && kpis.data.disk_percent > 70) ? 'amber' : 'emerald'),
          status: { text: `Livre: ${kpis.data ? formatBytes(kpis.data.disk_total - kpis.data.disk_used) : '—'}`, className: 'text-success' }
        }),
        // Uptime Card
        e(MemoMetricCard, {
          label: 'Tempo de Atividade',
          value: kpis.data ? Math.floor(kpis.data.uptime_seconds / 86400) : '—',
          unit: 'dias',
          icon: '⏱️',
          colorTheme: 'slate',
          status: { text: 'Desde o último boot', className: 'text-slate-600' },
          footer: kpis.data ? new Date(Date.now() - kpis.data.uptime_seconds * 1000).toLocaleString() : ''
        })
      ),

      // Charts Section
      e('div', { className: 'glass-card chart-card', style: { marginTop: '24px' } },
        e('div', { className: 'chart-header flex justify-between items-center mb-4' },
          e('h3', { className: 'text-lg font-bold text-slate-800 mb-0' }, 'Histórico de Performance'),
          e('div', { className: `px-2 py-1 rounded text-xs font-bold uppercase ${auto ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}` },
            auto ? '● Ao vivo' : '⏸ Pausado'
          )
        ),
        e('div', { style: { height: '300px', marginBottom: '20px' } }, e('canvas', { ref: cpuRef })),
        e('div', { style: { height: '200px' } }, e('canvas', { ref: memRef }))
      ),

      // Process Table
      e('div', { className: 'glass-card pt-6', style: { marginTop: '32px' } },
        e('div', { className: 'px-6 pb-2 mb-2 border-b border-slate-200 flex justify-between items-center' },
          e('h3', { className: 'text-lg font-bold text-slate-800' }, 'Processos Ativos'),
          e('span', { className: 'text-xs text-slate-500 font-mono' }, processes && processes.data ? (Array.isArray(processes.data) ? processes.data.length : (processes.data.by_cpu ? processes.data.by_cpu.length : '')) + ' processos' : '')
        ),
        e(MemoProcessTable, { rows: processes && processes.data ? processes.data : [], loading: processes ? processes.loading : false })
      )
    );
  }

  function ViewStorage({ shares, onShowUsers, onEditACL, isLoading, onRefresh }) {
    return e('div', { className: 'view-container fade-in' },
      e('div', { className: 'flex justify-between items-center mb-6' },
        e('h2', { className: 'view-title mb-0' }, 'Gerenciamento de Dados'),
        e('button', { className: 'btn-primary', onClick: onRefresh, disabled: isLoading }, isLoading ? 'Atualizando...' : 'Atualizar Dados')
      ),

      // Storage Cards Grid
      e('div', { style: { marginBottom: '32px' } },
        e(StorageCard, null)
      ),

      // Samba Shares
      e('div', { className: 'glass-card' },
        e('div', { className: 'p-6 border-b border-white/5' },
          e('h3', { className: 'text-lg font-bold text-slate-800' }, 'Compartilhamentos Samba')
        ),
        e(MemoSharesTable, { rows: shares.data, onShowUsers, onEditACL })
      )
    );
  }

  function BackupReliabilityWidget() {
    const { data: history, loading } = useFetch('/api/reports/history', []);

    const stats = React.useMemo(() => {
      if (!history) return { heatmap: [], reliability: 0, streak: 0 };

      const days = [];
      const today = new Date();
      const historyMap = new Map(history.map(h => [h.date, h]));
      let successes = 0;
      let total = 0;

      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = historyMap.get(dateStr);

        const status = entry ? entry.status : 'empty';
        days.push({ date: dateStr, status, entry });

        if (status !== 'empty') {
          total++;
          if (status === 'success' || status === 'ok') successes++;
        }
      }

      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const entry = historyMap.get(dateStr);
        if (!entry) continue; // skip empty days in streak calc? or break? Usually streak implies consecutive days
        if (entry.status === 'ok' || entry.status === 'success') streak++;
        else break;
      }

      return {
        heatmap: days,
        reliability: total > 0 ? Math.round((successes / total) * 100) : 100,
        streak
      };
    }, [history]);

    if (loading) return e('div', { className: 'h-32 flex items-center justify-center text-slate-500' }, e('div', { className: 'spinner' }));

    return e('div', { className: 'glass-card p-6 mb-8 relative overflow-hidden' },
      e('div', { className: 'absolute top-0 right-0 p-4 opacity-10 pointer-events-none' },
        e('div', { className: 'text-9xl transform rotate-12 translate-x-4 -translate-y-4 hue-rotate-30' }, '📈')
      ),
      e('div', { className: 'flex justify-between items-end mb-6 relative z-10' },
        e('div', null,
          e('h3', { className: 'text-xl font-bold text-slate-800 mb-1' }, 'Confiabilidade dos Backups'),
          e('div', { className: 'text-sm text-slate-600' }, 'Histórico dos últimos 30 dias')
        ),
        e('div', { className: 'text-right' },
          e('div', { className: 'text-3xl font-bold text-emerald-600' }, stats.reliability + '%'),
          e('div', { className: 'text-xs text-emerald-600/70 uppercase font-bold tracking-wider' }, 'Taxa de Sucesso')
        )
      ),

      // Heatmap
      e('div', { className: 'flex gap-1 justify-between items-end h-16 relative z-10' },
        stats.heatmap.map((day, i) => {
          let color = 'bg-slate-200';
          let height = 'h-8';
          let opacity = 'opacity-30';

          if (day.status === 'ok' || day.status === 'success') {
            color = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
            height = 'h-12';
            opacity = 'opacity-100';
          } else if (day.status === 'warning') {
            color = 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]';
            height = 'h-10';
            opacity = 'opacity-100';
          } else if (day.status === 'error') {
            color = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
            height = 'h-14';
            opacity = 'opacity-100';
          }

          return e('div', {
            key: i,
            className: `flex-1 rounded-sm transition-all duration-300 hover:scale-125 hover:z-20 ${color} ${height} ${opacity}`,
            title: `${day.date}: ${day.status.toUpperCase()}`
          });
        })
      ),
      e('div', { className: 'flex justify-between mt-2 text-[10px] text-slate-500 font-mono uppercase' },
        e('span', null, '30 dias atrás'),
        e('span', null, 'Hoje')
      )
    );
  }

  function KpiCard({ title, value, icon, color, sub }) {
    let colorClass = 'text-slate-600 bg-slate-500/10 border-slate-500/20';
    let iconColor = 'text-slate-600';
    let glow = '';

    if (color === 'blue' || color.includes('blue')) {
      colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      iconColor = 'text-blue-400';
      glow = 'shadow-[0_0_15px_rgba(59,130,246,0.15)]';
    } else if (color === 'green' || color.includes('emerald') || color.includes('10b981')) {
      colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      iconColor = 'text-emerald-400';
      glow = 'shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    } else if (color === 'purple' || color.includes('purple')) {
      colorClass = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      iconColor = 'text-purple-400';
      glow = 'shadow-[0_0_15px_rgba(168,85,247,0.15)]';
    } else if (color === 'red' || color.includes('red')) {
      colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
      iconColor = 'text-red-400';
      glow = 'shadow-[0_0_15px_rgba(239,68,68,0.15)]';
    }

    const isLoading = value === null || value === undefined || value === '—' || value === '-';

    return e('div', { className: `glass-card p-5 ${isLoading ? 'skeleton' : ''} hover:border-opacity-50 transition-all duration-300 ${isLoading ? '' : 'hover:-translate-y-1'} group relative overflow-hidden` },
      // Background Glow
      e('div', { className: `absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40 ${colorClass.split(' ')[1].replace('/10', '/30')}` }),

      e('div', { className: 'flex items-center gap-4 relative z-10' },
        e('div', { className: `w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border backdrop-blur-md ${colorClass} ${glow}` }, icon),
        e('div', { className: 'flex flex-col' },
          e('div', { className: 'text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-0.5' }, title),
          isLoading ? e('div', { className: 'skeleton', style: { height: '34px', width: '40%' } }) : e('div', { className: 'text-3xl font-bold tracking-tight text-slate-800 drop-shadow-sm' }, value),
          sub && e('div', { className: 'text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1' },
            e('span', { className: `w-1.5 h-1.5 rounded-full ${iconColor.replace('text-', 'bg-')}` }), sub
          )
        )
      )
    );
  }

  function ViewExecution({ auto }) {
    const { data: activeJobs, error, loading } = useFetch('/api/jobs/active', [], { pollInterval: 2000 });

    // Static Schedule Definition
    const schedule = [
      { name: 'Backup HD', time: '18:00', cron: '0 18 * * *', script: 'backup_hd.sh', avg: 14400 }, // 4h
      { name: 'Backup Cloud', time: '18:30', cron: '30 18 * * *', script: 'backup_cloud_data.sh', avg: 7200 }, // 2h
      { name: 'Limpeza Logs', time: '05:00', cron: '0 5 * * *', script: 'maintenance.sh', avg: 300 }, // 5m
      { name: 'Backup Semanal', time: 'Dom 19:00', cron: '0 19 * * 0', script: 'backup_cloud_ext.sh', avg: 10800 } // 3h
    ];

    const jobs = Array.isArray(activeJobs) ? activeJobs : [];

    return e('div', { className: 'view-container animate-fade-in text-slate-800' },
      e('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 pb-2 border-b border-white/5' },
        e('div', null,
          e('h2', { className: 'text-2xl font-bold text-slate-800 flex items-center gap-2' },
            e('span', { className: 'text-blue-500' }, '🚀'), 'Monitoramento de Execução'
          ),
          e('p', { className: 'text-sm text-slate-600 mt-1' }, 'Acompanhe o progresso dos scripts e agendamentos em tempo real.')
        ),
        e('div', { className: 'flex items-center gap-3 bg-white/80 p-2 rounded-lg border border-white/5' },
          loading && e('span', { className: 'text-xs text-blue-400 animate-pulse font-mono mr-2' }, 'Sincronizando...'),
          e('div', { className: 'flex items-center gap-2 text-xs font-bold uppercase text-slate-500' },
            'Status:',
            e('div', { className: `w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] ${jobs.length > 0 ? 'bg-emerald-500 text-emerald-500 animate-pulse' : 'bg-slate-600 text-slate-600'}` }),
            jobs.length > 0 ? 'Ativo' : 'Ocioso'
          )
        )
      ),

      // Active Jobs Section
      e('div', { className: 'mb-12' },
        e('h3', { className: 'text-lg font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-200 pb-2' },
          'Em Execução Agora',
          e('span', { className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full' }, jobs.length)
        ),
        jobs.length === 0 ?
          e('div', { className: 'glass-card p-12 text-center flex flex-col items-center justify-center min-h-[250px]' },
            e('div', { className: 'text-6xl mb-6 opacity-20 grayscale' }, '☕'),
            e('div', { className: 'text-slate-700 text-lg font-medium' }, 'Nenhum script rodando no momento.'),
            e('div', { className: 'text-slate-500 text-sm mt-2 max-w-sm' }, 'O sistema está ocioso. Verifique os agendamentos abaixo para as próximas execuções.')
          )
          :
          e('div', { className: 'grid grid-cols-1 gap-6' },
            jobs.map(job => {
              // Calculate progress
              const avg = schedule.find(s => job.script.includes(s.script))?.avg || 3600;
              const progress = Math.min((job.duration_seconds / avg) * 100, 99);

              return e('div', { key: job.pid, className: 'glass-card p-6 relative group overflow-hidden border-l-4 border-l-blue-500' },
                // Glowing Background
                e('div', { className: 'absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-blue-500/10 to-transparent rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none' }),

                e('div', { className: 'relative z-10' },
                  e('div', { className: 'flex justify-between items-start mb-4' },
                    e('div', null,
                      e('div', { className: 'flex items-center gap-2 mb-1' },
                        e('span', { className: 'text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20' }, `PID ${job.pid}`),
                        e('span', { className: 'text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse' }, 'RUNNING')
                      ),
                      e('h3', { className: 'font-bold text-lg text-slate-800 truncate w-full' }, job.name || 'Processo Desconhecido')
                    ),
                    e('div', { className: 'bg-slate-100/50 p-2 rounded-lg border border-white/5 text-right' },
                      e('div', { className: 'text-[10px] text-slate-500 uppercase font-bold' }, 'Tempo Decorrido'),
                      e('div', { className: 'text-xl font-mono font-bold text-blue-600' }, job.duration || '0s')
                    )
                  ),

                  // Progress Bar
                  e('div', { className: 'w-full bg-slate-900 rounded-full h-2 mb-4 overflow-hidden border border-white/5' },
                    e('div', {
                      className: 'h-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-[0_0_12px_rgba(59,130,246,0.5)] relative',
                      style: { width: `${progress}%`, animation: 'shimmer 2s linear infinite' }
                    }, e('div', { className: 'absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_1s_infinite]' }))
                  ),

                  // Terminal Output Simulation
                  e('div', { className: 'bg-[#0f172a] rounded-lg border border-slate-200 p-3 font-mono text-xs shadow-inner h-24 overflow-hidden relative' },
                    e('div', { className: 'absolute top-2 right-2 flex gap-1' },
                      e('div', { className: 'w-2 h-2 rounded-full bg-red-500/20' }),
                      e('div', { className: 'w-2 h-2 rounded-full bg-amber-500/20' }),
                      e('div', { className: 'w-2 h-2 rounded-full bg-emerald-500/20' })
                    ),
                    e('div', { className: 'text-slate-500 mb-1' }, '$ tail -f execution.log'),
                    e('div', { className: 'text-emerald-400/80' }, '> Script running...'),
                    e('div', { className: 'text-white animate-pulse' }, `> Executing ${job.name}...`)
                  )
                )
              );
            })
          ),
      ),

      // Upcoming Schedule
      e('div', { className: 'mt-8' },
        e('h3', { className: 'text-lg font-bold text-slate-800 mb-4 flex items-center gap-2' },
          e('span', { className: 'text-xl' }, '📅'), 'Próximos Agendamentos'
        ),
        e('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
          schedule.map((sch, i) =>
            e('div', { key: i, className: 'glass-card p-4 hover:-translate-y-1 transition-transform cursor-default group' },
              e('div', { className: 'flex justify-between items-start mb-2' },
                e('div', { className: 'bg-white/5 p-2 rounded-lg text-xl' }, '⏰'),
                e('span', { className: 'text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-200' }, sch.cron)
              ),
              e('div', { className: 'font-bold text-slate-800 text-sm mb-1 truncate' }, sch.name),
              e('div', { className: 'text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20' },
                sch.time
              )
            )
          )
        )
      )
    );
  }


  function ViewMCPLive() {
    const [baseUrl, setBaseUrl] = React.useState(() => 'http://' + window.location.hostname + ':8000');
    const [health, setHealth] = React.useState(null);
    const [tools, setTools] = React.useState([]);
    const [lastRun, setLastRun] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [log, setLog] = React.useState([]);
    const [history, setHistory] = React.useState([]);
    const [toast, setToast] = React.useState(null);
    const [autoRefresh, setAutoRefresh] = React.useState(true);
    const toastTimer = React.useRef(null);

    const pushLog = (line) => setLog((prev) => [...prev, line].slice(-80));
    const pushToast = (msg, kind = 'info') => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ msg, kind });
      toastTimer.current = setTimeout(() => setToast(null), 3500);
    };

    const fetchStatus = React.useCallback(async () => {
      setLoading(true);
      try {
        const h = await fetch(baseUrl + '/').then(r => r.json());
        setHealth(h);
        pushLog('✅ Connected to ' + (h.server || 'MCP Server'));
      } catch (e) {
        pushLog('❌ Connection failed');
        setHealth(null);
      }
      try {
        const t = await fetch(baseUrl + '/mcp/list_tools', { method: 'POST' }).then(r => r.json());
        const list = t.tools || [];
        setTools(list);
        pushLog(`✅ Loaded ${list.length} tools`);
      } catch (e) {
        pushLog('❌ Failed to list tools');
      }
      if (!lastRun) {
        // Auto-run uptime for demo effect on first load
        try {
          const r = await fetch(baseUrl + '/mcp/call_tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'service_status', arguments: { name: 'cron' } })
          }).then(r => r.json());
          const content = r.content ? r.content[0].text : JSON.stringify(r.result || r, null, 2);
          setLastRun({ name: 'service_status', content, meta: { duration_ms: 45 } });
        } catch (e) { }
      }
      setLoading(false);
    }, [baseUrl, lastRun]);

    React.useEffect(() => { fetchStatus(); }, []);

    React.useEffect(() => {
      if (!autoRefresh) return;
      const id = setInterval(fetchStatus, 30000);
      return () => clearInterval(id);
    }, [autoRefresh, fetchStatus]);

    const runTool = async (name, args) => {
      setLoading(true);
      pushLog('> Executing ' + name + '...');
      const start = Date.now();
      try {
        const payload = JSON.stringify({ name, arguments: args || {} });

        const callEndpoint = async (url) => {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload
            });
            return { ok: resp.ok, status: resp.status, json: await resp.json() };
          } catch (err) {
            return { ok: false, status: 'NETWORK_ERROR', json: { error: String(err) } };
          }
        };

        const attemptCall = async (base) => {
          // Primary endpoint
          let res = await callEndpoint(base + '/mcp/call_tool');
          // Fallback to legacy alias if 404 (seen when another server is fronting port 8000)
          if (!res.ok && res.status === 404) {
            pushLog(`⚠️ ${base}/mcp/call_tool -> 404, trying /tools/execute`);
            res = await callEndpoint(base + '/tools/execute');
          }
          return { base, res };
        };

        const results = [];
        results.push(await attemptCall(baseUrl));

        // If 404, also try same host with https and without port (in case behind reverse proxy)
        if (!results[0].res.ok && results[0].res.status === 404) {
          const urlObj = new URL(baseUrl);
          const basesToTry = new Set();
          basesToTry.add(`http://${urlObj.hostname}:8000`);
          basesToTry.add(`https://${urlObj.hostname}:8000`);
          basesToTry.add(`http://${urlObj.hostname}`);
          basesToTry.add(`https://${urlObj.hostname}`);
          basesToTry.add('http://localhost:8000');

          for (const b of basesToTry) {
            if (results.some(r => r.base === b)) continue;
            pushLog(`⚠️ Retrying using fallback base ${b}`);
            results.push(await attemptCall(b));
            if (results[results.length - 1].res.ok) {
              setBaseUrl(b);
              break;
            }
          }
        }

        const success = results.find(r => r.res.ok);
        const finalRes = success ? success.res : results[results.length - 1].res;

        if (!finalRes.ok) {
          const tried = results.map(r => `${r.base} -> ${r.res.status}`).join(' | ');
          throw new Error(`HTTP ${finalRes.status} on ${success ? success.base : baseUrl}: ${JSON.stringify(finalRes.json)} | tried: ${tried}`);
        }

        const duration = Date.now() - start;
        const content = finalRes.json.content ? finalRes.json.content[0].text : JSON.stringify(finalRes.json.result || finalRes.json, null, 2);

        setLastRun({ name, content, meta: { duration_ms: duration } });
        pushLog('✅ ' + name + ' finished in ' + duration + 'ms');
        setHistory((prev) => [{ name, ts: Date.now(), status: 'ok', duration }, ...prev].slice(0, 10));
        pushToast(`${name} executed successfully`, 'success');
      } catch (e) {
        pushLog('❌ ' + name + ' failed: ' + e);
        setHistory((prev) => [{ name, ts: Date.now(), status: 'error' }, ...prev].slice(0, 10));
        pushToast(`Error executing ${name}`, 'error');
      }
      setLoading(false);
    };

    const quicks = [
      { label: 'System Uptime', tool: 'uptime_info', args: {}, icon: '⏱️', color: 'blue' },
      { label: 'Disk Usage', tool: 'disk_mounts', args: {}, icon: '💾', color: 'purple' },
      { label: 'Active Processes', tool: 'top_processes', args: { limit: 5 }, icon: '⚡', color: 'amber' },
      { label: 'Network Ifaces', tool: 'network_interfaces', args: {}, icon: '🌐', color: 'emerald' },
      { label: 'Ping Gateway', tool: 'ping_host', args: { host: '1.1.1.1', count: 3 }, icon: '📡', color: 'cyan' },
      { label: 'Check SSH', tool: 'service_status', args: { name: 'ssh' }, icon: '🔒', color: 'rose' },
      { label: 'DNS Lookup', tool: 'resolve_host', args: { host: 'google.com' }, icon: '🔍', color: 'indigo' },
      { label: 'List Users', tool: 'run_command', args: { command: 'who' }, icon: '👥', color: 'teal' } // careful with run_command
    ];

    // Theme Helpers
    const glassCard = "backdrop-blur-xl bg-slate-900/60 border border-slate-300/50 shadow-xl rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-600/50 hover:shadow-2xl hover:bg-slate-900/70";
    const gradientText = "bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-extrabold";

    return e('div', { className: 'view-container fade-in space-y-8 pb-10' },

      // HERO SECTION
      e('div', { className: 'relative rounded-3xl overflow-hidden border border-slate-300/50 shadow-2xl group' },
        e('div', { className: 'absolute inset-0 bg-slate-100' }),
        e('div', { className: 'absolute inset-0 bg-grid-slate-800/[0.2] bg-[bottom_1px_center]' }), // Grid pattern simulation
        e('div', { className: 'absolute -top-[150%] -left-[50%] w-[200%] h-[200%] bg-blue-900/20 blur-[120px] rounded-full animate-pulse-slow' }),

        e('div', { className: 'relative z-10 p-8 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8' },
          e('div', { className: 'space-y-4 w-full' },
            e('div', { className: 'flex items-center gap-3' },
              e('span', { className: 'px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono tracking-widest uppercase' }, 'MCP Protocol v1.0'),
              health && e('span', { className: 'flex h-2 w-2 relative' },
                e('span', { className: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' }),
                e('span', { className: 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500' })
              )
            ),
            e('h1', { className: 'text-4xl md:text-5xl font-black text-slate-900 tracking-tight' },
              'Inteligência ',
              e('span', { className: gradientText }, 'Sem Limites')
            ),
            e('p', { className: 'text-slate-600 text-lg leading-relaxed' },
              'Monitoramento em tempo real e execução remota de ferramentas via Model Context Protocol. O futuro da automação está aqui.'
            ),
            e('div', { className: 'flex flex-wrap gap-4 pt-4' },
              e('div', { className: 'flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 border border-slate-300/50' },
                e('span', { className: 'text-2xl' }, '🛠️'),
                e('div', { className: 'flex flex-col' },
                  e('span', { className: 'text-xs text-slate-500 uppercase' }, 'Ferramentas'),
                  e('span', { className: 'font-bold text-blue-600' }, tools.length || '...')
                )
              ),
              e('div', { className: 'flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 border border-slate-300/50' },
                e('span', { className: 'text-2xl' }, '⚡'),
                e('div', { className: 'flex flex-col' },
                  e('span', { className: 'text-xs text-slate-500 uppercase' }, 'Latência'),
                  e('span', { className: 'font-bold text-emerald-400' }, lastRun?.meta?.duration_ms ? lastRun.meta.duration_ms + 'ms' : '0ms')
                )
              )
            )
          ),

          e('div', { className: 'flex flex-col gap-4 min-w-[220px]' },
            e('button', {
              className: 'relative group px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-3 overflow-hidden',
              onClick: fetchStatus,
              disabled: loading
            },
              e('div', { className: 'absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700' }),
              loading ? e('div', { className: 'spinner w-5 h-5 border-2' }) : e('span', { className: 'text-xl' }, '↻'),
              e('span', null, loading ? 'Sincronizando...' : 'Atualizar Estado')
            ),
            e('label', { className: 'flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-slate-200/50 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition-colors' },
              e('div', { className: `w-10 h-6 rounded-full p-1 transition-colors ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-600'} flex items-center` },
                e('div', { className: `w-4 h-4 bg-white rounded-full shadow transition-transform ${autoRefresh ? 'translate-x-4' : 'translate-x-0'}` })
              ),
              e('span', { className: 'font-medium' }, 'Auto-Refresh')
            ),
            e('div', { className: 'flex flex-col gap-2 bg-slate-900/60 border border-slate-300 rounded-xl p-3' },
              e('label', { className: 'text-xs uppercase tracking-widest text-slate-500 font-bold' }, 'MCP Base URL'),
              e('input', {
                className: 'bg-white border border-slate-200 rounded px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none',
                value: baseUrl,
                onChange: (e) => setBaseUrl(e.target.value),
                placeholder: 'http://192.168.10.9:8000'
              })
            )
          )
        )
      ),

      // QUICK ACTIONS GRID
      e('div', { className: 'space-y-4' },
        e('div', { className: 'flex items-center gap-2 mb-2' },
          e('h3', { className: 'text-xl font-bold text-slate-800 tracking-tight' }, '🚀 Ações Rápidas'),
          e('div', { className: 'h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent ml-4' })
        ),
        e('div', { className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4' },
          quicks.map((q, idx) =>
            e('button', {
              key: idx,
              className: `group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-200 hover:border-${q.color}-500/50 hover:bg-slate-200/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-${q.color}-500/10`,
              onClick: () => runTool(q.tool, q.args),
              disabled: loading
            },
              e('div', { className: `text-3xl p-3 rounded-xl bg-${q.color}-500/10 text-${q.color}-400 group-hover:scale-110 transition-transform duration-300 mb-1` }, q.icon),
              e('div', { className: 'text-xs font-bold text-slate-700 group-hover:text-blue-600 text-center' }, q.label),
              e('div', { className: 'absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-white/5 pointer-events-none' })
            )
          )
        )
      ),

      // TERMINAL & HISTORY SECTION
      e('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px] lg:h-[500px]' },

        // RESULT CONSOLE
        e('div', { className: `lg:col-span-2 ${glassCard} flex flex-col` },
          e('div', { className: 'flex justify-between items-center p-4 border-b border-slate-300/50 bg-slate-100/50' },
            e('div', { className: 'flex items-center gap-2' },
              e('div', { className: 'flex gap-1.5' },
                e('div', { className: 'w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50' }),
                e('div', { className: 'w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50' }),
                e('div', { className: 'w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50' }),
              ),
              e('span', { className: 'ml-3 text-xs font-mono text-slate-600 font-bold uppercase tracking-wider' }, 'Output Console')
            ),
            e('div', { className: 'flex gap-2' },
              e('button', {
                className: 'text-[10px] items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-600 hover:text-white transition-colors flex',
                onClick: () => navigator.clipboard.writeText(String(lastRun?.content || '')).catch(() => pushToast('Erro ao copiar', 'error'))
              }, e('span', null, '📋'), 'COPY JSON'),
              e('button', {
                className: 'text-[10px] items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-600 hover:text-white transition-colors flex',
                onClick: () => runTool(lastRun?.name, lastRun?.arguments), // Re-run
                disabled: !lastRun
              }, e('span', null, '↻'), 'RERUN')
            )
          ),
          e('div', { className: 'flex-1 overflow-auto p-0 relative group' },
            e('div', { className: 'absolute inset-0 pointer-events-none bg-scanlines opacity-[0.03] z-10' }), // Scanlines effect
            lastRun ?
              e('pre', { className: 'font-mono text-xs leading-relaxed p-6 text-blue-100 whitespace-pre-wrap selection:bg-blue-500/30' },
                e('span', { className: 'text-emerald-400 font-bold block mb-2' }, `➜ ${lastRun.name} execution_result:`),
                lastRun.content
              ) :
              e('div', { className: 'flex flex-col items-center justify-center h-full text-slate-600 gap-4' },
                e('div', { className: 'text-6xl opacity-20' }, '💻'),
                e('div', { className: 'text-sm font-mono' }, 'Aguardando execução de comando...')
              )
          ),
          lastRun?.meta && e('div', { className: 'p-2 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-mono text-right px-4' },
            `Process finished in ${lastRun.meta.duration_ms}ms with exit code 0`
          )
        ),

        // ACTIVITY LOG
        e('div', { className: `${glassCard} flex flex-col` },
          e('div', { className: 'p-4 border-b border-slate-300/50 bg-slate-100/50 flex justify-between items-center' },
            e('h3', { className: 'text-sm font-bold text-slate-800 flex items-center gap-2' },
              e('span', { className: 'text-emerald-400' }, '●'), 'Activity Feed'
            ),
            e('button', { className: 'text-[10px] text-slate-500 hover:text-red-600', onClick: () => setLog([]) }, 'CLEAR')
          ),
          e('div', { className: 'flex-1 overflow-auto p-4 space-y-3 font-mono text-xs custom-scrollbar' },
            log.length === 0 ? e('div', { className: 'text-center text-slate-600 mt-10 italic' }, 'No activity recorded') :
              log.slice().reverse().map((l, i) => {
                const isError = l.includes('❌');
                const isSuccess = l.includes('✅');
                const isCmd = l.includes('>');
                return e('div', { key: i, className: `pl-3 border-l-2 ${isError ? 'border-red-500 text-red-300' : isSuccess ? 'border-emerald-500 text-emerald-300' : isCmd ? 'border-blue-500 text-blue-300' : 'border-slate-300 text-slate-600'} py-0.5 animate-fade-in` },
                  e('span', { className: 'opacity-50 mr-2 text-[10px]' }, new Date().toLocaleTimeString()),
                  l
                );
              })
          )
        )
      ),

      // TOAST NOTIFICATION
      toast && e('div', {
        className: `fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 z-50 animate-slide-up ${toast.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : toast.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-600 border-blue-500 text-white'}`
      },
        e('span', { className: 'text-xl' }, toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '✕' : 'ℹ'),
        e('span', { className: 'font-bold' }, toast.msg)
      )
    );
  }

  function LiveMonitor() {
    const { data, loading, error, reload } = useFetch('/api/system/realtime', [], { pollInterval: 5000 });

    if (loading && !data) return e('div', { className: 'glass-card p-12 flex justify-center' }, e('div', { className: 'spinner' }));
    if (error) return e('div', { className: 'glass-card p-6 border-red-500/30' }, 'Falha no monitoramento: ' + String(error));

    const ports = data.ports || [];
    const services = data.services || [];
    const osInfo = data.os || 'Linux';
    const kernel = data.kernel || 'Unknown';
    const uptime = data.uptime || 'Unknown';

    return e('div', { className: 'glass-card fade-in mt-8' },
      e('div', { className: 'flex justify-between items-center mb-6 border-b border-white/5 pb-4' },
        e('div', { className: 'flex items-center gap-3' },
          e('div', { className: 'w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(37,99,235,0.2)]' }, '📡'),
          e('div', null,
            e('h3', { className: 'text-xl font-bold text-white tracking-tight' }, 'Monitoramento em Tempo Real'),
            e('div', { className: 'text-xs text-slate-600 font-mono mt-1' }, `${osInfo} • Kernel ${kernel} • Uptime: ${uptime}`)
          )
        ),
        e('div', { className: 'flex items-center gap-2' },
          e('span', { className: 'flex h-3 w-3 relative' },
            e('span', { className: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' }),
            e('span', { className: 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500' })
          ),
          e('span', { className: 'text-xs font-bold text-emerald-400 uppercase tracking-widest' }, 'LIVE')
        )
      ),

      // Services Status Pills
      e('div', { className: 'flex flex-wrap gap-4 mb-8' },
        services.map(svc => {
          const isActive = svc.status === 'active';
          return e('div', {
            key: svc.name,
            className: `flex items-center gap-2 px-3 py-1.5 rounded-full border ${isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} transition-all hover:scale-105`
          },
            e('div', { className: `w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}` }),
            e('span', { className: 'text-xs font-bold uppercase tracking-wider' }, svc.name)
          );
        })
      ),

      // Ports Table
      e('div', { className: 'overflow-x-auto rounded-xl border border-white/5 bg-slate-900/30' },
        e('table', { className: 'w-full text-left text-sm' },
          e('thead', { className: 'bg-white/5 text-slate-600 uppercase font-bold text-xs' },
            e('tr', null,
              e('th', { className: 'px-4 py-3' }, 'Protocolo'),
              e('th', { className: 'px-4 py-3' }, 'Porta'),
              e('th', { className: 'px-4 py-3' }, 'PID'),
              e('th', { className: 'px-4 py-3' }, 'Serviço / Processo'),
              e('th', { className: 'px-4 py-3' }, 'Endereço Bind')
            )
          ),
          e('tbody', { className: 'divide-y divide-white/5' },
            ports.map((p, i) =>
              e('tr', { key: i, className: 'hover:bg-white/5 transition-colors group' },
                e('td', { className: 'px-4 py-3 font-mono text-slate-700' }, p.proto),
                e('td', { className: 'px-4 py-3' },
                  e('span', { className: 'px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold border border-blue-500/20' }, p.port)
                ),
                e('td', { className: 'px-4 py-3 font-mono text-slate-500' }, p.pid),
                e('td', { className: 'px-4 py-3' },
                  e('div', { className: 'font-bold text-slate-800' }, p.service),
                  p.description && e('div', { className: 'text-[10px] text-slate-500' }, p.description)
                ),
                e('td', { className: 'px-4 py-3 font-mono text-slate-600' }, p.bind)
              )
            )
          )
        )
      )
    );
  }

  function ViewObservability({ kpis, pollInterval, reloadKey, setLogModal, setLogModalPath, setLogModalSearch, setLogModalLines, setLogModalSummary }) {
    const [localReload, setLocalReload] = React.useState(0);
    const backupScriptsRes = useFetch('/api/scripts/status', [reloadKey, localReload], { pollInterval });

    const totalLogs = kpis.data ? kpis.data.log_files : '...';
    const criticalErrors = kpis.data ? (kpis.data.critical_errors || 0) : 0;
    const backupScripts = backupScriptsRes.data || [];

    const openLog = (path, opts) => {
      setLogModal(true);
      setLogModalPath(path);
      setLogModalSearch(opts && opts.initialSearch ? opts.initialSearch : null);
      setLogModalLines(opts && opts.lines ? opts.lines : 500);
      if (opts && opts.summary) {
        setLogModalSummary(opts.summary);
      } else {
        setLogModalSummary(null);
      }
    };

    return e('div', { className: 'view-container animate-fade-in' },
      // Top KPIs
      e('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8' },
        e(KpiCard, { title: 'Total de Logs', value: totalLogs, icon: '📄', color: '#3b82f6' }),
        e(KpiCard, { title: 'Status do Backup', value: 'Monitorando', icon: '🛡️', color: '#10b981', sub: 'Serviço Ativo' }),
        e(KpiCard, { title: 'Cloud Storage', value: 'Conectado', icon: '☁️', color: '#8b5cf6', sub: 'Rclone' }),
        e(KpiCard, { title: 'Alertas', value: criticalErrors, sub: criticalErrors > 0 ? 'Erros Críticos' : 'Nenhum alerta crítico', icon: '🔔', color: criticalErrors > 0 ? 'red' : 'gray' })
      ),

      // Status Cards Row
      e('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8' },
        e(RcloneStatusCard, null),
        e(ScheduleOverviewCard, null)
      ),

      // New Reliability Widget
      e(BackupReliabilityWidget, null),

      // Monitoramento em Tempo Real (Live Monitor)
      e(LiveMonitor, null),

      // Main Script Status Dashboard (Replaces Table)
      e(ScriptStatusDashboard, {
        list: backupScripts,
        openLog: openLog,
        reload: () => setLocalReload(prev => prev + 1)
      })
    );
  }

  function ViewDocumentation({ active }) {
    const [docs, setDocs] = React.useState([]);
    const [selectedDoc, setSelectedDoc] = React.useState(null);
    const [content, setContent] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [systemInfo, setSystemInfo] = React.useState(null);
    const [search, setSearch] = React.useState('');

    const fetchDocs = React.useCallback(() => {
      fetch('/api/docs/list')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setDocs(data);
        })
        .catch(console.error);
    }, []);

    React.useEffect(() => {
      if (active) {
        fetchDocs();
        fetch('/api/system/realtime').then(r => r.json()).then(setSystemInfo).catch(console.error);
      }
    }, [active, fetchDocs]);

    React.useEffect(() => {
      if (!selectedDoc) return;
      setLoading(true);

      // Use efficient params for validation
      const params = new URLSearchParams();
      if (selectedDoc.id && selectedDoc.type === 'script') {
        params.append('path', selectedDoc.path);
        params.append('type', 'script');
        params.append('id', selectedDoc.id);
      } else {
        params.append('name', selectedDoc.name);
        params.append('type', 'manual');
        params.append('path', selectedDoc.name);
      }

      fetch('/api/docs/content?' + params.toString())
        .then(r => r.json())
        .then(data => {
          setContent(data.content || 'Erro ao carregar conteúdo.');
          setLoading(false);
        })
        .catch(e => {
          console.error(e);
          setContent('Erro ao carregar.');
          setLoading(false);
        });
    }, [selectedDoc]);

    // Simple Markdown Parser for UX
    const renderMarkdown = (text) => {
      if (!text) return null;
      const lines = text.split('\n');
      return lines.map((line, idx) => {
        if (line.startsWith('# ')) return e('h1', { key: idx, className: 'text-2xl font-bold text-slate-800 mt-6 mb-4 pb-2 border-b border-slate-300' }, line.substring(2));
        if (line.startsWith('## ')) return e('h2', { key: idx, className: 'text-xl font-bold text-blue-400 mt-5 mb-3' }, line.substring(3));
        if (line.startsWith('### ')) return e('h3', { key: idx, className: 'text-lg font-bold text-slate-800 mt-4 mb-2' }, line.substring(4));
        if (line.startsWith('```')) return e('div', { key: idx, className: 'bg-slate-900 border border-slate-300 rounded p-4 font-mono text-sm text-slate-700 my-4 overflow-x-auto shadow-inner' }, 'Code Block');
        // Simple heuristic for code blocks would need state, for simplicity treating as pre

        // Bold
        const processed = line.split(/(\*\*.*?\*\*)/).map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) return e('strong', { key: i, className: 'text-white' }, part.slice(2, -2));
          return part;
        });

        return e('div', { key: idx, className: 'mb-1 text-slate-600' }, processed.length > 1 ? processed : line);
      });
    };

    // Better parser that handles code blocks
    const SimpleMarkdown = ({ text }) => {
      const parts = [];
      let inCode = false;
      let codeBuffer = [];

      text.split('\n').forEach((line, i) => {
        if (line.startsWith('```')) {
          if (inCode) {
            parts.push(e('pre', { key: i, className: 'bg-slate-100/50 border border-slate-300/50 rounded-lg p-4 font-mono text-sm text-blue-600 my-4 overflow-x-auto' }, codeBuffer.join('\n')));
            codeBuffer = [];
            inCode = false;
          } else {
            inCode = true;
          }
        } else if (inCode) {
          codeBuffer.push(line);
        } else {
          if (line.startsWith('# ')) parts.push(e('h1', { key: i, className: 'text-3xl font-bold text-slate-800 mt-8 mb-6 pb-4 border-b border-slate-300/50' }, line.substring(2)));
          else if (line.startsWith('## ')) parts.push(e('h2', { key: i, className: 'text-xl font-bold text-blue-400 mt-6 mb-4 flex items-center gap-2' }, e('span', { className: 'opacity-50' }, '#'), line.substring(3)));
          else if (line.startsWith('### ')) parts.push(e('h3', { key: i, className: 'text-lg font-bold text-slate-800 mt-4 mb-2' }, line.substring(4)));
          else if (line.trim() === '') parts.push(e('div', { key: i, className: 'h-2' }));
          else if (line.startsWith('- ')) parts.push(e('li', { key: i, className: 'ml-4 list-disc text-slate-700' }, line.substring(2)));
          else {
            // Bold support
            const segments = line.split(/(\*\*.*?\*\*|`.*?`)/).map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) return e('strong', { key: idx, className: 'text-slate-900 font-bold' }, part.slice(2, -2));
              if (part.startsWith('`') && part.endsWith('`')) return e('code', { key: idx, className: 'bg-slate-200 px-1 py-0.5 rounded text-blue-300 font-mono text-sm' }, part.slice(1, -1));
              return part;
            });
            parts.push(e('p', { key: i, className: 'mb-2 leading-relaxed text-slate-700' }, segments));
          }
        }
      });
      return e('div', { className: 'markdown-content w-full mx-auto' }, parts);
    };

    // Filter and Group
    const filteredDocs = React.useMemo(() => {
      if (!search) return docs;
      return docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    }, [docs, search]);

    const groupedDocs = React.useMemo(() => {
      const groups = {};
      filteredDocs.forEach(d => {
        const cat = d.category || 'Outros';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(d);
      });
      return groups;
    }, [filteredDocs]);

    if (!active) return null;

    return e('div', { className: 'view-container fade-in flex gap-6 h-[calc(100vh-140px)]' },
      // Sidebar List
      e('div', { className: 'w-72 flex-shrink-0 flex flex-col bg-white/80 rounded-xl border border-slate-300/50 overflow-hidden' },
        e('div', { className: 'p-4 border-b border-slate-300/50' },
          e('input', {
            type: 'text',
            placeholder: 'Buscar docs...',
            className: 'w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none transition-colors',
            value: search,
            onChange: ev => setSearch(ev.target.value)
          })
        ),
        e('div', { className: 'flex-1 overflow-y-auto p-2' },
          Object.keys(groupedDocs).length === 0 ? e('div', { className: 'text-center p-4 text-slate-500 text-sm' }, 'Nenhum documento encontrado.') :
            Object.keys(groupedDocs).sort().map(cat =>
              e('div', { key: cat, className: 'mb-4' },
                e('h4', { className: 'px-3 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1' }, cat),
                e('div', { className: 'space-y-0.5' },
                  groupedDocs[cat].map(doc =>
                    e('button', {
                      key: doc.id || doc.name,
                      onClick: () => setSelectedDoc(doc),
                      className: `w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex justify-between items-center group ${selectedDoc && (selectedDoc.id === doc.id || selectedDoc.name === doc.name) ? 'bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/50' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`
                    },
                      e('span', { className: 'truncate' }, doc.name),
                      doc.type === 'script' && e('span', { className: 'text-[10px] bg-slate-200 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity' }, 'SH')
                    )
                  )
                )
              )
            )
        ),

        // Little System Footer
        e('div', { className: 'p-4 bg-slate-100/30 border-t border-slate-200/50 text-xs text-slate-500' },
          systemInfo ? e('div', null,
            e('div', { className: 'flex justify-between' }, e('span', null, 'Kernel'), e('span', { className: 'text-slate-600' }, systemInfo.kernel.split('-')[0])),
            e('div', { className: 'flex justify-between mt-1' }, e('span', null, 'Uptime'), e('span', { className: 'text-slate-600' }, systemInfo.uptime.split(',')[0]))
          ) : 'Carregando info...'
        )
      ),

      // Content Area
      e('div', { className: 'flex-1 bg-white/80 rounded-xl border border-slate-300/50 p-6 overflow-y-auto' },
        selectedDoc ? e(React.Fragment, null,
          e('div', { className: 'mb-6 border-b border-slate-300/50 pb-4' },
            e('h2', { className: 'text-2xl font-bold text-slate-800 mb-2' }, selectedDoc.name),
            e('div', { className: 'flex gap-4 text-xs text-slate-600' },
              e('span', null, '📅 ' + new Date(selectedDoc.mtime * 1000).toLocaleString()),
              e('span', null, '📂 ' + (selectedDoc.category || 'Geral')),
              selectedDoc.type === 'script' && e('span', { className: 'text-blue-400' }, '💻 Script do Sistema')
            )
          ),
          e('div', { className: 'markdown-body text-slate-700 leading-relaxed font-sans' },
            loading ? e('div', { className: 'flex items-center gap-2 text-blue-400' }, e('div', { className: 'spinner' }), 'Carregando documentação...') :
              e(SimpleMarkdown, { text: content })
          )
        ) : (systemInfo ?
          e('div', null,
            e('h2', { className: 'text-2xl font-bold text-white mb-6' }, 'Monitoramento em Tempo Real'),
            e('div', { className: 'grid grid-cols-1 gap-6' },
              e('div', { className: 'bg-slate-100 p-5 rounded-lg border border-slate-200' },
                e('div', { className: 'flex justify-between items-center mb-4' },
                  e('h3', { className: 'font-bold text-blue-400 text-lg' }, 'Portas & Serviços Ativos'),
                  e('span', { className: 'text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-200' }, 'Live Monitor')
                ),
                e('div', { className: 'overflow-x-auto' },
                  e('table', { className: 'w-full text-left text-sm border-collapse' },
                    e('thead', { className: 'text-slate-500 border-b border-slate-200 uppercase text-xs font-bold tracking-wider' },
                      e('tr', null,
                        e('th', { className: 'p-3' }, 'Proto'),
                        e('th', { className: 'p-3' }, 'Porta'),
                        e('th', { className: 'p-3' }, 'PID'),
                        e('th', { className: 'p-3' }, 'Serviço / Processo'),
                        e('th', { className: 'p-3' }, 'Bind Address')
                      )
                    ),
                    e('tbody', { className: 'divide-y divide-slate-800/50' },
                      (systemInfo.ports || []).map((p, i) =>
                        e('tr', { key: i, className: 'hover:bg-white/80 transition-colors group' },
                          e('td', { className: 'p-3' },
                            e('span', { className: `text-[10px] px-1.5 py-0.5 rounded font-bold ${p.proto === 'tcp' ? 'bg-blue-900/30 text-blue-400' : 'bg-amber-900/30 text-amber-400'}` }, p.proto.toUpperCase())
                          ),
                          e('td', { className: 'p-3 font-mono text-green-400 font-bold' }, p.port),
                          e('td', { className: 'p-3 font-mono text-slate-500' }, p.pid !== '-' ? p.pid : e('span', { className: 'opacity-30' }, '-')),
                          e('td', { className: 'p-3 text-slate-700' },
                            e('div', { className: 'flex items-center gap-2' },
                              e('span', { className: 'font-medium' }, p.service || 'Unknown'),
                              p.description && e('span', { className: 'text-xs text-slate-500 truncate max-w-[200px] hidden md:inline-block opacity-70 group-hover:opacity-100 transition-opacity' }, `(${p.description})`)
                            )
                          ),
                          e('td', { className: 'p-3 text-slate-500 font-mono text-xs' }, p.bind)
                        )
                      )
                    )
                  )
                ),
                (systemInfo.ports || []).length === 0 && e('div', { className: 'text-center p-8 text-slate-500 italic' }, 'Nenhuma porta aberta detectada (ou erro de permissão).')
              )
            )
          )
          : e('div', { className: 'h-full flex items-center justify-center text-slate-500 flex-col gap-2' },
            e('div', { className: 'text-4xl opacity-20' }, '📚'),
            'Selecione um documento para visualizar.'
          )
        )
      )
    );
  }

  function NavButton({ active, onClick, icon, label }) {
    return e('button', {
      className: `nav-btn ${active ? 'active' : ''}`,
      onClick: onClick,
      title: label
    },
      e('span', { className: 'nav-icon' }, icon),
      e('span', { className: 'nav-label' }, label)
    );
  }

  function App() {
    // State
    // State
    const [persona, setPersona] = React.useState('OPS');
    const [activeView, setActiveView] = React.useState('infra');
    
    // Premium Glow Activation
    React.useEffect(() => {
        document.body.classList.add('premium-glow');
        return () => document.body.classList.remove('premium-glow');
    }, []);
    const [reloadKey, setReloadKey] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [lastUpdated, setLastUpdated] = React.useState(null);

    // Global Settings
    const [auto, setAuto] = React.useState(true);
    const [intervalMs, setIntervalMs] = React.useState(() => {
      try {
        const s = localStorage.getItem('dashboardPrefs_v2');
        if (!s) return 5000;
        const p = JSON.parse(s);
        return p.refreshInterval || 5000;
      } catch (e) { return 5000; }
    });
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    // Modals
    const [selected, setSelected] = React.useState(null);
    const [aclModalItem, setAclModalItem] = React.useState(null);
    const [logModal, setLogModal] = React.useState(false);
    const [logModalPath, setLogModalPath] = React.useState(null);
    const [logModalSummary, setLogModalSummary] = React.useState(null);
    const [logModalSearch, setLogModalSearch] = React.useState(null);
    const [logModalLines, setLogModalLines] = React.useState(500);
    const [toast, setToast] = React.useState(null);

    // Data Fetching
    const pollInterval = auto ? intervalMs : null;
    const kpis = useFetch('/api/kpis', [reloadKey], { pollInterval });
    const metrics = useFetch('/api/metrics/history', [reloadKey], { pollInterval });
    const processes = useFetch('/api/top-processes', [reloadKey], { pollInterval });
    const shares = useFetch('/api/samba/shares-aggregated', [reloadKey], { pollInterval: 60000 });

    // Chart Refs
    const chartsRef = React.useRef({ cpu: null, mem: null });
    const cpuRef = React.useRef(null);
    const memRef = React.useRef(null);

    React.useEffect(() => {
      if (kpis.data) setLastUpdated(new Date().toLocaleTimeString());
    }, [kpis.data]);

    // Persist simple user preferences
    React.useEffect(() => {
      try {
        const prefs = { refreshInterval: intervalMs, auto: !!auto, persona: persona, activeView };
        localStorage.setItem('dashboardPrefs_v2', JSON.stringify(prefs));
      } catch (e) { /* ignore */ }
    }, [intervalMs, auto, persona, activeView]);

    // Body Scroll Lock to prevent background scrolling
    React.useEffect(() => {
      if (mobileMenuOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
    }, [mobileMenuOpen]);

    // Touch gestures for mobile sidebar (swipe to open/close)
    React.useEffect(() => {
      let touchStartX = 0;
      const onTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
      const onTouchEnd = (e) => {
        const touchEndX = e.changedTouches[0].screenX;

        // Swipe Right from left edge -> OPEN (if not already open)
        if (!mobileMenuOpen && touchStartX < 50 && touchEndX > touchStartX + 50) {
          setMobileMenuOpen(true);
        }

        // Swipe Left -> CLOSE (if open)
        // We allow swiping left from almost anywhere to close
        if (mobileMenuOpen && touchStartX > touchEndX + 50) {
          setMobileMenuOpen(false);
        }
      };
      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
      return () => {
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchend', onTouchEnd);
      };
    }, [mobileMenuOpen]);

    const onRefresh = () => {
      setIsLoading(true);
      setReloadKey(k => k + 1);
      setTimeout(() => setIsLoading(false), 800);
    };

    // Redirect if current view is not allowed for new persona
    React.useEffect(() => {
      // Re-define allowed menus here or move PERSONA_MENUS to global/shared scope
      // For simplicity, duplicate simple logic or check known restrictions
      const PERSONA_MENUS_KEYS = {
        'OPS': ['infra', 'jobs', 'storage', 'samba', 'mcp-live', 'obs', 'validation', 'reports', 'docs'],
        'ANALYST': ['infra', 'storage', 'obs', 'validation', 'reports', 'docs'],
        'MANAGER': ['infra', 'validation', 'reports', 'docs'],
        'DEV': ['infra', 'mcp-live', 'obs', 'validation', 'docs', 'jobs']
      };
      const allowed = PERSONA_MENUS_KEYS[persona] || PERSONA_MENUS_KEYS['OPS'];
      if (!allowed.includes(activeView)) {
        setActiveView('infra'); // Fallback to safe view
      }
    }, [persona, activeView]);

    // Chart Logic
    React.useEffect(() => {
      if (activeView !== 'infra' || !metrics.data) return;

      const safeDestroy = (key) => {
        if (chartsRef.current[key]) {
          chartsRef.current[key].destroy();
          chartsRef.current[key] = null;
        }
      };

      try {
        const arr = metrics.data || [];
        const labels = arr.map(x => new Date(x.ts * 1000).toLocaleTimeString());

        const setupChart = (ref, key, label, data, color, bgColor) => {
          if (!ref.current) return;
          if (!chartsRef.current[key]) {
            chartsRef.current[key] = new Chart(ref.current.getContext('2d'), {
              type: 'line',
              data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: bgColor, fill: true, tension: 0.4, pointRadius: 0 }] },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                  x: { display: false }
                }
              }
            });
          } else {
            chartsRef.current[key].data.labels = labels;
            chartsRef.current[key].data.datasets[0].data = data;
            chartsRef.current[key].update('none');
          }
        };

        setupChart(cpuRef, 'cpu', 'CPU %', arr.map(x => x.cpu), '#3b82f6', 'rgba(59, 130, 246, 0.1)');
        setupChart(memRef, 'mem', 'Mem %', arr.map(x => x.mem), '#8b5cf6', 'rgba(139, 92, 246, 0.1)');

      } catch (e) { console.error(e); }

      return () => { safeDestroy('cpu'); safeDestroy('mem'); };
    }, [metrics.data, activeView]);

    // View Mapping
    const getViewTitle = () => {
      const titles = { infra: 'Infraestrutura do Sistema', samba: 'Gestão de Compartilhamentos', storage: 'Armazenamento & I/O', mcp: 'AI & Automação', 'mcp-live': 'MCP Command Center', jobs: 'Scripts & Backup', reports: 'Histórico e Auditoria', docs: 'Documentação Técnica' };
      return titles[activeView] || 'Dashboard';
    };

    return e('div', { id: 'app-root', className: 'flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans' },

      // Sidebar
      e(Sidebar, {
        active: activeView,
        onChange: setActiveView,
        isOpen: mobileMenuOpen,
        onClose: () => setMobileMenuOpen(false),
        persona: persona
      }),

      // Main Content Area
      e('div', { className: 'flex-1 flex flex-col relative overflow-hidden' },
        e(TopBar, {
          title: getViewTitle(),
          onToggleMenu: () => setMobileMenuOpen(s => !s),
          isOpen: mobileMenuOpen,
          persona: persona,
          setPersona: setPersona
        }),

        e('main', { className: 'flex-1 overflow-y-auto p-8 custom-scrollbar' },
          e('div', { className: 'w-full space-y-6 fade-in' },
            activeView === 'infra' && e(ViewInfrastructure, { kpis, metrics, processes, cpuRef, memRef, auto, onRefresh: () => setReloadKey(p => p + 1) }),
            activeView === 'samba' && e(SambaManager, { shares, onRefresh: () => setReloadKey(p => p + 1), onEditACL: setAclModalItem }),
            activeView === 'storage' && e(ViewStorage, { shares, onShowUsers: setSelected, onEditACL: setAclModalItem, isLoading, onRefresh }),
            activeView === 'mcp-live' && e(ViewMCPLive, null),
            activeView === 'jobs' && e(ViewExecution, { auto }),

            activeView === 'obs' && e(ViewObservability, { kpis, pollInterval, reloadKey, setLogModal, setLogModalPath, setLogModalSearch, setLogModalLines, setLogModalSummary }),
            activeView === 'docs' && e(ViewDocumentation, { active: activeView === 'docs' }),
            activeView === 'validation' && e(ViewValidation, null),
            activeView === 'reports' && e(ReportsHistory, null)
          )
        )
      ),

      // Global Modals
      e(UsersModal, { item: selected, onClose: () => setSelected(null) }),
      e(ACLModal, { item: aclModalItem, onClose: () => setAclModalItem(null) }),
      e(LogModal, {
        visible: logModal,
        onClose: () => { setLogModal(false); setLogModalSummary(null); },
        initialPath: logModalPath,
        initialSearch: logModalSearch,
        initialLines: logModalLines,
        summary: logModalSummary
      }),

      // Portal Toast
      toast && ReactDOM.createPortal(
        e('div', { className: `fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 z-[100] animate-slide-up bg-blue-600 text-white border-blue-500` },
          e('span', { className: 'text-xl' }, 'ℹ'),
          e('span', { className: 'font-bold' }, toast.msg)
        ),
        document.getElementById('toast-root') || document.body
      )
    );
  }

  const reactRoot = document.getElementById('root');
  if (reactRoot) {
    ReactDOM.createRoot(reactRoot).render(e(App));
  }

})();
