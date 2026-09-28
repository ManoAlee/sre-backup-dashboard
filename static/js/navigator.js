/**
 * NAVIGATOR AGENT
 * The Explorer & Commander (Client-Side).
 * Responsibilities:
 * - List Shares
 * - Create/Delete Shares
 * - Manage ACLs (Advanced)
 */

const SRE_Navigator = {
    nexus: null,
    usersCache: [],
    groupsCache: [],

    escapeHTML(str) {
        if (!str) return '';
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    },

    boot(nexus) {
        this.nexus = nexus;
        this.nexus.agents.navigator = SRE_Navigator;
        this.nexus.log('Navigator Agent online.');
        this.injectStyles();

        // Prefetch identity data for autocomplete
        this.fetchIdentities();
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .nav-modal-backdrop {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
                z-index: 9999; display: flex; align-items: center; justify-content: center;
                animation: fadeIn 0.2s ease;
            }
            .nav-modal {
                background: #0f172a; border: 1px solid rgba(255,255,255,0.2);
                border-radius: 12px; width: 600px; max-width: 95%; max-height: 90vh;
                overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.8);
                animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex; flex-direction: column;
                color: white;
            }
            .nav-btn {
                padding: 8px 16px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; font-size: 0.9rem; transition: 0.2s;
            }
            .nav-btn-primary { background: var(--nebula-blue); color: white; }
            .nav-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
            .nav-btn-danger { background: var(--danger); color: white; }
            .nav-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
            .nav-btn-ghost:hover { background: rgba(255,255,255,0.05); color: white; }
            .nav-input {
                background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                color: white; padding: 10px; border-radius: 6px; width: 100%; margin-bottom: 10px;
                outline: none;
            }
            .nav-input:focus { border-color: var(--nebula-blue); }
            
            .acl-list { margin-top: 15px; border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; }
            .acl-item {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px; background: rgba(255,255,255,0.02);
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .acl-item:last-child { border-bottom: none; }
            .acl-tag {
                font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; font-weight: 700;
            }
            
            /* Autocomplete */
            .autocomplete-suggestions {
                border: 1px solid rgba(255,255,255,0.1); background: #1e293b;
                overflow: auto; max-height: 150px; position: absolute; z-index: 10000;
                width: calc(100% - 20px); border-radius: 0 0 6px 6px;
                margin-top: -10px;
            }
            .suggestion-item { padding: 8px; cursor: pointer; color: #cbd5e1; font-size: 0.9rem; }
            .suggestion-item:hover { background: var(--nebula-blue); color: white; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; }}
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; }}
        `;
        document.head.appendChild(style);
    },

    async fetchIdentities() {
        try {
            const [uRes, gRes] = await Promise.all([
                fetch('/api/samba/users'),
                fetch('/api/samba/groups')
            ]);

            if (uRes.ok) this.usersCache = await uRes.json();
            if (gRes.ok) this.groupsCache = await gRes.json();
        } catch (e) { console.warn('Identity fetch failed', e); }
    },

    async loadFileSystem() {
        const container = document.getElementById('filesystem-browser');
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color: white;">Active Shares</h3>
                <button onclick="SRE_Navigator.openCreateModal()" class="nav-btn nav-btn-primary">+ New Share</button>
            </div>
            <div id="fs-grid-container" style="opacity:0.5; text-align:center;">Scanning sectors...</div>
        `;

        const grid = document.getElementById('fs-grid-container');

        try {
            const res = await fetch('/api/samba/shares-aggregated');
            const shares = await res.json();

            if (shares.error) {
                grid.innerHTML = `<div style="color:var(--danger); text-align:center;">SCAN FAILURE: ${shares.error}</div>`;
                return;
            }

            if (!Array.isArray(shares) || shares.length === 0) {
                grid.innerHTML = '<div style="opacity:0.5; text-align:center;">No active shares detected (Void Sector).</div>';
                grid.style.textAlign = 'left';
                grid.style.opacity = '1';
                return;
            }

            grid.innerHTML = '';
            grid.style.opacity = '1';
            grid.className = 'universe-grid';

            shares.forEach(share => {
                const userCount = (share.acls && Array.isArray(share.acls)) ? share.acls.length : (share.users || 0);
                const shareName = share.name || share.share || 'Unknown';
                let icon = 'folder-outline';
                if (shareName.toLowerCase().includes('backup')) icon = 'save-outline';
                if (shareName.toLowerCase().includes('midia')) icon = 'images-outline';

                const card = document.createElement('div');
                card.className = 'glass-panel';
                card.style = 'display:flex; justify-content:space-between; align-items:center; transition:0.2s; position:relative;';
                card.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <div style="font-size:2rem; margin-right:15px; color:var(--nebula-blue);">
                        <ion-icon name="${icon}"></ion-icon>
                    </div>
                    <div>
                        <div style="font-weight:700; font-size:1.1rem;">${this.escapeHTML(shareName)}</div>
                        <div style="opacity:0.6; font-size:0.8rem; font-family:var(--metric-font);">${this.escapeHTML(share.path)}</div>
                        <div style="margin-top:5px;">
                            <span class="status-badge ${share.guest_ok === 'Yes' ? 'status-warning' : 'status-success'}" style="font-size:0.6rem;">
                                ${share.guest_ok === 'Yes' ? 'PUBLIC' : 'SECURE'}
                            </span>
                             <span class="status-badge" style="background:rgba(255,255,255,0.1); font-size:0.6rem;">
                                ACL: ${userCount} Users
                            </span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="nav-btn nav-btn-ghost" style="padding:5px 10px;" onclick="SRE_Navigator.openManageACL('${this.escapeHTML(shareName)}', '${this.escapeHTML(share.path)}')"><ion-icon name="key-outline"></ion-icon></button>
                    <button class="nav-btn nav-btn-ghost" style="padding:5px 10px; color:var(--danger);" onclick="SRE_Navigator.openDeleteModal('${this.escapeHTML(shareName)}', '${this.escapeHTML(share.path)}')"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
                `;
                grid.appendChild(card);
            });

        } catch (e) {
            console.error('FS Scan failed', e);
            grid.innerHTML = `<div style="color:var(--danger); text-align:center;">COMMUNICATION ERROR: ${e.message}</div>`;
        }
    },

    // --- GENERIC MODAL ---
    createModal(title, contentHtml) {
        const backdrop = document.createElement('div');
        backdrop.className = 'nav-modal-backdrop';
        backdrop.onclick = (e) => {
            if (e.target === backdrop) backdrop.remove();
        };

        backdrop.innerHTML = `
            <div class="nav-modal">
                <div style="padding:20px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">${title}</h3>
                    <button onclick="this.closest('.nav-modal-backdrop').remove()" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div style="padding:20px; flex:1; overflow-y:auto; position:relative;">
                    ${contentHtml}
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        return backdrop;
    },

    // --- ACL MANAGER W/ AUTOCOMPLETE ---
    async openManageACL(share, path) {
        // Prepare Modal Content
        const content = `
            <div style="font-size:0.95rem; opacity:0.9; margin-bottom:15px; color: #cbd5e1;">
                Managing access for: <strong style="color:white; font-size: 1.1rem;">${share}</strong>
                <br><span style="font-size:0.8rem; opacity:0.6; font-family: monospace;">${path}</span>
            </div>
            
            <div style="background:rgba(255,255,255,0.08); padding:15px; border-radius:8px; border: 1px solid rgba(255,255,255,0.1);">
                <h4 style="margin-top:0; margin-bottom:12px; color: white;">Add Permission</h4>
                <div style="position:relative;">
                    <input type="text" id="acl-search" class="nav-input" style="height: 45px; font-size: 1rem;" placeholder="Search User or Group (e.g. 'john' or 'financeiro')" autocomplete="off" oninput="SRE_Navigator.handleSearch(this)">
                    <div id="acl-suggestions" class="autocomplete-suggestions" style="display:none; top: 45px;"></div>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <select id="acl-perm" class="nav-input" style="flex:1;">
                        <option value="rwx">Read & Write (Full)</option>
                        <option value="rx">Read Only</option>
                        <option value="none">Block Access</option>
                    </select>
                    <button class="nav-btn nav-btn-primary" onclick="SRE_Navigator.submitACL('${path}', '${share}')">Add</button>
                </div>
            </div>

            <div style="margin-top:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0;">Current Permissions</h4>
                    <button class="nav-btn nav-btn-ghost" style="font-size:0.7rem; padding:4px 8px;" onclick="SRE_Navigator.refreshACLList('${path}')">Refresh</button>
                </div>
                <div id="acl-loading-list" class="acl-list" style="padding:20px; text-align:center; opacity:0.6;">Loading ACLs...</div>
            </div>
        `;

        this.createModal(`Manage Access: ${share}`, content);

        // Load current ACLs
        this.refreshACLList(path);
    },

    async refreshACLList(path) {
        const container = document.getElementById('acl-loading-list');
        if (!container) return;

        container.innerHTML = '<div style="padding:10px;">Refreshing...</div>';

        try {
            const res = await fetch(`/api/samba/share-acls?path=${encodeURIComponent(path)}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            let html = '';
            // Users
            if (data.users && data.users.length > 0) {
                data.users.forEach(u => {
                    html += this.renderACLItem('user', u.name, u.perms, path);
                });
            }
            // Groups
            if (data.groups && data.groups.length > 0) {
                data.groups.forEach(g => {
                    html += this.renderACLItem('group', g.name, g.perms, path, g.members);
                });
            }

            if (!html) html = '<div style="padding:15px; text-align:center; opacity:0.5;">No explicit permissions found. Defaults apply.</div>';

            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = `<div style="padding:15px; color:var(--danger);">Failed to load ACLs: ${e.message}</div>`;
        }
    },

    renderACLItem(type, name, perms, path, members) {
        let icon = type === 'user' ? 'person' : 'people';
        let color = type === 'user' ? '#3b82f6' : '#a855f7';

        let permLabel = 'CUSTOM';
        let permColor = '#94a3b8';
        if (perms.includes('rwx')) { permLabel = 'FULL CONTROL'; permColor = 'var(--success)'; }
        else if (perms.includes('rx')) { permLabel = 'READ ONLY'; permColor = 'var(--warning)'; }
        else if (perms === '') { permLabel = 'NONE'; permColor = 'var(--danger)'; }

        let membersHtml = '';
        if (type === 'group' && members && members.length > 0) {
            membersHtml = `
                <div style="margin-top:6px; padding-left:26px; display:flex; flex-wrap:wrap; gap:4px; opacity:0.9;">
                    ${members.map(m => `<span style="font-size:0.75rem; padding:2px 6px; background:rgba(168,85,247,0.15); color:#d8b4fe; border:1px solid rgba(168,85,247,0.25); border-radius:4px; font-weight:600;">${this.escapeHTML(m.replace(/\\040/g, ' '))}</span>`).join('')}
                </div>
            `;
        }

        return `
            <div class="acl-item" style="flex-direction:column; align-items:stretch; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <ion-icon name="${icon}" style="color:${color};"></ion-icon>
                        <span style="font-weight:600;">${this.escapeHTML(name)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="acl-tag" style="background:${permColor}20; color:${permColor}; border:1px solid ${permColor}40;">${permLabel}</span>
                        <button class="nav-btn nav-btn-ghost" style="padding:4px;" title="Remove" onclick="SRE_Navigator.removeACL('${path}', '${type}:${name}')">
                            <ion-icon name="close-circle" style="color:var(--danger);"></ion-icon>
                        </button>
                    </div>
                </div>
                ${membersHtml}
            </div>
        `;
    },

    handleSearch(input) {
        const val = input.value.toLowerCase();
        const sugg = document.getElementById('acl-suggestions');
        if (!val || val.length < 2) {
            sugg.style.display = 'none';
            return;
        }

        const matches = [];
        // Search users
        this.usersCache.forEach(u => {
            if (u.toLowerCase().includes(val)) matches.push({ type: 'User', val: u });
        });
        // Search groups
        this.groupsCache.forEach(g => {
            if (g.toLowerCase().includes(val)) matches.push({ type: 'Group', val: g });
        });

        if (matches.length === 0) {
            sugg.style.display = 'none';
            return;
        }

        sugg.innerHTML = matches.slice(0, 10).map(m => `
            <div class="suggestion-item" onclick="SRE_Navigator.selectSuggestion('${m.type === 'User' ? 'u' : 'g'}:${this.escapeHTML(m.val)}')">
                <span style="opacity:0.5; font-size:0.7rem; margin-right:5px;">[${m.type}]</span> ${this.escapeHTML(m.val)}
            </div>
        `).join('');
        sugg.style.display = 'block';
    },

    selectSuggestion(val) {
        document.getElementById('acl-search').value = val;
        document.getElementById('acl-suggestions').style.display = 'none';
    },

    async _performACLUpdate(path, entity, permission) {
        const res = await fetch('/api/samba/acl/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, entity, permission, recursive: true })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    },

    async submitACL(path, share) {
        const entityRaw = document.getElementById('acl-search').value;
        const perm = document.getElementById('acl-perm').value;
        const btn = document.querySelector('.nav-btn-primary');

        if (!entityRaw) { alert('Please select a user or group.'); return; }

        // Simple parsing if user typed manually without selecting suggestion
        let entity = entityRaw;
        if (!entity.includes(':')) {
            // Heuristic: try to find in cache to guess type, default to 'u'
            if (this.groupsCache.includes(entity)) entity = 'g:' + entity;
            else entity = 'u:' + entity;
        }

        btn.disabled = true;
        btn.innerText = 'Applying...';

        try {
            await this._performACLUpdate(path, entity, perm);

            // Success
            btn.disabled = false;
            btn.innerText = 'Add';
            document.getElementById('acl-search').value = '';

            // Refresh list
            this.refreshACLList(path);

        } catch (e) {
            alert('Failed to apply: ' + e.message);
            btn.disabled = false;
            btn.innerText = 'Add';
        }
    },

    async removeACL(path, entity) {
        if (!confirm(`Are you sure you want to REMOVE permissions for ${entity}?\n\nThis will remove the user/group from the ACL list.`)) return;

        try {
            const res = await fetch('/api/samba/acl/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, entity, recursive: true })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this.nexus.log(`Permissions removed for ${entity}`);
            this.refreshACLList(path);
        } catch (e) {
            alert('Failed to remove permissions: ' + e.message);
        }
    },

    // --- OTHER MODALS (Create/Delete) ---
    openCreateModal() {
        const content = `
            <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Share Name</label>
            <input type="text" id="new-share-name" class="nav-input" placeholder="e.g. Financeiro">
            
            <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Environment (Storage Pool)</label>
            <select id="new-share-env" class="nav-input" style="background:rgba(0,0,0,0.5);">
                <option value="/dados">/dados (Standard)</option>
                <option value="/dados-ext">/dados-ext (Extended)</option>
                <option value="/dados-ext-II">/dados-ext-II (Archive)</option>
            </select>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                <button class="nav-btn nav-btn-ghost" onclick="document.querySelector('.nav-modal-backdrop').remove()">Cancel</button>
                <button class="nav-btn nav-btn-primary" onclick="Navigator.submitCreate()">Create Share</button>
            </div>
            <div id="create-error" style="color:var(--danger); font-size:0.9rem; margin-top:10px;"></div>
        `;
        this.createModal('Create Storage Share', content);
    },

    async submitCreate() {
        const name = document.getElementById('new-share-name').value;
        const env = document.getElementById('new-share-env').value;
        const btn = document.querySelector('.nav-btn-primary');
        const err = document.getElementById('create-error');

        if (!name) { err.innerText = 'Name is required.'; return; }

        btn.innerText = 'Creating...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/samba/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, environment: env })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            document.querySelector('.nav-modal-backdrop').remove();
            this.nexus.log(`Share ${name} created successfully.`);
            this.loadFileSystem();

        } catch (e) {
            err.innerText = e.message;
            btn.innerText = 'Create Share';
            btn.disabled = false;
        }
    },

    openDeleteModal(name, path) {
        const content = `
            <p>Are you sure you want to delete the share <strong>${name}</strong>?</p>
            <p style="font-family:monospace; opacity:0.7;">Path: ${path}</p>
            
            <div style="margin:20px 0; padding:15px; background:rgba(255,0,0,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:6px;">
                 <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="destroy-files">
                    <span style="color:var(--danger); font-weight:bold;">DESTROY ALL FILES on disk</span>
                 </label>
                 <div style="font-size:0.8rem; opacity:0.8; margin-top:5px;">Warning: This action is irreversible.</div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="nav-btn nav-btn-ghost" onclick="document.querySelector('.nav-modal-backdrop').remove()">Cancel</button>
                <button class="nav-btn nav-btn-danger" onclick="SRE_Navigator.submitDelete('${name}', '${path}')">Delete Share</button>
            </div>
            <div id="delete-error" style="color:var(--danger); font-size:0.9rem; margin-top:10px;"></div>
        `;
        this.createModal('Confirm Deletion', content);
    },

    async submitDelete(name, path) {
        const destroy = document.getElementById('destroy-files').checked;
        const btn = document.querySelector('.nav-btn-danger');
        const err = document.getElementById('delete-error');

        btn.innerText = 'Deleting...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/samba/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, path, destroy_files: destroy })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            document.querySelector('.nav-modal-backdrop').remove();
            this.nexus.log(`Share ${name} deleted.`);
            this.loadFileSystem();

        } catch (e) {
            err.innerText = e.message;
            btn.innerText = 'Delete Share';
            btn.disabled = false;
        }
    },

    async renderAccessTopology(search = '', filter = 'all', mode = 'topo') {
        const topoContainer = document.getElementById('topology-canvas-container');
        const cardsContainer = document.getElementById('identity-cards-container');
        if (!topoContainer || !cardsContainer) return;

        topoContainer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-blue-400 font-mono text-[10px] animate-pulse">SINTONIZANDO UNIVERSO DE IDENTIDADES...</div>';
        
        // Forensic Fix: Small delay to ensure Flexbox has settled dimensions
        setTimeout(async () => {
            try {
                const res = await fetch('/api/samba/access-map');
                const data = await res.json();

                const { clusteredData, shareList } = this.processDataScale(data, search, filter);

                if (Object.keys(clusteredData).length === 0) {
                    topoContainer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-slate-500 text-xs text-center p-8">Nenhum acesso encontrado para estes critérios.</div>';
                    cardsContainer.innerHTML = '';
                    return;
                }

                if (mode === 'matrix') {
                    this.renderAccessMatrix(topoContainer, clusteredData, shareList);
                } else {
                    this.drawRadialTopology(topoContainer, clusteredData);
                }

                this.renderCards(cardsContainer, clusteredData);
            } catch (e) {
                console.error('Core Logic Error:', e);
                topoContainer.innerHTML = `<div class="p-4 text-red-500 text-xs">Erro Crítico: ${e.message}</div>`;
            }
        }, 150);
    },

    getHumanPerm(perm) {
        if (!perm) return '';
        const p = perm.toLowerCase();
        if (p === 'rwx') return 'Controle Total';
        if (p === 'rw') return 'Escrita e Leitura';
        if (p === 'r' || p === 'rx' || p === 'r-x') return 'Apenas Leitura';
        return perm.toUpperCase();
    },

    processDataScale(data, search, filter) {
        const shareSet = new Set();
        const profiles = {}; 

        Object.entries(data).forEach(([entity, userShares]) => {
            const [type, name] = entity.split(':');
            const matchesFilter = filter === 'all' || type === filter;
            const matchesSearch = !search || name.toLowerCase().includes(search.toLowerCase());
            
            if (matchesFilter && matchesSearch) {
                const signature = userShares.map(s => `${s.share}:${s.perm}`).sort().join('||');
                if (!profiles[signature]) {
                    profiles[signature] = {
                        members: [],
                        shares: userShares,
                        type: type
                    };
                }
                profiles[signature].members.push(name);
                userShares.forEach(s => shareSet.add(s.share));
            }
        });

        const clusteredData = {};
        Object.entries(profiles).forEach(([sig, prof]) => {
            const label = prof.members.length === 1 ? `user:${prof.members[0]}` : `profile:Perfil com ${prof.members.length} identidades (${prof.members[0]}...)`;
            clusteredData[label] = prof.shares;
            clusteredData[label]._meta = { members: prof.members, type: prof.type };
        });

        return { clusteredData, shareList: Array.from(shareSet).sort() };
    },

    renderAccessMatrix(container, data, shareList) {
        const html = `
            <div class="absolute inset-0 overflow-auto bg-slate-100 p-6">
                <table class="min-w-full border-separate border-spacing-0 bg-white rounded-2xl shadow-xl border border-slate-200" style="font-size: 9px;">
                    <thead class="sticky top-0 z-10 bg-slate-50">
                        <tr>
                            <th class="p-4 border-b border-r bg-slate-50 text-left sticky left-0 z-20 font-black text-slate-400">IDENTIDADE / PASTA</th>
                            ${shareList.map(s => `<th class="p-2 border-b text-center align-bottom border-r border-slate-100"><div style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 0 auto;" class="font-bold text-slate-600">${s.toUpperCase()}</div></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data).map(([id, shares]) => {
                            const meta = data[id]._meta;
                            const isCluster = id.startsWith('profile');
                            return `
                                <tr class="hover:bg-blue-50/50 transition-colors">
                                    <td class="p-3 border-b border-r font-bold text-slate-700 sticky left-0 bg-white z-0 shadow-sm">
                                        <div class="flex items-center gap-2">
                                            <span class="w-2 h-2 rounded-full ${isCluster ? 'bg-amber-500' : (meta.type.includes('user') ? 'bg-emerald-500' : 'bg-blue-500')}"></span>
                                            ${(id.split(':')[1] || id).replace(/\\040/g, ' ')}
                                        </div>
                                    </td>
                                    ${shareList.map(s => {
                                        const shareObj = shares.find(us => us.share === s);
                                        const perm = shareObj ? shareObj.perm : '';
                                        const color = perm === 'rwx' ? 'bg-emerald-500' : perm.includes('w') ? 'bg-blue-500' : 'bg-slate-200';
                                        return `
                                            <td class="p-1 border-b border-r border-slate-50 text-center">
                                                ${perm ? `
                                                    <div class="group relative inline-block">
                                                        <div class="w-3 h-3 mx-auto rounded-full ${color} shadow-sm cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all active:scale-90" 
                                                             onClick="SRE_Navigator.openPermissionEditor(\'${id}\', \'${s}\', \'${perm}\')"
                                                             title="Clique para gerenciar acesso: ${this.getHumanPerm(perm)}"></div>
                                                    </div>` : `
                                                    <div class="w-3 h-3 mx-auto rounded-full bg-slate-50 border border-dashed border-slate-200 cursor-pointer hover:bg-emerald-50 transition-colors"
                                                         onClick="SRE_Navigator.openPermissionEditor(\'${id}\', \'${s}\', \'\')"
                                                         title="Adicionar acesso"></div>
                                                `}
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
        container.style.background = '#f8fafc';
    },

    drawRadialTopology(container, data) {
        const identities = Object.keys(data);
        const shares = Array.from(new Set(Object.values(data).flat().map(s => s.share))).sort();
        
        // Use SVG viewBox coordinate system for absolute reliability
        const width = 1000;
        const height = 1000;
        const cx = 500;
        const cy = 500;
        
        if (!this.viewState || (this.viewState.x === 0 && this.viewState.y === 0)) {
            this.viewState = { x: 0, y: 0, scale: 0.95 };
        }

        const svgContent = `
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" id="topo-svg" style="cursor:grab; background:#ffffff; width:100%; height:100%;">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <linearGradient id="linkGradActive" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="100%" stop-color="#3b82f6" />
                    </linearGradient>
                    <style>
                        @keyframes topo-flow {
                            to {
                                stroke-dashoffset: -20;
                            }
                        }
                        .topo-link-active {
                            stroke: url(#linkGradActive) !important;
                            stroke-width: 2.2px !important;
                            stroke-dasharray: 6, 4;
                            animation: topo-flow 1s linear infinite;
                            filter: url(#glow);
                            opacity: 1 !important;
                        }
                    </style>
                </defs>
                <rect x="0" y="0" width="1000" height="1000" fill="transparent" />
                <g id="main-scene" transform="translate(${cx + this.viewState.x}, ${cy + this.viewState.y}) scale(${this.viewState.scale})">
                    <g id="links-layer"></g>
                    <g id="nodes-layer"></g>
                </g>
            </svg>
            <div id="topo-legend" class="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 text-[9px] text-slate-600 space-y-1 shadow-xl">
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Usuário Individual</div>
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Grupo Samba</div>
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Perfil Agrupado</div>
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span> Pasta Compartilhada</div>
            </div>
            <div id="narrative-box" class="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-xl hidden animate-bounce">
                Passe o mouse ou clique em um nó para auditar.
            </div>
        `;
        container.innerHTML = svgContent;
        container.style.background = '#ffffff';
        
        const scene = container.querySelector('#main-scene');
        const linksLayer = scene.querySelector('#links-layer');
        const nodesLayer = scene.querySelector('#nodes-layer');

        // Bipartite vertical layout math centered around 0
        const totalHeight = 840;
        const spacingId = identities.length > 1 ? totalHeight / (identities.length - 1) : 0;
        const spacingShare = shares.length > 1 ? totalHeight / (shares.length - 1) : 0;
        const startY = -totalHeight / 2;

        const identPos = {};
        const sharePos = {};

        identities.forEach((id, i) => {
            const y = startY + (identities.length > 1 ? i * spacingId : 0);
            identPos[id] = { x: -180, y: y };
        });

        shares.forEach((s, j) => {
            const y = startY + (shares.length > 1 ? j * spacingShare : 0);
            sharePos[s] = { x: 180, y: y };
        });

        // 1. Draw Bipartite Connections (Bezier Curves)
        identities.forEach(id => {
            const source = identPos[id];
            const isCluster = id.startsWith('profile');
            const userShares = data[id];
            
            userShares.forEach(s => {
                const target = sharePos[s.share];
                if (target && source) {
                    const ctrlX1 = source.x + 120;
                    const ctrlY1 = source.y;
                    const ctrlX2 = target.x - 120;
                    const ctrlY2 = target.y;
                    
                    linksLayer.innerHTML += `
                        <path d="M ${source.x} ${source.y} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${target.x} ${target.y}" 
                              stroke="#cbd5e1" stroke-width="1.2" fill="none" class="topo-link" 
                              data-ident="${id}" data-share="${s.share}" opacity="0.35" style="transition: all 0.25s ease;" />
                    `;
                }
            });
        });

        // 2. Draw Identity Nodes (Left Column)
        identities.forEach((id, i) => {
            const pos = identPos[id];
            const isCluster = id.startsWith('profile');
            const type = id.split(':')[0];
            const name = (id.split(':')[1] || id).replace(/\\040/g, ' ');

            let color = '#10b981'; // Individual
            let icon = '👤';
            if (type === 'group') {
                color = '#3b82f6'; // Group
                icon = '👥';
            } else if (isCluster) {
                color = '#f59e0b'; // Profile cluster
                icon = '🧬';
            }

            nodesLayer.innerHTML += `
                <g class="node-group ident-node" data-id="${id}" style="cursor:pointer; transition: opacity 0.2s ease;"
                   onmouseenter="SRE_Navigator.focusNode(\'${id}\', false, document.getElementById('topology-canvas-container'))"
                   onmouseleave="SRE_Navigator.resetHighlight(document.getElementById('topology-canvas-container'))">
                    <!-- Base Pill Box -->
                    <rect x="-380" y="${pos.y - 16}" width="200" height="32" rx="8" fill="#ffffff" stroke="${color}90" stroke-width="1.5" />
                    <!-- Left Accent Bar -->
                    <path d="M -380 ${pos.y - 8} A 8 8 0 0 1 -372 ${pos.y - 16} L -372 ${pos.y + 16} A 8 8 0 0 1 -380 ${pos.y + 8} Z" fill="${color}" />
                    <!-- Icon Character -->
                    <text x="-360" y="${pos.y + 5}" fill="${color}" style="font-size:12px; font-family:sans-serif; pointer-events:none;">${icon}</text>
                    <!-- Text Label -->
                    <text x="-340" y="${pos.y + 4}" fill="#1e293b" style="font-size:9px; font-weight:700; font-family:sans-serif; pointer-events:none;">${name}</text>
                </g>
            `;
        });

        // 3. Draw Share Nodes (Right Column)
        shares.forEach((s, j) => {
            const pos = sharePos[s];
            const color = '#38bdf8'; // Sky blue

            nodesLayer.innerHTML += `
                <g class="node-group share-node" data-id="${s}" style="cursor:pointer; transition: opacity 0.2s ease;"
                   onmouseenter="SRE_Navigator.focusNode(\'${s}\', true, document.getElementById('topology-canvas-container'))"
                   onmouseleave="SRE_Navigator.resetHighlight(document.getElementById('topology-canvas-container'))">
                    <!-- Base Pill Box -->
                    <rect x="180" y="${pos.y - 16}" width="200" height="32" rx="8" fill="#ffffff" stroke="${color}90" stroke-width="1.5" />
                    <!-- Right Accent Bar -->
                    <path d="M 372 ${pos.y - 16} A 8 8 0 0 1 380 ${pos.y - 8} L 380 ${pos.y + 8} A 8 8 0 0 1 372 ${pos.y + 16} Z" fill="${color}" />
                    <!-- Icon Character -->
                    <text x="195" y="${pos.y + 5}" fill="${color}" style="font-size:12px; font-family:sans-serif; pointer-events:none;">📁</text>
                    <!-- Text Label -->
                    <text x="218" y="${pos.y + 4}" fill="#1e293b" style="font-size:9px; font-weight:800; font-family:monospace; pointer-events:none;">${s.toUpperCase()}</text>
                </g>
            `;
        });

        this.bindTopologyEvents(container.querySelector('#topo-svg'), container);
    },

    bindTopologyEvents(svg, container) {
        const scene = svg.querySelector('#main-scene');
        let isDragging = false;
        let startPoint = { x: 0, y: 0 };

        svg.onmousedown = (e) => {
            if (e.target.closest('.node-group')) return;
            isDragging = true;
            svg.style.cursor = 'grabbing';
            startPoint = { x: e.clientX - this.viewState.x, y: e.clientY - this.viewState.y };
        };

        window.onmousemove = (e) => {
            if (!isDragging) return;
            this.viewState.x = e.clientX - startPoint.x;
            this.viewState.y = e.clientY - startPoint.y;
            scene.setAttribute('transform', `translate(${svg.clientWidth / 2 + this.viewState.x}, ${svg.clientHeight / 2 + this.viewState.y}) scale(${this.viewState.scale})`);
        };

        window.onmouseup = () => {
            isDragging = false;
            svg.style.cursor = 'grab';
        };

        svg.onwheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.viewState.scale = Math.min(Math.max(this.viewState.scale * delta, 0.05), 5);
            scene.setAttribute('transform', `translate(${svg.clientWidth / 2 + this.viewState.x}, ${svg.clientHeight / 2 + this.viewState.y}) scale(${this.viewState.scale})`);
        };

        svg.querySelectorAll('.node-group').forEach(group => {
            group.onclick = (e) => {
                e.stopPropagation();
                const id = group.getAttribute('data-id');
                const isShare = group.classList.contains('share-node');
                this.focusNode(id, isShare, container);
            };
        });

        svg.onclick = (e) => {
            if (e.target === svg || e.target.tagName === 'rect') this.resetHighlight(container);
        };
    },

    focusNode(id, isShare, container) {
        const links = document.querySelectorAll('.topo-link');
        const nodes = document.querySelectorAll('.node-group');
        const narrative = container.querySelector('#narrative-box');

        let count = 0;
        links.forEach(l => {
            const matches = isShare ? l.getAttribute('data-share') === id : l.getAttribute('data-ident') === id;
            if (matches) {
                l.classList.add('topo-link-active');
                count++;
            } else {
                l.classList.remove('topo-link-active');
                l.setAttribute('opacity', '0.05');
            }
        });

        nodes.forEach(n => {
            const nodeId = n.getAttribute('data-id');
            const isRelated = Array.from(links).some(l => 
                l.classList.contains('topo-link-active') && (l.getAttribute('data-ident') === nodeId || l.getAttribute('data-share') === nodeId)
            );
            const active = nodeId === id || isRelated;
            n.style.opacity = active ? '1' : '0.15';
        });

        if (narrative) {
            narrative.classList.remove('hidden');
            const name = (id.split(':')[1] || id).replace(/\\040/g, ' ');
            narrative.innerText = isShare ? `Pasta [${name.toUpperCase()}]: Conectada a ${count} identidades.` : `Identidade [${name}]: Possui acesso a ${count} pastas da rede.`;
        }
    },

    resetHighlight(container) {
        document.querySelectorAll('.topo-link').forEach(l => {
            l.classList.remove('topo-link-active');
            l.setAttribute('opacity', '0.25');
        });
        document.querySelectorAll('.node-group').forEach(n => {
            n.style.opacity = '1';
        });
        const narrative = container.querySelector('#narrative-box');
        if (narrative) narrative.classList.add('hidden');
        this.closeEditor();
    },

    openPermissionEditor(entityId, shareName, currentPerm) {
        this.closeEditor();
        const [type, rawName] = entityId.split(':');
        const name = (rawName || '').replace(/\\040/g, ' ');
        const isCluster = entityId.startsWith('profile');
        
        const editor = document.createElement('div');
        editor.id = 'perm-editor-popover';
        editor.className = 'fixed z-[200] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-64 animate-slide-up';
        
        // Position relative to click or fixed center for clusters
        editor.style.top = '50%';
        editor.style.left = '50%';
        editor.style.transform = 'translate(-50%, -50%)';

        editor.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h5 class="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Gerenciar Acesso</h5>
                <button onclick="SRE_Navigator.closeEditor()" class="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div class="mb-4">
                <div class="text-[9px] text-slate-400 font-bold mb-1">IDENTIDADE</div>
                <div class="text-[10px] font-black text-blue-900 truncate">${name}</div>
                <div class="text-[9px] text-slate-400 font-bold mt-2 mb-1">PASTA</div>
                <div class="text-[10px] font-black text-emerald-700 truncate">${shareName}</div>
            </div>
            <div class="space-y-1">
                <button onclick="SRE_Navigator.applyPermission(\'${entityId}\', \'${shareName}\', \'rwx\')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center gap-2 group transition-colors">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-[9px] font-bold text-slate-700">Controle Total</span>
                </button>
                <button onclick="SRE_Navigator.applyPermission(\'${entityId}\', \'${shareName}\', \'rw\')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 flex items-center gap-2 group transition-colors">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span class="text-[9px] font-bold text-slate-700">Escrita e Leitura</span>
                </button>
                <button onclick="SRE_Navigator.applyPermission(\'${entityId}\', \'${shareName}\', \'rx\')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 group transition-colors">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span class="text-[9px] font-bold text-slate-700">Apenas Leitura</span>
                </button>
                ${currentPerm ? `
                <div class="my-2 border-t border-slate-100"></div>
                <button onclick="SRE_Navigator.removePermission(\'${entityId}\', \'${shareName}\')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 flex items-center gap-2 group transition-colors">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                    <span class="text-[9px] font-bold text-red-600">Revogar Acesso</span>
                </button>
                ` : ''}
            </div>
            ${isCluster ? `<div class="mt-3 p-2 bg-amber-50 rounded-lg text-[8px] text-amber-700 leading-tight">⚠️ ATENÇÃO: Esta ação afetará ${entityId.split('(')[0].split(' ')[2]} identidades simultaneamente.</div>` : ''}
        `;
        document.body.appendChild(editor);
    },

    closeEditor() {
        const existing = document.getElementById('perm-editor-popover');
        if (existing) existing.remove();
    },

    async applyPermission(entityId, shareName, perm) {
        const [type, name] = entityId.split(':');
        const isCluster = entityId.startsWith('profile');
        const meta = this._lastDataClustered?.[entityId]?._meta;
        const entities = isCluster ? meta.members : [name];
        const entityFull = isCluster ? `${meta.type}:${entities[0]}` : entityId; // Simplified for bulk API later, now individual or first
        
        // If cluster, we iterate (Basic version, optimization: add batch API)
        this.closeEditor();
        this.showToast('Aplicando permissões...', 'info');

        try {
            for (const ent of entities) {
                const entityString = `${meta?.type || type}:${ent}`;
                const res = await fetch('/api/samba/acl/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: shareName, entity: entityString, permission: perm, recursive: true })
                });
                if (!res.ok) throw new Error(`Falha ao aplicar em ${ent}`);
            }
            this.showToast('Permissões aplicadas com sucesso!', 'success');
            // Trigger refresh
            if (window.SRE_RELOAD) window.SRE_RELOAD();
        } catch (e) {
            this.showToast(`Erro: ${e.message}`, 'error');
        }
    },

    async removePermission(entityId, shareName) {
        if (!confirm('Deseja realmente revogar este acesso? Esta ação é imediata.')) return;
        
        const [type, name] = entityId.split(':');
        const isCluster = entityId.startsWith('profile');
        const meta = this._lastDataClustered?.[entityId]?._meta;
        const entities = isCluster ? meta.members : [name];

        this.closeEditor();
        this.showToast('Revogando acessos...', 'warning');

        try {
            for (const ent of entities) {
                const entityString = `${meta?.type || type}:${ent}`;
                const res = await fetch('/api/samba/acl/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: shareName, entity: entityString, recursive: true })
                });
                if (!res.ok) throw new Error(`Falha ao revogar em ${ent}`);
            }
            this.showToast('Acessos revogados com sucesso!', 'success');
            if (window.SRE_RELOAD) window.SRE_RELOAD();
        } catch (e) {
            this.showToast(`Erro: ${e.message}`, 'error');
        }
    },

    showToast(msg, type = 'info') {
        let toast = document.getElementById('sre-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sre-toast';
            toast.className = 'fixed bottom-6 right-6 z-[300] px-6 py-3 rounded-2xl shadow-2xl transition-all font-bold text-xs flex items-center gap-3 animate-slide-up';
            document.body.appendChild(toast);
        }
        
        const colors = {
            success: 'bg-emerald-600 text-white border-emerald-400',
            error: 'bg-red-600 text-white border-red-400',
            warning: 'bg-amber-500 text-white border-amber-300',
            info: 'bg-blue-600 text-white border-blue-400'
        };
        
        toast.className = `fixed bottom-6 right-6 z-[300] px-6 py-3 rounded-2xl shadow-2xl transition-all font-bold text-xs flex items-center gap-3 animate-slide-up border ${colors[type]}`;
        toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚡'}</span> ${msg}`;
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 4000);
    },

    getPermStyle(perm) {
        if (!perm) return 'bg-slate-100 text-slate-600 border-slate-200';
        const p = perm.toLowerCase();
        if (p === 'rwx') return 'bg-red-50 text-red-700 border-red-200';
        if (p === 'rw') return 'bg-blue-50 text-blue-700 border-blue-200';
        return 'bg-slate-50 text-slate-600 border-slate-200';
    },

    renderCards(container, data) {
        this._lastDataClustered = data; // Cache for the editor
        container.innerHTML = '';
        Object.entries(data).forEach(([entity, userShares]) => {
            const [type, name] = entity.split(':');
            const isCluster = entity.startsWith('profile');
            const card = document.createElement('div');
            card.className = `glass-card hover:scale-[1.01] transition-all group border-t-4 ${isCluster ? 'border-amber-500' : (type === 'group' ? 'border-blue-500' : 'border-emerald-500')} p-0 flex flex-col cursor-default`;
            
            card.onmouseenter = () => this.focusNode(entity, false, document.getElementById('topology-canvas-container'));
            card.onmouseleave = () => this.resetHighlight(document.getElementById('topology-canvas-container'));

            const membersList = isCluster && data[entity]._meta?.members ? `
                <div class="mb-3 px-2 py-1.5 bg-amber-50/50 rounded-lg border border-amber-100/50">
                    <div class="text-[7px] font-black text-amber-800 uppercase tracking-wider mb-1">Membros do Perfil:</div>
                    <div class="flex flex-wrap gap-1 max-h-[55px] overflow-y-auto custom-scroll pr-1">
                        ${data[entity]._meta.members.map(m => `
                            <span class="px-1.5 py-0.5 bg-amber-100/70 text-amber-850 rounded text-[7px] font-bold border border-amber-200/60">${m.replace(/\\040/g, ' ')}</span>
                        `).join('')}
                    </div>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="p-4 flex-1">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl ${isCluster ? 'bg-amber-100 text-amber-700' : (type === 'group' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700')} flex items-center justify-center font-black text-sm">
                            ${isCluster ? '🧬' : name.charAt(0).toUpperCase()}
                        </div>
                        <div class="overflow-hidden">
                            <h4 class="text-[10px] font-bold text-slate-900 truncate uppercase">${(isCluster ? name : name).replace(/\\040/g, ' ')}</h4>
                            <div class="flex items-center gap-1">
                                <span class="text-[8px] uppercase text-slate-400 font-bold">${isCluster ? `Perfil de Acesso (${data[entity]._meta.members.length} membros)` : (type === 'group' ? 'Grupo do AD' : 'Usuário SRE')}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${membersList}

                    <div class="space-y-1 max-h-[150px] overflow-y-auto custom-scroll">
                        ${userShares.slice(0, 15).map(s => `
                            <div class="flex justify-between items-center px-2 py-1 bg-slate-50/80 rounded border border-slate-100 text-[8px] hover:bg-blue-50 transition-colors cursor-pointer group/item"
                                 onClick="SRE_Navigator.openPermissionEditor(\'${entity}\', \'${s.share}\', \'${s.perm}\')">
                                <span class="font-black text-slate-600 truncate">${s.share}</span>
                                <span class="px-1.5 py-0.5 rounded-sm font-black tracking-tighter text-[7px] border transition-all ${this.getPermStyle(s.perm)}">${this.getHumanPerm(s.perm)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
};

