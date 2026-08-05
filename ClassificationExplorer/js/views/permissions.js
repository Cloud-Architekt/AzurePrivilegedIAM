/*
 * API Permissions explorer - AppRoles, Scopes & 1st-party API permissions
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.KNOWN_APPS = {
    '00000003-0000-0000-c000-000000000000': 'Microsoft Graph',
    '00000002-0000-0000-c000-000000000000': 'Azure AD Graph',
    '00000003-0000-0ff1-ce00-000000000000': 'SharePoint Online',
    '00000002-0000-0ff1-ce00-000000000000': 'Office 365 Exchange Online',
    '00000005-0000-0ff1-ce00-000000000000': 'Office 365 Yammer',
    'c5393580-f805-4401-95e8-94b7a6ef2fc2': 'Office 365 Management APIs',
    'fc780465-2017-40d4-a0c5-307022471b92': 'WindowsDefenderATP'
};

EOCE.views.permissions = {
    state: { q: '', tiers: {}, type: 'all', app: 'all', sortKey: 'value', sortDir: 1 },

    render: function (el, params) {
        var self = this;
        EOCE.TIER_ORDER.forEach(function (t) { if (self.state.tiers[t] === undefined) self.state.tiers[t] = true; });
        if (params && params[0]) {
            var typeMap = { roles: 'Application', scopes: 'Delegated', application: 'Application', delegated: 'Delegated' };
            var mapped = typeMap[String(params[0]).toLowerCase()];
            if (mapped) this.state.type = mapped;
        }
        // Deep link from an attack-path permission chip: #permissions/<type>/<value>
        // prefills the search so the referenced permission is easy to spot.
        if (params && params[1]) this.state.q = params[1];

        var keys = Object.keys(EOCE.PERMISSION_SETS);
        var paths = keys.map(function (k) { return EOCE.PERMISSION_SETS[k].file; });
        return EOCE.data.loadAll(paths).then(function (sets) {
            var all = [];
            keys.forEach(function (k, i) {
                var def = EOCE.PERMISSION_SETS[k];
                sets[i].forEach(function (p) {
                    var appId = p[def.appField];
                    var appName = (def.appField === 'TargetAppDisplayName') ? appId : (EOCE.KNOWN_APPS[appId] || appId);
                    all.push({
                        setKey: k,
                        id: p[def.idField],
                        value: p[def.valueField],
                        type: def.typeField ? p[def.typeField] : def.typeValue,
                        app: appName,
                        appId: (def.appField === 'TargetAppDisplayName') ? p.TargetAppId : appId,
                        category: p.Category || '—',
                        tier: EOCE.TIERS[p.EAMTierLevelName] ? p.EAMTierLevelName : 'Unclassified'
                    });
                });
            });
            self.all = all;

            el.innerHTML =
                '<div class="view">' +
                '<div class="page-head"><h1>API Permissions</h1>' +
                '<p>Classified OAuth2 application permissions (AppRoles), delegated permissions (Scopes) and first-party Microsoft API permissions. Use these to estimate the privilege level of an app role assignment or consent grant. Select a permission for details.</p></div>' +
                '<div id="permToolbar"></div>' +
                '<div class="table-wrap"><table class="grid-table" id="permTable"></table></div>' +
                '<div class="pager" id="permPager"></div>' +
                '</div>';

            self.renderToolbar();
            self.renderTable();
            if (params && params[2]) {
                var match = all.filter(function (permission) { return permission.id === params[2]; })[0];
                if (match) self.openPerm(match);
            }
        });
    },

    apps: function () {
        var s = this.state;
        var seen = {};
        this.all.forEach(function (p) {
            if (s.type !== 'all' && p.type !== s.type) return;
            seen[p.app] = true;
        });
        return Object.keys(seen).sort();
    },

    renderToolbar: function () {
        var self = this;
        var html = '<div class="toolbar">';
        html += '<div class="search"><span class="search-ico">&#128269;</span>' +
            '<input id="permSearch" type="text" placeholder="Search permissions (e.g. Directory.ReadWrite.All)&hellip;" value="' + EOCE.util.escapeHtml(this.state.q) + '"></div>';
        var typeSeg = [['all', 'All'], ['Application', 'Roles'], ['Delegated', 'Scopes']];
        html += '<div class="seg-group" id="permTypeSeg">';
        typeSeg.forEach(function (o) {
            html += '<button class="seg' + (self.state.type === o[0] ? ' active' : '') + '" data-type="' + o[0] + '">' + o[1] + '</button>';
        });
        html += '</div>';
        var apps = this.apps();
        html += '<select class="filter" id="permApp"><option value="all">All apps (' + apps.length + ')</option>';
        apps.forEach(function (a) { html += '<option value="' + EOCE.util.escapeHtml(a) + '"' + (self.state.app === a ? ' selected' : '') + '>' + EOCE.util.escapeHtml(a) + '</option>'; });
        html += '</select>';
        html += '<div class="tier-toggles" id="permTierToggles">';
        ['ControlPlane', 'ManagementPlane', 'UserAccess', 'Unclassified'].forEach(function (t) {
            html += '<span class="tier-toggle tier-' + t.toLowerCase() + (self.state.tiers[t] ? ' on' : '') + '" data-tier="' + t + '"><span class="tier-dot"></span>' + EOCE.tier(t).short + '</span>';
        });
        html += '</div><span class="toolbar-meta" id="permCount"></span></div>';
        var histLink = EOCE.historyToolbarLink('ApiPermissions');
        if (histLink) html = html.replace('<span class="toolbar-meta"', histLink + '<span class="toolbar-meta"');
        document.getElementById('permToolbar').innerHTML = html;

        document.getElementById('permSearch').addEventListener('input', EOCE.util.debounce(function (e) {
            self.state.q = e.target.value.trim(); self.renderTable();
        }, 180));
        document.getElementById('permTypeSeg').addEventListener('click', function (e) {
            var b = e.target.closest('[data-type]'); if (!b) return;
            self.state.type = b.getAttribute('data-type'); self.state.app = 'all'; self.renderToolbar(); self.renderTable();
        });
        document.getElementById('permApp').addEventListener('change', function (e) { self.state.app = e.target.value; self.renderTable(); });
        document.getElementById('permTierToggles').addEventListener('click', function (e) {
            var b = e.target.closest('[data-tier]'); if (!b) return;
            var t = b.getAttribute('data-tier'); self.state.tiers[t] = !self.state.tiers[t];
            b.classList.toggle('on', self.state.tiers[t]); self.renderTable();
        });
    },

    filtered: function () {
        var s = this.state, q = s.q.toLowerCase();
        var seen = {};
        return this.all.filter(function (p) {
            if (!s.tiers[p.tier]) return false;
            if (s.type !== 'all' && p.type !== s.type) return false;
            if (s.app !== 'all' && p.app !== s.app) return false;
            if (q && (p.value + ' ' + p.category + ' ' + p.app).toLowerCase().indexOf(q) === -1) return false;
            // Defensive de-duplication on (value|type|app|category).
            var dk = (p.value || '') + '|' + (p.type || '') + '|' + (p.appId || p.app || '') + '|' + p.category;
            if (seen[dk]) return false;
            seen[dk] = true;
            return true;
        });
    },

    sortRows: function (rows) {
        var s = this.state, dir = s.sortDir, key = s.sortKey;
        return rows.sort(function (a, b) {
            var va, vb;
            if (key === 'tier') { va = EOCE.tier(a.tier).tag; vb = EOCE.tier(b.tier).tag; }
            else if (key === 'app') { va = (a.app || '').toLowerCase(); vb = (b.app || '').toLowerCase(); }
            else if (key === 'category') { va = a.category.toLowerCase(); vb = b.category.toLowerCase(); }
            else if (key === 'type') { va = a.type || ''; vb = b.type || ''; }
            else { va = (a.value || '').toLowerCase(); vb = (b.value || '').toLowerCase(); }
            if (va < vb) return -1 * dir; if (va > vb) return 1 * dir;
            return (a.value || '').toLowerCase() < (b.value || '').toLowerCase() ? -1 : 1;
        });
    },

    renderTable: function () {
        var self = this;
        var rows = this.sortRows(this.filtered());
        var s = this.state;
        var histStatus = EOCE.historyLatestItemStatus('ApiPermissions') || {};
        function arrow(key) { return s.sortKey === key ? '<span class="arrow">' + (s.sortDir === 1 ? '\u25B2' : '\u25BC') + '</span>' : '<span class="arrow">\u21C5</span>'; }

        var html = '<thead><tr>' +
            '<th data-sort="value">Permission' + arrow('value') + '</th>' +
            '<th data-sort="type" class="nowrap">Type' + arrow('type') + '</th>' +
            '<th data-sort="app" class="nowrap">Resource app' + arrow('app') + '</th>' +
            '<th data-sort="category" class="nowrap">Category' + arrow('category') + '</th>' +
            '<th data-sort="tier" class="nowrap">Access level' + arrow('tier') + '</th>' +
            '</tr></thead><tbody>';

        if (!rows.length) {
            html += '<tr><td colspan="5"><div class="empty"><div class="big">&#128269;</div>No permissions match your filters.</div></td></tr>';
        } else {
            rows.slice(0, 500).forEach(function (p, idx) {
                var histChip = p.id && histStatus[p.id] ? ' ' + EOCE.historyChangedChip(histStatus[p.id]) : '';
                var atkChip = EOCE.attackPathChip(EOCE.attackPathsForPermission(p).length);
                html += '<tr data-idx="' + idx + '">' +
                    '<td class="cell-mono">' + EOCE.util.highlight(EOCE.util.escapeHtml(p.value), s.q) + (atkChip ? ' ' + atkChip : '') + histChip + '</td>' +
                    '<td class="muted nowrap">' + EOCE.util.escapeHtml(p.type || '—') + '</td>' +
                    '<td class="muted">' + EOCE.util.highlight(EOCE.util.escapeHtml(p.app || '—'), s.q) + '</td>' +
                    '<td class="muted">' + EOCE.util.highlight(EOCE.util.escapeHtml(p.category), s.q) + '</td>' +
                    '<td>' + EOCE.util.tierBadge(p.tier) + '</td>' +
                    '</tr>';
            });
        }
        html += '</tbody>';
        var table = document.getElementById('permTable');
        table.innerHTML = html;

        table.querySelectorAll('thead th[data-sort]').forEach(function (th) {
            th.addEventListener('click', function () {
                var key = th.getAttribute('data-sort');
                if (s.sortKey === key) s.sortDir *= -1; else { s.sortKey = key; s.sortDir = 1; }
                self.renderTable();
            });
        });
        table.querySelectorAll('tbody tr[data-idx]').forEach(function (tr) {
            tr.addEventListener('click', function () { self.openPerm(rows[parseInt(tr.getAttribute('data-idx'), 10)]); });
        });

        document.getElementById('permCount').textContent = EOCE.util.formatNumber(rows.length) + ' permission' + (rows.length === 1 ? '' : 's');
        document.getElementById('permPager').innerHTML = rows.length > 500 ? 'Showing first 500 of ' + EOCE.util.formatNumber(rows.length) + ' &mdash; refine your search.' : '';
    },

    openPerm: function (p) {
        var set = EOCE.PERMISSION_SETS[p.setKey];
        var t = EOCE.tier(p.tier);
        var attackPaths = EOCE.attackPathsForPermission(p);
        var body = '';
        body += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
            EOCE.util.tierBadge(p.tier) + '<span class="chip brand">' + EOCE.util.escapeHtml(p.type || set.short) + '</span>' +
            '<span class="chip">' + EOCE.util.escapeHtml(p.category) + '</span>' +
            EOCE.attackPathChip(attackPaths.length) +
            ((window.EOReview && !EOCE.isEntraOpsMode()) ? '<button type="button" id="eoPermStar" class="eo-star" title="Add to review list">&#9734;</button>' : '') +
            '</div>';
        body += EOCE.attackPathCallout(attackPaths);
        body += '<div class="callout ' + (p.tier === 'ControlPlane' ? 'control' : '') + '"><div class="callout-title">Why ' + EOCE.util.escapeHtml(t.label) + '?</div>' +
            'This permission is grouped under <strong>' + EOCE.util.escapeHtml(p.category) + '</strong> and classified as <strong>' + EOCE.util.escapeHtml(t.label) + '</strong>. ' +
            EOCE.util.escapeHtml(t.description) + '</div>';
        body += '<dl class="kv">' +
            '<dt>Resource app</dt><dd>' + EOCE.util.escapeHtml(p.app || '—') + '</dd>' +
            (p.appId ? '<dt>App ID</dt><dd class="cell-mono">' + EOCE.util.escapeHtml(p.appId) + '</dd>' : '') +
            '<dt>Permission type</dt><dd>' + EOCE.util.escapeHtml(p.type || '—') + '</dd>' +
            '<dt>Permission ID</dt><dd class="cell-mono">' + EOCE.util.escapeHtml(p.id || '—') + '</dd>' +
            '<dt>Category</dt><dd>' + EOCE.util.escapeHtml(p.category) + '</dd>' +
            '<dt>Catalog</dt><dd>' + EOCE.util.escapeHtml(set.name) + '</dd>' +
            '</dl>';
        var histLink = EOCE.historyItemLink(p.setKey, p.value);
        if (histLink) body += '<div style="margin:0 0 8px;">' + histLink + '</div>';
        body += '<div style="margin-top:16px;"><a href="' + set.docs + '" target="_blank" rel="noopener noreferrer" class="inline-link">Microsoft Graph permissions reference &#8599;</a></div>';
        EOCE.app.openDrawer(EOCE.util.escapeHtml(set.short) + (p.type ? ' &middot; ' + EOCE.util.escapeHtml(p.type) : ''),
            '<span class="cell-mono" style="font-size:16px;">' + EOCE.util.escapeHtml(p.value) + '</span>', body);

        if (window.EOReview && !EOCE.isEntraOpsMode()) {
            var starBtn = document.getElementById('eoPermStar');
            if (starBtn) {
                var reviewId = EOReview.makeId('permission', p.setKey, p.value, p.appId || p.app || '');
                EOReview.updateStar(starBtn, EOReview.has(reviewId));
                starBtn.addEventListener('click', function () {
                    var on = EOReview.toggle({
                        id: reviewId,
                        kind: 'Permission',
                        system: p.app || set.short,
                        name: p.value,
                        scope: p.category || '',
                        tier: p.tier,
                        hash: '#permissions/' + encodeURIComponent(p.type === 'Delegated' ? 'scopes' : 'roles')
                    });
                    EOReview.updateStar(starBtn, on);
                });
            }
        }
    }
};
