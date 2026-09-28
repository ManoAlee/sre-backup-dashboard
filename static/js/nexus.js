/**
 * NEXUS AGENT
 * The Central Nervous System (Client-Side).
 * Responsibilities:
 * - Bootstrapping the Universe
 * - Managing Lifecycle of other Agents
 * - Handling User Interaction Events
 * - CLIENT-SIDE ROUTING (Navigation)
 */

const Nexus = {
    config: {
        refreshRate: 1000,
        debug: true
    },

    agents: {},

    init() {
        this.log('Initializing Universe...');

        // Register Sub-Agents
        this.agents.sentinel = Sentinel;
        this.agents.archivist = Archivist;
        this.agents.navigator = SRE_Navigator;

        // Boot Agents
        this.agents.sentinel.boot(this);
        this.agents.archivist.boot(this);
        this.agents.navigator.boot(this);

        this.log('Universe Online.');
        this.bindEvents();

        // Default View
        this.navigate('dashboard');
    },

    bindEvents() {
        // Navigation Click Handlers
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = item.getAttribute('data-view');
                this.navigate(viewName);
            });
        });

        // Global visual effects
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.log('User away - slowing down telemetry.');
                this.agents.sentinel.setLowPowerMode(true);
            } else {
                this.log('User returned - engaging full power.');
                this.agents.sentinel.setLowPowerMode(false);
            }
        });

        // Fetch initial server logs
        this.fetchServerLogs();
    },

    async fetchServerLogs() {
        try {
            const res = await fetch('/api/logs?lines=5');
            if (res.ok) {
                const logs = await res.json();
                if (Array.isArray(logs)) {
                    logs.reverse().forEach(l => this.log(`[SRV] ${l}`));
                }
            }
        } catch (e) { /* silent fail */ }
    },

    navigate(viewName) {
        this.log(`Navigating to sector: ${viewName}`);

        // Update Sidebar UI
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Update Main Viewport
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewName}`) || document.getElementById(viewName);
        if (targetView) {
            targetView.classList.add('active');
            this.handleViewEnter(viewName);
        } else {
            // Silence warning for 'dashboard' or 'root' as they are handled by React
            if (viewName !== 'dashboard' && viewName !== 'root') {
                this.log(`Sector ${viewName} managed by external Universe.`);
            }
        }
    },

    handleViewEnter(viewName) {
        // Trigger generic data refresh for specific views
        if (viewName === 'filesystem') {
            this.agents.navigator.loadFileSystem();
        }
        if (viewName === 'backups') {
            // Future hook for backup history refresh
            if (this.agents.archivist.refreshHistory) {
                this.agents.archivist.refreshHistory();
            }
        }
    },

    log(msg) {
        if (this.config.debug) {
            console.log(`%c[NEXUS]`, 'color: #4cc9f0; font-weight: bold;', msg);
        }
    }
};

// Auto-boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Nexus.init();
    // Default View adjustment for React compatibility
    if (Nexus.navigate) Nexus.navigate('root');
});
