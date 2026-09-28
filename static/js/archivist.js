/**
 * ARCHIVIST AGENT
 * The Keeper of Records (Client-Side).
 * Responsibilities:
 * - Tracking Active Job Status
 * - Visualizing Backup History (Real Data)
 * - Viewing Report Details
 */

const Archivist = {
    nexus: null,
    interval: null,

    boot(nexus) {
        this.nexus = nexus;
        this.nexus.log('Archivist Agent online.');
        this.injectStyles();
        this.scanOperations();

        // Load Real History
        this.refreshHistory();

        // Check active jobs every 5 seconds
        setInterval(() => this.scanOperations(), 5000);
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .arch-modal-backdrop {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
                z-index: 9999; display: flex; align-items: center; justify-content: center;
                animation: fadeIn 0.2s ease;
            }
            .arch-modal {
                background: #0f172a; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px; width: 800px; max-width: 95%; max-height: 90vh;
                display:flex; flex-direction:column;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .arch-log-viewer {
                background: #000; color: #0f0; font-family: monospace; padding: 15px;
                overflow-y: auto; flex: 1; min-height: 400px; white-space: pre-wrap;
                font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1);
            }
        `;
        document.head.appendChild(style);
    },

    async scanOperations() {
        try {
            const res = await fetch('/api/jobs/active');
            const data = await res.json();
            this.renderActiveJobs(data);
        } catch (e) {
            console.error('[ARCHIVIST] Scan failed', e);
        }
    },

    async refreshHistory() {
        const list = document.getElementById('backup-history-list');
        if (!list) return;

        try {
            // Fetch real legacy reports
            const res = await fetch('/api/reports/history');
            const history = await res.json();

            // Expected format: [{date: 'YYYY-MM-DD', status: 'ok'|'error', ...}]

            if (!Array.isArray(history) || history.length === 0) {
                list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">No archive records found.</td></tr>';
                return;
            }

            this.renderHistory(history);

        } catch (e) {
            console.error('[ARCHIVIST] History load failed', e);
            list.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">ARCHIVE ERROR: ${e.message}</td></tr>`;
        }
    },

    renderActiveJobs(jobs) {
        const container = document.getElementById('active-jobs-list');
        if (!container) return;

        container.innerHTML = '';

        if (!Array.isArray(jobs) || jobs.length === 0) {
            container.innerHTML = `
                <div style="display:flex; align-items:center; opacity:0.6; padding:10px;">
                    <div style="width:8px; height:8px; background:var(--success); border-radius:50%; margin-right:10px; box-shadow:0 0 8px var(--success);"></div>
                    <div style="font-style:italic;">All systems nominal. No active operations.</div>
                </div>`;
            return;
        }

        jobs.forEach(job => {
            const row = document.createElement('div');
            row.className = 'glass-panel animate-float';
            row.style.padding = '12px';
            row.style.marginBottom = '10px';
            row.style.borderLeft = '4px solid var(--success)';

            row.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; color:var(--starlight)">${job.key}</span>
                    <span class="status-badge status-success">ACTIVE</span>
                </div>
                <div style="margin-top:8px; font-size:0.8rem; opacity:0.8; font-family:var(--metric-font);">
                    PID: ${job.pid} | T+ ${job.duration_seconds}s
                </div>
                <div class="progress-bar" style="margin-top:8px;">
                     <div class="progress-fill" style="width: 100%; animation: pulse-width 2s infinite;"></div>
                </div>
            `;
            container.appendChild(row);
        });
    },

    renderHistory(history) {
        const list = document.getElementById('backup-history-list');
        if (!list) return;

        list.innerHTML = '';

        // Take top 10 recent
        const recent = history.slice(0, 10);

        recent.forEach(item => {
            let color = 'var(--success)';
            let status = 'SUCCESS';

            if (item.status !== 'ok' && item.status !== 'success') {
                color = 'var(--danger)';
                status = 'FAILURE';
            }

            // Date formatting
            const dateObj = new Date(item.date + 'T12:00:00'); // Assume date string YYYY-MM-DD
            const niceDate = dateObj.toLocaleDateString('pt-BR');

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            row.style.transition = 'background 0.2s';
            row.style.cursor = 'pointer';
            row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.02)';
            row.onmouseout = () => row.style.background = 'transparent';
            row.onclick = () => this.openReport(item.date);

            row.innerHTML = `
                <td style="padding:15px 10px; color:var(--nebula-blue); font-weight:700;">DAILY-${item.date.replace(/-/g, '')}</td>
                <td style="padding:15px 10px;"><span class="status-badge" style="background:${color}20; color:${color}; border:1px solid ${color}40;">${status}</span></td>
                <td style="padding:15px 10px; opacity:0.8;">24h Cycle</td>
                <td style="padding:15px 10px; opacity:0.6;">${niceDate}</td>
            `;
            list.appendChild(row);
        });
    },

    async openReport(dateStr) {
        // Create modal
        const backdrop = document.createElement('div');
        backdrop.className = 'arch-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };

        backdrop.innerHTML = `
            <div class="arch-modal">
                <div style="padding:20px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:700; font-size:1.1rem;">Mission Log: ${dateStr}</div>
                    <button onclick="this.closest('.arch-modal-backdrop').remove()" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="arch-log-viewer" id="log-content-area">Retrieving data from archive...</div>
            </div>
        `;
        document.body.appendChild(backdrop);

        try {
            // Use existing endpoint that returns HTML/Text
            // Note: professional.js used an iframe for /api/reports/view/DATE
            // We can fetch it as text if it's raw, or put in iframe.
            // Let's check if we can fetch text.
            const res = await fetch(`/api/reports/view/${dateStr}`);
            const text = await res.text();

            // Clean up if it's full HTML
            document.getElementById('log-content-area').innerHTML = text; // innerHTML allows basic styling if server sends it

        } catch (e) {
            document.getElementById('log-content-area').innerText = 'ERROR RETRIEVING LOG: ' + e.message;
        }
    }
};

function textIsEmpty(arr) {
    return !Array.isArray(arr) || arr.length === 0;
}
