// Universe Dashboard Logic
const Universe = {
    chart: null,
    chartData: {
        labels: [],
        cpu: [],
        mem: []
    },
    activeJobsCache: [],

    init() {
        this.initTelemetry();
        this.loadTelemetryHistory(); // Preload data
        this.fetchKPIs();
        this.fetchActiveJobs();
        this.fetchBackups();
        this.fetchBackups();
        this.fetchFileSystem();
        this.fetchSMBSessions();

        // Polling
        setInterval(() => this.fetchKPIs(), 2000);
        setInterval(() => this.fetchActiveJobs(), 5000);
        setInterval(() => this.fetchSMBSessions(), 10000); // Poll SMB every 10s
        setInterval(() => this.tickActiveJobs(), 1000); // Live ticker
    },

    initTelemetry() {
        const ctx = document.getElementById('telemetryChart');
        if (!ctx) return;

        // Gradient setup (approximation, context not fully available yet)
        // We will set colors directly in dataset

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''), // 30 points placeholder
                datasets: [
                    {
                        label: 'CPU Load (%)',
                        data: Array(30).fill(0),
                        borderColor: '#4cc9f0', // nebula-blue
                        backgroundColor: 'rgba(76, 201, 240, 0.1)',
                        borderWidth: 2,
                        tension: 0.4, // Smooths the curve
                        fill: true,
                        pointRadius: 0
                    },
                    {
                        label: 'Memory Usage (%)',
                        data: Array(30).fill(0),
                        borderColor: '#f72585', // nebula-pink (custom)
                        backgroundColor: 'rgba(247, 37, 133, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Performance
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: 'rgba(255,255,255,0.7)', font: { family: 'Inter' } }
                    }
                },
                scales: {
                    x: {
                        display: false // Hide time labels for cleanliness
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.5)' }
                    }
                }
            }
        });
    },

    async loadTelemetryHistory() {
        if (!this.chart) return;
        try {
            const res = await fetch('/api/metrics-history');
            const history = await res.json(); // Array of {ts, cpu, mem}

            if (!Array.isArray(history) || history.length === 0) return;

            // We need the last 30 points
            // App stores max 600, so we slice the end
            const recent = history.slice(-30);

            const labels = [];
            const cpuData = [];
            const memData = [];

            recent.forEach(pt => {
                // Convert timestamp to time string
                const date = new Date(pt.ts * 1000);
                labels.push(date.toLocaleTimeString());
                cpuData.push(pt.cpu);
                memData.push(pt.mem);
            });

            // Fill remaining if less than 30 (optional, but finding 30 is cleaner)
            // But chart expects array of length 30 initially as we defined it?
            // Actually we initialized it with 30 empty strings and 0s. 
            // We should just replace the data.

            // Pad if necessary to maintain scroll effect or just set
            while (labels.length < 30) {
                labels.unshift('');
                cpuData.unshift(0);
                memData.unshift(0);
            }

            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = cpuData;
            this.chart.data.datasets[1].data = memData;
            this.chart.update();

        } catch (e) {
            console.error('Failed to load telemetry history', e);
        }
    },

    async fetchKPIs() {
        try {
            const res = await fetch('/api/kpis');
            const data = await res.json();

            this.updateMetric('cpu-val', data.cpu_percent + '%', data.cpu_percent);
            this.updateMetric('mem-val', data.mem_percent + '%', data.mem_percent);

            // Multi-Disk Render
            const diskContainer = document.getElementById('storage-pools-list');
            if (diskContainer && data.disks) {
                diskContainer.innerHTML = '';

                // Prioritize specific order: /, /dados, /dados-ext, /dados-ext-II
                const order = ['/', '/dados', '/dados-ext', '/dados-ext-II'];
                const keys = Object.keys(data.disks).sort((a, b) => {
                    let idxA = order.indexOf(a);
                    let idxB = order.indexOf(b);
                    if (idxA === -1) idxA = 99;
                    if (idxB === -1) idxB = 99;
                    return idxA - idxB;
                });

                keys.forEach(path => {
                    const d = data.disks[path];
                    const percent = d.percent;
                    const usedGB = (d.used / 1024 / 1024 / 1024).toFixed(1);
                    const totalGB = (d.total / 1024 / 1024 / 1024).toFixed(1);

                    // Assign colors based on path or index
                    let color = 'var(--neon-blue)';
                    if (path === '/dados') color = 'var(--neon-cyan)';
                    if (path === '/dados-ext') color = '#f72585'; // Pink
                    if (path === '/dados-ext-II') color = '#7209b7'; // Purple

                    // Alert color if full
                    if (percent > 90) color = 'var(--neon-alert)';

                    const el = document.createElement('div');
                    el.style.marginBottom = '15px';
                    el.innerHTML = `
                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;">
                            <span style="font-weight:600; color:white;">${path}</span>
                            <span style="color:${color};">${percent}%</span>
                        </div>
                        <div class="progress-bar" style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px;">
                            <div style="height:100%; width:${percent}%; background:${color}; border-radius:3px; transition:width 1s;"></div>
                        </div>
                        <div style="text-align:right; font-size:0.65rem; opacity:0.5; margin-top:2px;">
                            ${usedGB} / ${totalGB} GB
                        </div>
                    `;
                    diskContainer.appendChild(el);
                });
            }


            // Dynamic health status
            const health = data.cpu_percent < 80 && data.mem_percent < 90 ? 'NOMINAL' : 'CRITICAL';
            const healthEl = document.getElementById('sys-health');
            if (healthEl) {
                healthEl.innerText = health;
                healthEl.className = `status-badge ${health === 'NOMINAL' ? 'status-success' : 'status-danger'}`;
            }

            // Update Chart
            if (this.chart) {
                const now = new Date().toLocaleTimeString();

                // Shift data
                const labels = this.chart.data.labels;
                const cpuData = this.chart.data.datasets[0].data;
                const memData = this.chart.data.datasets[1].data;

                if (labels.length >= 30) {
                    labels.shift();
                    cpuData.shift();
                    memData.shift();
                }

                labels.push(now);
                cpuData.push(data.cpu_percent);
                memData.push(data.mem_percent);

                this.chart.update();
            }

        } catch (e) { console.error('KPI fetch failed', e); }
    },

    async fetchActiveJobs() {
        try {
            const res = await fetch('/api/jobs/active');
            const data = await res.json();
            this.activeJobsCache = data; // Cache for ticker
            this.renderActiveJobs();
        } catch (e) { console.error('Jobs fetch failed', e); }
    },

    renderActiveJobs() {
        const container = document.getElementById('active-jobs-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.activeJobsCache.length === 0) {
            container.innerHTML = '<div style="opacity:0.5; font-style:italic; padding:10px;">No active operations in orbit.</div>';
            return;
        }

        this.activeJobsCache.forEach(job => {
            const el = document.createElement('div');
            el.className = 'glass-panel job-card'; // job-card for specific styling if needed
            el.dataset.pid = job.pid;
            el.style.padding = '12px';
            el.style.marginBottom = '10px';
            el.style.borderLeft = '3px solid var(--success)';

            // Calculate current duration locally to avoid jitter
            // We assume job.duration_seconds was correct at fetch time
            // Better: activeJobsCache should store "fetchTime" and we calc diff
            // For now, simple render

            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color:var(--starlight); font-weight:600;">${job.key}</span>
                    <span class="status-badge status-success animate-pulse">RUNNING</span>
                </div>
                <div style="font-size:0.8rem; opacity:0.7; display:flex; justify-content:space-between;">
                    <span>PID: <span style="font-family:'JetBrains Mono'">${job.pid}</span></span>
                    <span class="job-duration" data-start="${Date.now() - (job.duration_seconds * 1000)}">
                        ${this.formatDuration(job.duration_seconds)}
                    </span>
                </div>
            `;
            container.appendChild(el);
        });
    },

    tickActiveJobs() {
        // Find all duration elements and update them
        const durations = document.querySelectorAll('.job-duration');
        durations.forEach(el => {
            const startStr = el.dataset.start;
            if (startStr) {
                const startTime = parseInt(startStr);
                const diffSeconds = Math.floor((Date.now() - startTime) / 1000);
                el.innerText = this.formatDuration(diffSeconds);
            }
        });
    },

    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    },

    async fetchBackups() {
        try {
            const res = await fetch('/api/scripts/status');
            const data = await res.json();

            // Filters
            const backupJobs = data.filter(job =>
                (job.script && job.script.toLowerCase().includes('backup')) ||
                (job.label && job.label.toLowerCase().includes('backup'))
            );

            const total = backupJobs.length;
            if (total === 0) return;

            const failures = backupJobs.filter(j => j.status === 'error').length;
            const warnings = backupJobs.filter(j => j.status === 'warning').length;
            const success = total - failures - warnings; // Strict success definition

            // Calculate Rate
            const rate = total > 0 ? Math.round((success / total) * 100) : 0;

            // DOM Updates
            const totalEl = document.getElementById('backup-total-count');
            const rateEl = document.getElementById('backup-success-rate');

            if (totalEl) totalEl.innerText = total;
            if (rateEl) {
                rateEl.innerText = rate + '%';
                // Color coding
                if (rate >= 98) rateEl.style.color = 'var(--success)';
                else if (rate >= 80) rateEl.style.color = 'var(--warning)';
                else rateEl.style.color = 'var(--danger)';
            }

            // Update List (Backup Operations Center > Job History)
            const historyList = document.getElementById('backup-history-list');
            if (historyList) {
                historyList.innerHTML = '';

                // Sort: Errors first, then Warnings, then OK
                backupJobs.sort((a, b) => {
                    const rank = { 'error': 0, 'warning': 1, 'unknown': 2, 'ok': 3 };
                    return rank[a.status] - rank[b.status];
                });

                backupJobs.forEach(job => {
                    let badgeClass = 'status-success';
                    let statusText = 'SUCCESS';

                    if (job.status === 'error') {
                        badgeClass = 'status-danger';
                        statusText = 'FAILURE';
                    } else if (job.status === 'warning') {
                        badgeClass = 'status-warning';
                        statusText = 'WARNING';
                    } else if (job.status === 'unknown') {
                        badgeClass = 'status-warning'; // or neutral
                        statusText = 'UNKNOWN';
                    }

                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    row.innerHTML = `
                        <td style="padding:15px 10px; color:var(--starlight); font-weight:600;">${job.label || job.script}</td>
                        <td style="padding:15px 10px;"><span class="status-badge ${badgeClass}">${statusText}</span></td>
                        <td style="padding:15px 10px; opacity:0.8;">${job.last_run || '--'}</td>
                        <td style="padding:15px 10px; opacity:0.6; font-size:0.8rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${job.summary}">
                            ${job.summary}
                        </td>
                    `;
                    historyList.appendChild(row);
                });
            }

        } catch (e) {
            console.error('Backups fetch failed', e);
            const historyList = document.getElementById('backup-history-list');
            if (historyList) {
                historyList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger); padding:20px;">CONNECTION LOST</td></tr>`;
            }
        }
    },

    async fetchFileSystem() {
        const container = document.getElementById('filesystem-browser');
        if (!container) return;

        try {
            // Using existing samba-aggregated endpoint which gives shares + users + usage
            const res = await fetch('/api/samba/shares-aggregated');
            const shares = await res.json();

            if (!shares || shares.length === 0) {
                container.innerHTML = '<div style="opacity:0.5; text-align:center;">No shares detected.</div>';
                return;
            }

            container.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'universe-grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';

            shares.forEach(share => {
                const card = document.createElement('div');
                card.className = 'glass-panel animate-float';
                card.style.position = 'relative';
                card.style.overflow = 'hidden';

                // Icon based on name
                let icon = 'folder-outline';
                if (share.name.toLowerCase().includes('backup')) icon = 'save-outline';
                if (share.name.toLowerCase().includes('public')) icon = 'people-outline';

                // Size calc if available, else standard card
                // Ignoring detailed usage for now as endpoint structure varies, assume 'path' is key

                card.innerHTML = `
                    <div style="position:absolute; top:-10px; right:-10px; font-size:4rem; opacity:0.05; transform:rotate(15deg);">
                        <ion-icon name="${icon}"></ion-icon>
                    </div>
                    <div style="display:flex; align-items:center; margin-bottom:15px;">
                        <ion-icon name="${icon}" style="font-size:1.5rem; color:var(--nebula-blue); margin-right:10px;"></ion-icon>
                        <h4 style="margin:0; font-size:1rem;">${share.name}</h4>
                    </div>
                    
                    <div style="font-size:0.8rem; opacity:0.7; margin-bottom:5px;">
                        <span style="display:block;">Path: ${share.path}</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; font-size:0.75rem;">
                         <span class="status-badge status-success" style="font-size:0.7rem; padding:2px 6px;">ONLINE</span>
                         <!-- Optional: User count if available in future -->
                    </div>
                `;
                grid.appendChild(card);
            });

            container.appendChild(grid);

        } catch (e) {
            console.error('Filesystem fetch failed', e);
            container.innerHTML = '<div style="color:var(--danger)">Failed to load file system.</div>';
        }
    },

    async fetchSMBSessions() {
        const container = document.getElementById('smb-sessions-list');
        const auditContainer = document.getElementById('smb-audit-list');
        if (!container) return;

        try {
            // 1. Fetch Sessions
            const res = await fetch('/api/samba/sessions');
            if (!res.ok) {
                console.warn('SMB API returned', res.status);
                container.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger);">Error loading sessions.</td></tr>';
                // still try to fetch audit logs below
            }
            const data = await res.json();

            if (!Array.isArray(data)) throw new Error("Invalid session data");

            container.innerHTML = '';
            if (data.length === 0) {
                container.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5; padding:20px;">No active SMB connections.</td></tr>';
            } else {
                data.forEach(s => {
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                    row.innerHTML = `
                        <td style="padding:12px;"><span style="color:var(--neon-cyan); font-weight:600;">${s.service}</span></td>
                        <td style="padding:12px;">${s.machine}</td>
                        <td style="padding:12px; font-family:'JetBrains Mono'; font-size:0.85rem;">${s.pid}</td>
                        <td style="padding:12px; opacity:0.7;">${s.connected_at}</td>
                        <td style="padding:12px;"><span class="status-badge status-success">ACTIVE</span></td>
                    `;
                    container.appendChild(row);
                });
            }

            // 2. Fetch Audit Logs
            if (auditContainer) {
                const resAudit = await fetch('/api/samba/audit');
                const logs = await resAudit.json();

                auditContainer.innerHTML = '';
                if (!Array.isArray(logs) || logs.length === 0) {
                    auditContainer.innerHTML = '<div style="padding:10px opacity:0.5;">No recent audit events.</div>';
                } else {
                    logs.forEach(log => {
                        const div = document.createElement('div');
                        div.style.padding = '8px 0';
                        div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        div.style.fontSize = '0.8rem';

                        let color = 'var(--text-muted)';
                        if (log.level === '0') color = 'var(--neon-alert)'; // Critical

                        div.innerHTML = `
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span style="color:${color}; font-family:'JetBrains Mono'">${log.timestamp}</span>
                                <span style="opacity:0.5;">Lvl ${log.level}</span>
                            </div>
                            <div style="color:white;">${log.message || log.source}</div>
                        `;
                        auditContainer.appendChild(div);
                    });
                }
            }

        } catch (e) {
            console.error('SMB Fetch Error', e);
            container.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger);">Error loading sessions.</td></tr>';
        }
    },

    updateMetric(id, text, percent) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;

        const bar = document.getElementById(id + '-bar');
        if (bar) bar.style.width = percent + '%';
    }
};

document.addEventListener('DOMContentLoaded', () => Universe.init());
