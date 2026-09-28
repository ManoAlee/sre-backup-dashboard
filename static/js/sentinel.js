/**
 * SENTINEL AGENT
 * The Eye that Never Sleeps (Client-Side).
 * Responsibilities:
 * - Polling System Metrics (CPU, RAM, Disk)
 * - Process Monitoring
 * - Service Health
 * - Rendering Live Graphs
 */

const Sentinel = {
    nexus: null,
    interval: null,
    pollRate: 2000,
    history: [],
    maxPoints: 30,

    setLowPowerMode(enabled) {
        if (enabled) {
            this.pollRate = 10000; // Slow down to 10s
        } else {
            this.pollRate = 2000; // Restore to 2s
            this.fetchMetrics(); // Instant update on return
        }
        // Restart poller with new rate
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.fetchMetrics(), this.pollRate);
    },

    boot(nexus) {
        this.nexus = nexus;
        this.nexus.log('Sentinel Agent connecting...');
        this.injectStyles();
        this.startPolling();
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .telemetry-grid {
                display: grid; grid-template-columns: 2fr 1fr; gap: 20px;
                height: 100%;
            }
            .proc-table {
                width: 100%; border-collapse: collapse; font-size: 0.8rem;
            }
            .proc-table th {
                text-align: left; padding: 8px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .proc-table td {
                padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #cbd5e1;
            }
            .service-card {
                background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 8px;
            }
            .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
            .dot.active { background: var(--success); box-shadow: 0 0 5px var(--success); }
            .dot.inactive { background: var(--secondary); }
            .dot.failed { background: var(--danger); }
        `;
        document.head.appendChild(style);
    },

    startPolling() {
        this.fetchMetrics();
        this.interval = setInterval(() => this.fetchMetrics(), this.pollRate);

        // Poll processes/services less frequently
        this.fetchProcesses();
        this.fetchServices();
        setInterval(() => this.fetchProcesses(), 5000);
        setInterval(() => this.fetchServices(), 10000);
    },

    async fetchMetrics() {
        try {
            const res = await fetch('/api/kpis');
            if (!res.ok) throw new Error('Metric signal lost');

            const data = await res.json();
            this.analyze(data);
            this.render(data);

        } catch (e) {
            console.warn('[SENTINEL] Connection unreliable:', e);
        }
    },

    async fetchProcesses() {
        if (!document.getElementById('proc-list')) return;
        try {
            const res = await fetch('/api/processes');
            const json = await res.json();
            this.renderProcesses(json.data || []);
        } catch (e) { }
    },

    async fetchServices() {
        if (!document.getElementById('service-grid')) return;
        try {
            const res = await fetch('/api/services');
            const data = await res.json();
            this.renderServices(data);
        } catch (e) { }
    },

    analyze(data) {
        let stressLevel = 0;
        if (data.cpu_percent > 80) stressLevel++;
        if (data.mem_percent > 90) stressLevel++;

        const healthBadge = document.getElementById('sys-health');
        if (healthBadge) {
            if (stressLevel >= 2) {
                healthBadge.innerText = 'CRITICAL OVERLOAD';
                healthBadge.className = 'status-badge status-danger animate-pulse';
            } else if (stressLevel === 1) {
                healthBadge.innerText = 'SYSTEM STRESS';
                healthBadge.className = 'status-badge status-warning';
            } else {
                healthBadge.innerText = 'NOMINAL';
                healthBadge.className = 'status-badge status-success';
            }
        }
    },

    render(data) {
        // Update Bars
        this.updateBar('cpu-val', data.cpu_percent);
        this.updateBar('mem-val', data.mem_percent);
        this.updateBar('disk-val', data.disk_percent);

        // Update Graph
        this.history.push(data.cpu_percent);
        if (this.history.length > this.maxPoints) this.history.shift();
        this.renderGraph(data);
    },

    updateBar(id, val) {
        const textEl = document.getElementById(id);
        const barEl = document.getElementById(id + '-bar');

        if (textEl) textEl.innerText = val + '%';
        if (barEl) {
            barEl.style.width = val + '%';
            if (val > 80) barEl.style.backgroundColor = 'var(--danger)';
            else if (val > 60) barEl.style.backgroundColor = 'var(--warning)';
            else barEl.style.backgroundColor = 'var(--nebula-blue)';
        }
    },

    renderGraph(data) {
        const container = document.getElementById('telemetry-chart-container');
        if (!container || container.offsetParent === null) return;

        // Small Chart
        let html = '<div style="display:flex; align-items:flex-end; height:100%; width:100%; gap:2px;">';
        this.history.forEach(val => {
            let color = 'linear-gradient(to top, var(--nebula-blue), transparent)';
            if (val > 50) color = 'linear-gradient(to top, var(--warning), transparent)';
            if (val > 80) color = 'linear-gradient(to top, var(--danger), transparent)';

            html += `<div style="width:100%; background:${color}; height:${val}%; opacity:0.8; border-top: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 5px rgba(255,255,255,0.1);"></div>`;
        });
        html += '</div>';

        container.innerHTML = html;
        container.style.border = 'none';

        // Also ensure detailed view is rendered
        if (data) this.renderDetailedView(data);
    },

    renderStorage(disks) {
        let container = document.getElementById('storage-grid');
        if (!container) {
            // Inject helper if missing
            const parent = document.getElementById('telemetry-grid-layout');
            if (parent) {
                const div = document.createElement('div');
                div.innerHTML = '<h4 style="margin-top:20px;">Storage Pools</h4><div id="storage-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;"></div>';
                parent.appendChild(div);
                container = document.getElementById('storage-grid');
            } else return;
        }

        let html = '';
        for (const [path, info] of Object.entries(disks)) {
            const usedGB = (info.used / 1e9).toFixed(1);
            const totalGB = (info.total / 1e9).toFixed(1);
            let color = 'var(--nebula-blue)';
            if (info.percent > 90) color = 'var(--danger)';
            else if (info.percent > 75) color = 'var(--warning)';

            html += `
            <div class="glass-panel" style="padding:15px; position:relative; overflow:hidden;">
                <div style="font-size:0.8rem; opacity:0.7; margin-bottom:5px;">${path}</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                    <span style="font-size:1.2rem; font-weight:700;">${info.percent}%</span>
                    <span style="font-size:0.7rem; opacity:0.5;">${usedGB} / ${totalGB} GB</span>
                </div>
                <div style="background:rgba(255,255,255,0.1); height:4px; border-radius:2px; overflow:hidden;">
                    <div style="width:${info.percent}%; background:${color}; height:100%;"></div>
                </div>
            </div>`;
        }
        container.innerHTML = html;
    },

    renderDetailedView(data) {
        // This injects the PROCESS and SERVICE sections into the "Detailed Telemetry" view
        const view = document.getElementById('view-telemetry');
        if (!view) return;

        // Find or create the grid container
        let grid = document.getElementById('telemetry-grid-layout');
        if (!grid) {
            const placeholder = view.querySelector('.glass-panel');
            if (placeholder && placeholder.innerText.includes('Real-time')) {
                placeholder.innerHTML = `
                    <div id="telemetry-chart-large" style="height:150px; width:100%; margin-bottom:20px;"></div>
                    <div id="telemetry-grid-layout" class="telemetry-grid">
                        <div>
                            <h4 style="margin-top:0;">Top Processes</h4>
                            <div class="glass-panel" style="padding:0; height:300px; overflow-y:auto;" id="proc-list">Running scan...</div>
                        </div>
                        <div>
                            <h4 style="margin-top:0;">Service Health</h4>
                            <div id="service-grid">Checking...</div>
                        </div>
                    </div>
                 `;
            }
            grid = document.getElementById('telemetry-grid-layout');
        }

        // Render Large Chart (Mirror of history)
        const largeChart = document.getElementById('telemetry-chart-large');
        if (largeChart) {
            let html = '<div style="display:flex; align-items:flex-end; height:100%; width:100%; gap:4px;">';
            this.history.forEach(val => {
                let h = val * 1.5; // Scale up
                if (h > 100) h = 100;
                let color = '#3b82f6';
                if (val > 60) color = '#eab308';
                if (val > 85) color = '#ef4444';

                html += `<div style="flex:1; background:${color}; height:${val}%; border-radius:2px 2px 0 0; opacity:0.6;"></div>`;
            });
            html += '</div>';
            largeChart.innerHTML = html;
        }

        // Render Storage
        if (data.disks) {
            this.renderStorage(data.disks);
        }
    },

    renderProcesses(procs) {
        const container = document.getElementById('proc-list');
        if (!container) return;

        let html = '<table class="proc-table">';
        html += '<thead><tr><th>PID</th><th>Name</th><th>CPU</th><th>Mem</th></tr></thead><tbody>';

        procs.forEach(p => {
            html += `<tr>
                <td style="font-family:monospace; color:#64748b;">${p.pid}</td>
                <td style="font-weight:600;">${p.name.substring(0, 18)}</td>
                <td style="color:${p.cpu_percent > 50 ? 'var(--danger)' : 'inherit'}">${(p.cpu_percent || 0).toFixed(1)}%</td>
                <td>${(p.memory_percent || 0).toFixed(1)}%</td>
             </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderServices(services) {
        const container = document.getElementById('service-grid');
        if (!container) return;

        let html = '';
        for (const [name, status] of Object.entries(services)) {
            let dot = 'active';
            if (status !== 'active') dot = 'inactive';

            html += `
            <div class="service-card">
                <div>
                    <span class="dot ${dot}"></span> <span style="font-weight:600; font-size:0.9rem;">${name}</span>
                </div>
                <div>
                    ${status === 'active' ?
                    `<button class="btn-ghost" style="font-size:0.7rem;" onclick="Sentinel.restartService('${name}')">RESTART</button>` :
                    `<span style="opacity:0.5; font-size:0.7rem;">${status.toUpperCase()}</span>`}
                </div>
            </div>`;
        }
        container.innerHTML = html;
    },

    async restartService(name) {
        if (!confirm(`Restart service ${name}?`)) return;

        // SUICIDE PACT: If functionality requires restarting the API server itself
        if (name === 'dashboard-logs') {
            if (!confirm('WARNING: Restarting the dashboard service will disconnect you briefly. The client will attempt to reconnect. Proceed?')) return;
        }

        try {
            this.nexus.log(`Sending restart command for ${name}...`);
            const res = await fetch('/api/services/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: name, action: 'restart' })
            });

            // If we restarted dashboard-logs, request might fail or hang, or succeed then close.
            if (name === 'dashboard-logs') {
                this.nexus.log('Service restarting. Initiating reconnection sequence...');
                this.handleSelfDestruct();
                return;
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this.nexus.log(`Service ${name} restarted successfully.`);
            this.fetchServices();

        } catch (e) {
            alert('Command failed: ' + e.message);
        }
    },

    handleSelfDestruct() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:var(--font-main);';
        overlay.innerHTML = `
            <div style="font-size:3rem; margin-bottom:20px; color:var(--nebula-blue); animation: spin 1s infinite linear;">↻</div>
            <h2>System Updating...</h2>
            <p>Connection lost. Attempting to regain satellite uplink.</p>
            <div id="recon-status" style="margin-top:20px; opacity:0.6; font-family:monospace;">Waiting for service...</div>
        `;
        document.body.appendChild(overlay);

        // Add spin animation
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);

        let attempts = 0;
        const check = setInterval(async () => {
            attempts++;
            document.getElementById('recon-status').innerText = `Ping attempt ${attempts}...`;
            try {
                const res = await fetch('/api/services');
                if (res.ok) {
                    clearInterval(check);
                    document.getElementById('recon-status').innerText = 'Uplink established. Reloading...';
                    setTimeout(() => window.location.reload(), 1000);
                }
            } catch (e) { /* ignore */ }

            if (attempts > 30) {
                clearInterval(check);
                document.getElementById('recon-status').innerHTML = '<span style="color:var(--danger)">Connection failed. Please manually refresh.</span>';
            }
        }, 2000);
    }
};
