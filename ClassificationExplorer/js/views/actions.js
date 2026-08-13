/*
 * Role Actions explorer - unique role actions / operations and their tier
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.views.actions = {
    state: { q: '', sys: 'all', cat: 'all', plane: 'all', tiers: {}, attackPathOnly: false, learnOnly: false, sortKey: 'action', sortDir: 1 },

    render: function (el, params) {
        var self = this;
        EOCE.TIER_ORDER.forEach(function (t) { if (self.state.tiers[t] === undefined) self.state.tiers[t] = true; });
        if (params && params[0] && EOCE.RBAC_SYSTEMS[params[0]]) this.state.sys = params[0];

        var sysKeys = EOCE.rolesSystemKeys();
        var rolePaths = sysKeys.map(function (k) { return EOCE.RBAC_SYSTEMS[k].file; });
        // Microsoft Learn permissions reference (currently EntraID only) - used to mark
        // actions that exist only in the documentation and to show which documented
        // roles include an action.
        var docsCompareKeys = sysKeys.filter(function (k) { return EOCE.hasDocsCompare(k); });
        return Promise.all([
            EOCE.data.loadAll(rolePaths),
            EOCE.data.load(EOCE.RBAC_SYSTEMS.Defender.definition),
            EOCE.data.loadAll(docsCompareKeys.map(function (k) { return EOCE.DOCS_COMPARE[k].file; })),
            EOCE.loadScopeAwareActions(),
            EOCE.util.ensureAttackPaths()
        ]).then(function (res) {
            var roleSets = res[0], defenderDef = res[1], docsSets = res[2], scopeAwareActions = res[3];
            var index = {}; // key = sysKey + '|' + action
            sysKeys.forEach(function (k, i) {
                roleSets[i].forEach(function (role) {
                    EOCE.rolePerms(role).forEach(function (p) {
                        // Defensive: skip malformed permission entries with no action string
                        // (data-quality issue in the source export) instead of rendering a
                        // blank row that sorts to the top of the table.
                        if (!p.AuthorizedResourceAction) return;
                        var actionType = p.ActionType === 'DataAction' ? 'DataAction' : 'Action';
                        var key = k + '|' + actionType + '|' + p.AuthorizedResourceAction;
                        if (!index[key]) {
                            index[key] = {
                                sysKey: k,
                                action: p.AuthorizedResourceAction,
                                tier: EOCE.TIERS[p.EAMTierLevelName] ? p.EAMTierLevelName : 'Unclassified',
                                category: p.Category || '—',
                                actionType: actionType,
                                scopeAware: EOCE.roleIsScopeAware(k, [{ action: p.AuthorizedResourceAction, actionType: p.ActionType }], scopeAwareActions),
                                roles: []
                            };
                        }
                        index[key].roles.push({ id: role.RoleId, name: role.RoleName, tier: (role.Classification && role.Classification.EAMTierLevelName) || 'Unclassified' });
                    });
                });
            });

            // Defender is a definition-only system: derive role actions from its tier
            // definition (Service -> microsoft.xdr/* actions). It has no role objects,
            // so each action carries its owning services instead of roles.
            (defenderDef || []).forEach(function (tierObj) {
                var tier = EOCE.TIERS[tierObj.EAMTierLevelName] ? tierObj.EAMTierLevelName : 'Unclassified';
                (tierObj.TierLevelDefinition || []).forEach(function (def) {
                    (def.RoleDefinitionActions || []).forEach(function (action) {
                        var key = 'Defender|' + action;
                        if (!index[key]) {
                            index[key] = {
                                sysKey: 'Defender',
                                action: action,
                                tier: tier,
                                category: def.Service || '—',
                                actionType: '',
                                scopeAware: EOCE.roleIsScopeAware('Defender', [action], scopeAwareActions),
                                roles: [],
                                services: []
                            };
                        } else if (EOCE.tier(tier).tag < EOCE.tier(index[key].tier).tag) {
                            index[key].tier = tier;
                            index[key].category = def.Service || index[key].category;
                        }
                        if (def.Service && index[key].services.indexOf(def.Service) === -1) index[key].services.push(def.Service);
                    });
                });
            });

            // Microsoft Learn enrichment per docs-covered system:
            //  - docsRoles: documented roles that include the action (per the Learn reference)
            //  - docsOnly:  the action exists ONLY in the Learn reference, in no live
            //               (Microsoft Graph) role definition - included via the toolbar filter.
            docsCompareKeys.forEach(function (sysKey, di) {
                var docsRolesByAction = {};   // loweredAction -> [{ id, name, tier }]
                var docsActionMeta = {};      // loweredAction -> { action, tier, category, actionType }
                (docsSets[di] || []).forEach(function (role) {
                    if (!role || !role.RoleId) return;
                    var roleTier = (role.Classification && role.Classification.EAMTierLevelName) || 'Unclassified';
                    EOCE.rolePerms(role).forEach(function (p) {
                        var act = p.AuthorizedResourceAction;
                        if (!act) return;
                        var lk = String(act).toLowerCase();
                        if (!docsRolesByAction[lk]) docsRolesByAction[lk] = [];
                        docsRolesByAction[lk].push({ id: role.RoleId, name: role.RoleName, tier: roleTier });
                        if (!docsActionMeta[lk]) {
                            docsActionMeta[lk] = {
                                action: act,
                                tier: EOCE.TIERS[p.EAMTierLevelName] ? p.EAMTierLevelName : 'Unclassified',
                                category: p.Category || '\u2014',
                                actionType: p.ActionType || ''
                            };
                        }
                    });
                });
                // Attach Learn roles to the live (Graph-based) action entries.
                var liveActions = {};   // loweredAction -> true
                Object.keys(index).forEach(function (key) {
                    var e = index[key];
                    if (e.sysKey !== sysKey) return;
                    var lk = String(e.action).toLowerCase();
                    liveActions[lk] = true;
                    e.docsRoles = docsRolesByAction[lk] || [];
                    e.docsOnly = false;
                });
                // Add actions that exist only in the Microsoft Learn reference.
                Object.keys(docsActionMeta).forEach(function (lk) {
                    if (liveActions[lk]) return;
                    var meta = docsActionMeta[lk];
                    index[sysKey + '|learn-only|' + lk] = {
                        sysKey: sysKey,
                        action: meta.action,
                        tier: meta.tier,
                        category: meta.category,
                        actionType: meta.actionType,
                        scopeAware: EOCE.roleIsScopeAware(sysKey, [{ action: meta.action, actionType: meta.actionType }], scopeAwareActions),
                        roles: [],
                        docsRoles: docsRolesByAction[lk] || [],
                        docsOnly: true
                    };
                });
            });

            self.all = Object.keys(index).map(function (k) { return index[k]; });

            el.innerHTML =
                '<div class="view">' +
                '<div class="page-head"><h1>Role Actions</h1>' +
                '<p>Every distinct role action / resource operation and the access level it grants. This is the atomic unit of classification &mdash; roles inherit their plane from the actions they contain. Select an action to see which roles include it.</p></div>' +
                '<div id="actToolbar"></div>' +
                '<div id="actScopeNote"></div>' +
                '<div class="table-wrap"><table class="grid-table" id="actTable"></table></div>' +
                '<div class="pager" id="actPager"></div>' +
                '</div>';

            self.renderToolbar();
            self.renderTable();

            // Deep link: #actions/<sys>/<action>/<actionType> opens the action drawer.
            if (params && params[1]) {
                var wanted = decodeURIComponent(params[1]);
                var wantedType = params[2] === 'DataAction' ? 'DataAction' : null;
                var match = self.all.filter(function (a) { return a.sysKey === self.state.sys && a.action === wanted && (!wantedType || a.actionType === wantedType); })[0] ||
                    self.all.filter(function (a) { return a.action === wanted && (!wantedType || a.actionType === wantedType); })[0];
                if (match) self.openAction(match);
            }
        });
    },

    renderToolbar: function () {
        var self = this;
        var sysKeys = EOCE.orderedRbacKeys();
        var html = '<div class="toolbar">';
        html += '<div class="search"><span class="search-ico">&#128269;</span>' +
            '<input id="actSearch" type="text" placeholder="Search actions or categories (e.g. roleAssignments/write)&hellip;" value="' + EOCE.util.escapeHtml(this.state.q) + '"></div>';
        html += '<div class="seg-group" id="actSysSeg"><button class="seg' + (this.state.sys === 'all' ? ' active' : '') + '" data-sys="all">All</button>';
        sysKeys.forEach(function (k) {
            html += '<button class="seg' + (self.state.sys === k ? ' active' : '') + '" data-sys="' + k + '">' + EOCE.util.escapeHtml(EOCE.RBAC_SYSTEMS[k].short) + '</button>';
        });
        html += '</div>';
        var cats = this.categoriesFor(this.state.sys);
        if (this.state.cat !== 'all' && cats.indexOf(this.state.cat) === -1) this.state.cat = 'all';
        html += '<select class="filter" id="actCat" title="Filter by classification category"><option value="all">All categories (' + cats.length + ')</option>';
        cats.forEach(function (c) {
            html += '<option value="' + EOCE.util.escapeHtml(c) + '"' + (self.state.cat === c ? ' selected' : '') + '>' + EOCE.util.escapeHtml(c) + '</option>';
        });
        html += '</select>';
        // Azure RBAC keeps control/management plane Actions and data plane DataActions in
        // separate namespaces - only offer the split when the current system/filter actually
        // has both (avoids a pointless control for EntraID, Intune, Defender, ID Governance).
        if (this.hasPlaneSplit(this.state.sys)) {
            if (this.state.plane !== 'all' && this.state.plane !== 'action' && this.state.plane !== 'dataaction') this.state.plane = 'all';
            html += '<select class="filter" id="actPlane" title="Azure RBAC keeps control/management plane Actions and data plane DataActions in separate namespaces — matches the Actions / Data actions split shown in the Azure Portal and Microsoft Learn">' +
                '<option value="all"' + (this.state.plane === 'all' ? ' selected' : '') + '>Actions + Data actions</option>' +
                '<option value="action"' + (this.state.plane === 'action' ? ' selected' : '') + '>Actions only</option>' +
                '<option value="dataaction"' + (this.state.plane === 'dataaction' ? ' selected' : '') + '>Data actions only</option>' +
                '</select>';
        } else {
            this.state.plane = 'all';
        }
        html += '<div class="tier-toggles" id="actTierToggles">';
        ['ControlPlane', 'ManagementPlane', 'UserAccess', 'Unclassified'].forEach(function (t) {
            html += '<span class="tier-toggle tier-' + t.toLowerCase() + (self.state.tiers[t] ? ' on' : '') + '" data-tier="' + t + '"><span class="tier-dot"></span>' + EOCE.tier(t).short + '</span>';
        });
        html += '</div>';
        html += '<label class="chip" style="cursor:pointer;gap:6px;" title="Only role actions referenced in a known documented attack path"><input type="checkbox" id="actAttackPathOnly"' + (this.state.attackPathOnly ? ' checked' : '') + '> \u26A0 Attack paths exist</label>';
        if (this.state.sys === 'all' || EOCE.hasDocsCompare(this.state.sys)) {
            html += '<label class="chip" style="cursor:pointer;gap:6px;" title="Include role actions that only exist in the Microsoft Learn permissions reference and are not part of any live Microsoft Graph role definition"><input type="checkbox" id="actLearnOnly"' + (this.state.learnOnly ? ' checked' : '') + '> \u21C4 Include Microsoft Learn-only</label>';
        }
        if (this.state.sys !== 'all') html += EOCE.historyToolbarLink(this.state.sys);
        html += '<span class="toolbar-meta" id="actCount"></span></div>';
        document.getElementById('actToolbar').innerHTML = html;

        var note = document.getElementById('actScopeNote');
        if (note) note.innerHTML = this.state.sys === 'all' ? '' : EOCE.scopeAwareCallout(this.state.sys);

        document.getElementById('actSearch').addEventListener('input', EOCE.util.debounce(function (e) {
            self.state.q = e.target.value.trim(); self.renderTable();
        }, 180));
        document.getElementById('actSysSeg').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sys]'); if (!b) return;
            self.state.sys = b.getAttribute('data-sys'); self.state.cat = 'all'; self.renderToolbar(); self.renderTable();
        });
        document.getElementById('actCat').addEventListener('change', function (e) {
            self.state.cat = e.target.value; self.renderTable();
        });
        var planeSel = document.getElementById('actPlane');
        if (planeSel) {
            planeSel.addEventListener('change', function (e) {
                self.state.plane = e.target.value; self.renderTable();
            });
        }
        document.getElementById('actTierToggles').addEventListener('click', function (e) {
            var b = e.target.closest('[data-tier]'); if (!b) return;
            var t = b.getAttribute('data-tier'); self.state.tiers[t] = !self.state.tiers[t];
            b.classList.toggle('on', self.state.tiers[t]); self.renderTable();
        });
        document.getElementById('actAttackPathOnly').addEventListener('change', function (e) {
            self.state.attackPathOnly = e.target.checked; self.renderTable();
        });
        var learnOnlyToggle = document.getElementById('actLearnOnly');
        if (learnOnlyToggle) {
            learnOnlyToggle.addEventListener('change', function (e) {
                self.state.learnOnly = e.target.checked; self.renderTable();
            });
        }
    },

    // True when the given system (or, for 'all', any system) has both control/management
    // plane Actions and data plane DataActions among its role actions - see planeOf().
    hasPlaneSplit: function (sys) {
        var hasAction = false, hasDataAction = false;
        (this.all || []).forEach(function (a) {
            if (sys !== 'all' && a.sysKey !== sys) return;
            if (a.actionType === 'DataAction') hasDataAction = true; else hasAction = true;
        });
        return hasAction && hasDataAction;
    },

    categoriesFor: function (sys) {
        var set = {};
        (this.all || []).forEach(function (a) {
            if (sys !== 'all' && a.sysKey !== sys) return;
            if (a.category && a.category !== '\u2014') set[a.category] = true;
        });
        return Object.keys(set).sort(function (x, y) { return x.toLowerCase() < y.toLowerCase() ? -1 : 1; });
    },

    filtered: function () {
        var s = this.state, q = s.q.toLowerCase();
        return this.all.filter(function (a) {
            if (a.docsOnly && !s.learnOnly) return false;
            if (s.sys !== 'all' && a.sysKey !== s.sys) return false;
            if (s.cat !== 'all' && a.category !== s.cat) return false;
            if (!s.tiers[a.tier]) return false;
            if (s.plane === 'action' && a.actionType === 'DataAction') return false;
            if (s.plane === 'dataaction' && a.actionType !== 'DataAction') return false;
            if (s.attackPathOnly && !EOCE.attackIndex().byAction[a.sysKey + '|' + String(a.action || '').toLowerCase()]) return false;
            if (q && (a.action + ' ' + a.category).toLowerCase().indexOf(q) === -1) return false;
            return true;
        });
    },

    sortRows: function (rows) {
        var s = this.state, dir = s.sortDir, key = s.sortKey;
        return rows.sort(function (a, b) {
            var va, vb;
            if (key === 'tier') { va = EOCE.tier(a.tier).tag; vb = EOCE.tier(b.tier).tag; }
            else if (key === 'roles') {
                va = a.docsOnly ? (a.docsRoles || []).length : a.roles.length;
                vb = b.docsOnly ? (b.docsRoles || []).length : b.roles.length;
            }
            else if (key === 'category') { va = a.category.toLowerCase(); vb = b.category.toLowerCase(); }
            else if (key === 'sys') { va = a.sysKey; vb = b.sysKey; }
            else { va = String(a.action || '').toLowerCase(); vb = String(b.action || '').toLowerCase(); }
            if (va < vb) return -1 * dir; if (va > vb) return 1 * dir;
            return String(a.action || '').toLowerCase() < String(b.action || '').toLowerCase() ? -1 : 1;
        });
    },

    renderTable: function (keepLimit) {
        var self = this;
        var rows = this.sortRows(this.filtered());
        var s = this.state;
        if (!keepLimit) this._visibleRows = 100;
        var visibleRows = Math.min(this._visibleRows || 100, rows.length);
        var histActionSets = {}; // sysKey -> { action -> true }
        function arrow(key) { return s.sortKey === key ? '<span class="arrow">' + (s.sortDir === 1 ? '\u25B2' : '\u25BC') + '</span>' : '<span class="arrow">\u21C5</span>'; }

        var html = '<thead><tr>' +
            '<th data-sort="action">Role action' + arrow('action') + '</th>' +
            '<th data-sort="sys" class="nowrap">System' + arrow('sys') + '</th>' +
            '<th data-sort="category" class="nowrap">Category' + arrow('category') + '</th>' +
            '<th data-sort="tier" class="nowrap">Access level' + arrow('tier') + '</th>' +
            '<th data-sort="roles" class="nowrap" style="text-align:right;">Roles' + arrow('roles') + '</th>' +
            '</tr></thead><tbody>';

        if (!rows.length) {
            html += '<tr><td colspan="5"><div class="empty"><div class="big">&#128269;</div>No actions match your filters.</div></td></tr>';
        } else {
            rows.slice(0, visibleRows).forEach(function (a, idx) {
                var atkChip = EOCE.attackPathChip(EOCE.attackPathsForAction(a.sysKey, a.action).length);
                var learnChip = a.docsOnly ? ' <span class="chip docdiff" title="This role action only exists in the Microsoft Learn permissions reference - it is not part of any live Microsoft Graph role definition">Learn-only</span>' : '';
                var roleCount = a.sysKey === 'Defender' ? (a.services ? a.services.length : 0) + ' svc'
                    : (a.docsOnly ? (a.docsRoles || []).length + ' (Learn)' : a.roles.length);
                if (histActionSets[a.sysKey] === undefined) histActionSets[a.sysKey] = EOCE.historyLatestAddedActionSet(a.sysKey) || {};
                var histChip = histActionSets[a.sysKey][a.action] ? ' ' + EOCE.historyChangedChip('added') : '';
                var dataChip = a.actionType === 'DataAction' ? ' <span class="chip dataplane" title="Azure RBAC data plane operation - a separate permission namespace from control/management plane Actions">Data action</span>' : '';
                html += '<tr data-idx="' + idx + '">' +
                    '<td class="cell-mono">' + EOCE.util.highlight(EOCE.util.escapeHtml(a.action), s.q) + (EOCE.scopeAwareChip(a.sysKey, a.scopeAware) ? ' ' + EOCE.scopeAwareChip(a.sysKey, a.scopeAware) : '') + learnChip + (atkChip ? ' ' + atkChip : '') + histChip + '</td>' +
                    '<td class="muted nowrap">' + EOCE.util.escapeHtml(EOCE.RBAC_SYSTEMS[a.sysKey].short) + '</td>' +
                    '<td class="muted">' + EOCE.util.highlight(EOCE.util.escapeHtml(a.category), s.q) + dataChip + '</td>' +
                    '<td>' + EOCE.util.tierBadge(a.tier) + '</td>' +
                    '<td class="muted nowrap" style="text-align:right;">' + roleCount + '</td>' +
                    '</tr>';
            });
        }
        html += '</tbody>';
        var table = document.getElementById('actTable');
        table.innerHTML = html;

        table.querySelectorAll('thead th[data-sort]').forEach(function (th) {
            th.addEventListener('click', function () {
                var key = th.getAttribute('data-sort');
                if (s.sortKey === key) s.sortDir *= -1; else { s.sortKey = key; s.sortDir = 1; }
                self.renderTable();
            });
        });
        table.querySelectorAll('tbody tr[data-idx]').forEach(function (tr) {
            tr.addEventListener('click', function () { self.openAction(rows[parseInt(tr.getAttribute('data-idx'), 10)]); });
        });

        document.getElementById('actCount').textContent = EOCE.util.formatNumber(rows.length) + ' action' + (rows.length === 1 ? '' : 's');
        var pager = document.getElementById('actPager');
        pager.innerHTML = visibleRows < rows.length
            ? 'Showing ' + EOCE.util.formatNumber(visibleRows) + ' of ' + EOCE.util.formatNumber(rows.length) + ' actions. <button type="button" class="btn" data-show-more>Show 100 more</button>'
            : '';
        var more = pager.querySelector('[data-show-more]');
        if (more) more.addEventListener('click', function () {
            self._visibleRows = visibleRows + 100;
            self.renderTable(true);
        });
    },

    openAction: function (a) {
        var sys = EOCE.RBAC_SYSTEMS[a.sysKey];
        var t = EOCE.tier(a.tier);
        var attackPaths = EOCE.attackPathsForAction(a.sysKey, a.action);
        var docsCfg = EOCE.DOCS_COMPARE[a.sysKey];
        var docsLabel = (docsCfg && docsCfg.docsLabel) || 'Microsoft Learn';
        var body = '';
        body += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
            EOCE.util.tierBadge(a.tier) + '<span class="chip brand">' + EOCE.util.escapeHtml(sys.short) + '</span>' +
            '<span class="chip">' + EOCE.util.escapeHtml(a.category) + '</span>' +
            (a.actionType === 'DataAction' ? '<span class="chip dataplane" title="Azure RBAC data plane operation - a separate permission namespace from control/management plane Actions">Data action</span>' : (a.actionType ? '<span class="chip">' + EOCE.util.escapeHtml(a.actionType) + '</span>' : '')) +
            (a.docsOnly ? '<span class="chip docdiff" title="Only documented in the ' + EOCE.util.escapeHtml(docsLabel) + ' permissions reference">\u21C4 Learn-only</span>' : '') +
            EOCE.attackPathChip(attackPaths.length) +
            (window.EOReview ? '<button type="button" id="eoActionStar" class="eo-star" title="Add to review list">&#9734;</button>' : '') +
            '</div>';

        if (a.sysKey !== 'Defender') {
            body += '<div style="margin:0 0 14px;display:flex;gap:16px;flex-wrap:wrap;"><a class="inline-link" href="#overview/action/' +
                encodeURIComponent(a.sysKey) + '/' + encodeURIComponent(a.action) + '/' + encodeURIComponent(a.actionType || 'Action') + '">&#8862; View in EAM Map &rarr;</a>' +
                EOCE.historyItemLink(a.sysKey, a.action) + '</div>';
        }

        body += '<div class="callout ' + (a.tier === 'ControlPlane' ? 'control' : '') + '"><div class="callout-title">Why ' + EOCE.util.escapeHtml(t.label) + '?</div>' +
            'EntraOps classifies this operation under the <strong>' + EOCE.util.escapeHtml(a.category) + '</strong> service as <strong>' + EOCE.util.escapeHtml(t.label) + '</strong>. ' +
            EOCE.util.escapeHtml(t.description) + '</div>';

        if (a.docsOnly) {
            body += '<div class="callout docdiff" style="margin:14px 0;">' +
                '<div class="callout-title">\u21C4 Only in ' + EOCE.util.escapeHtml(docsLabel) + '</div>' +
                'This role action is documented in the ' + EOCE.util.escapeHtml(docsLabel) +
                ' permissions reference but is not part of any live Microsoft Graph role definition of this tenant. ' +
                'The role list below is therefore based on the ' + EOCE.util.escapeHtml(docsLabel) + ' documentation.' +
                '</div>';
        }

        if (a.scopeAware) body += EOCE.scopeAwareCallout(a.sysKey);

        body += EOCE.attackPathCallout(attackPaths);
        body += '<dl class="kv"><dt>System</dt><dd>' + EOCE.util.escapeHtml(sys.name) + '</dd>' +
            '<dt>Category / service</dt><dd>' + EOCE.util.escapeHtml(a.category) + '</dd>';

        if (a.sysKey === 'Defender') {
            var services = (a.services || []).slice().sort();
            body += '<dt>Defined in</dt><dd>' + services.length + ' service' + (services.length === 1 ? '' : 's') + '</dd></dl>';
            body += '<div class="section-title">Services granting this permission</div>';
            services.forEach(function (svc) {
                body += '<div class="action-row"><div class="cell-strong" style="font-size:13px;">' + EOCE.util.escapeHtml(svc) + '</div></div>';
            });
            body += '<div style="margin-top:16px;"><a href="' + sys.docs + '" target="_blank" rel="noopener noreferrer" class="inline-link">' + EOCE.util.escapeHtml(sys.short) + ' permissions reference &#8599;</a></div>';
            EOCE.app.openDrawer(EOCE.util.escapeHtml(sys.short) + ' permission', '<span class="cell-mono" style="font-size:16px;">' + EOCE.util.escapeHtml(a.action) + '</span>', body);
            this.bindReviewStar(a, sys);
            return;
        }

        // Docs / role definition mismatch: compare the roles carrying this action in the
        // live (EntraOps/Graph) definition against the Microsoft Learn permissions
        // reference. The Learn-based details are only shown when the two disagree -
        // matching role lists are not repeated.
        var liveRoleIds = {};
        a.roles.forEach(function (r) { liveRoleIds[r.id] = true; });
        var docsRoleIds = {};
        (a.docsRoles || []).forEach(function (r) { docsRoleIds[r.id] = true; });
        var rolesOnlyInDocs = (a.docsRoles || []).filter(function (r) { return !liveRoleIds[r.id]; });
        var rolesOnlyInLive = a.roles.filter(function (r) { return !docsRoleIds[r.id]; });
        var hasDocMismatch = !!docsCfg && (rolesOnlyInDocs.length > 0 || rolesOnlyInLive.length > 0);

        body += '<dt>Included in</dt><dd>' + a.roles.length + ' role' + (a.roles.length === 1 ? '' : 's') +
            (hasDocMismatch ? ' (live definition) / ' + a.docsRoles.length + ' role' + (a.docsRoles.length === 1 ? '' : 's') + ' (' + EOCE.util.escapeHtml(docsLabel) + ')' : '') +
            '</dd></dl>';

        if (a.roles.length) {
            var roles = a.roles.slice().sort(function (x, y) { return EOCE.tier(x.tier).tag < EOCE.tier(y.tier).tag ? -1 : 1; });
            body += '<div class="section-title">Roles including this action</div>';
            roles.forEach(function (r) {
                body += '<div class="action-row" data-role="' + EOCE.util.escapeHtml(r.id) + '" style="cursor:pointer;">' +
                    '<div class="cell-strong" style="font-size:13px;">' + EOCE.util.escapeHtml(r.name) + '</div>' +
                    EOCE.util.tierBadge(r.tier, { short: true }) + '</div>';
            });
        }

        // Only the differences are surfaced as a docs/role definition mismatch.
        if (hasDocMismatch) {
            var sortByTier = function (x, y) { return EOCE.tier(x.tier).tag < EOCE.tier(y.tier).tag ? -1 : 1; };
            body += '<div class="section-title"><span class="chip docdiff">\u21C4</span> Docs / role definition mismatch (' + EOCE.util.escapeHtml(docsLabel) + ')</div>';
            rolesOnlyInDocs.slice().sort(sortByTier).forEach(function (r) {
                body += '<div class="action-row mismatch" data-role="' + EOCE.util.escapeHtml(r.id) + '" style="cursor:pointer;border-left:3px solid #8764b8;">' +
                    '<div style="min-width:0;"><div class="cell-strong" style="font-size:13px;">' + EOCE.util.escapeHtml(r.name) + '</div>' +
                    '<div class="a-cat">Includes this action per ' + EOCE.util.escapeHtml(docsLabel) + ', but not in the live definition</div></div>' +
                    EOCE.util.tierBadge(r.tier, { short: true }) + '</div>';
            });
            rolesOnlyInLive.slice().sort(sortByTier).forEach(function (r) {
                body += '<div class="action-row mismatch" data-role="' + EOCE.util.escapeHtml(r.id) + '" style="cursor:pointer;border-left:3px solid #8764b8;">' +
                    '<div style="min-width:0;"><div class="cell-strong" style="font-size:13px;">' + EOCE.util.escapeHtml(r.name) + '</div>' +
                    '<div class="a-cat">Includes this action in the live definition, but it is not documented on ' + EOCE.util.escapeHtml(docsLabel) + '</div></div>' +
                    EOCE.util.tierBadge(r.tier, { short: true }) + '</div>';
            });
            if (docsCfg.docsUrl) {
                body += '<div style="margin-top:8px;"><a href="' + docsCfg.docsUrl + '" target="_blank" rel="noopener noreferrer" class="inline-link">' + EOCE.util.escapeHtml(docsLabel) + ' permissions reference &#8599;</a></div>';
            }
        }
        body += '<div style="margin-top:16px;"><a href="' + sys.docs + '" target="_blank" rel="noopener noreferrer" class="inline-link">' + EOCE.util.escapeHtml(sys.short) + ' permissions reference &#8599;</a></div>';

        EOCE.app.openDrawer(EOCE.util.escapeHtml(sys.short) + ' role action', '<span class="cell-mono" style="font-size:16px;">' + EOCE.util.escapeHtml(a.action) + '</span>', body);
        this.bindReviewStar(a, sys);

        document.querySelectorAll('#drawerBody [data-role]').forEach(function (node) {
            node.addEventListener('click', function () {
                EOCE.app.go('roles/' + a.sysKey + '/' + node.getAttribute('data-role'));
            });
        });
    },

    // Review list star (role action incl. its category/service scope).
    bindReviewStar: function (a, sys) {
        if (!window.EOReview) return;
        var starBtn = document.getElementById('eoActionStar');
        if (!starBtn) return;
        var reviewId = EOReview.makeId('action', a.sysKey, a.action, a.category || '');
        EOReview.updateStar(starBtn, EOReview.has(reviewId));
        starBtn.addEventListener('click', function () {
            var on = EOReview.toggle({
                id: reviewId,
                kind: 'Role action',
                system: sys.short,
                name: a.action,
                scope: a.category || '',
                tier: a.tier,
                hash: '#actions/' + encodeURIComponent(a.sysKey) + '/' + encodeURIComponent(a.action)
            });
            EOReview.updateStar(starBtn, on);
        });
    }
};
