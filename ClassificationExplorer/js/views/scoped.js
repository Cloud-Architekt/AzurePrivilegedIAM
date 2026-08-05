/*
 * Scope-aware (dynamic) tiering - how the same action changes plane by scope
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.views.scoped = {
    // The sanitizer in data.js turns <Token> into "«param:Token»" for *.Param.json files.
    // Definition files that are not sanitized (e.g. Defender) keep quoted "<Token>" strings,
    // so both forms are recognised here.
    PARAM_RE: /^\u00ABparam:([A-Za-z0-9_]+)\u00BB$/,
    RAW_PARAM_RE: /^<([A-Za-z0-9_]+)>$/,

    paramOf: function (arr) {
        if (!Array.isArray(arr)) return null;
        for (var i = 0; i < arr.length; i++) {
            if (typeof arr[i] === 'string') {
                var m = arr[i].match(this.PARAM_RE) || arr[i].match(this.RAW_PARAM_RE);
                if (m) return '<' + m[1] + '>';
            }
        }
        return null;
    },

    systemsWithParam: ['EntraID', 'Azure', 'DeviceManagement', 'Defender', 'IdentityGovernance'],

    tierFromReasoning: function (value) {
        var values = Array.isArray(value) ? value : [value];
        var tiers = values.map(function (item) {
            var text = String(item || '').toLowerCase();
            if (text.indexOf('tier0') !== -1 || text.indexOf('controlplane') !== -1 || text.indexOf('control plane') !== -1) return 'ControlPlane';
            if (text.indexOf('tier1') !== -1 || text.indexOf('managementplane') !== -1 || text.indexOf('management plane') !== -1) return 'ManagementPlane';
            if (text.indexOf('tier2') !== -1 || text.indexOf('useraccess') !== -1 || text.indexOf('user access') !== -1) return 'UserAccess';
            return 'Unclassified';
        });
        return EOCE.util.highestTier(tiers);
    },

    selectedReasoningPaths: function () {
        if (!EOCE.isEntraOpsMode() || EOCE.getVariant() === EOCE.VARIANT_TEMPLATE) return [];
        var tenant = EOCE.tenantByName(EOCE.getVariant());
        return tenant && Array.isArray(tenant.reasoningFiles) ? tenant.reasoningFiles : [];
    },

    normalizeReasoning: function (paths, payloads) {
        var self = this;
        var records = [];
        var byFile = {};
        paths.forEach(function (path, index) { byFile[path.split('/').pop()] = payloads[index]; });

        function rootOf(fileName) {
            var payload = byFile[fileName];
            if (Array.isArray(payload) && payload.length === 1 && payload[0] && typeof payload[0] === 'object') return payload[0];
            return payload || {};
        }

        function reasonLeaves(value, prefix, output) {
            if (value === null || value === undefined || value === '') return;
            if (Array.isArray(value)) {
                value.forEach(function (item) { reasonLeaves(item, prefix, output); });
                return;
            }
            if (typeof value === 'object') {
                Object.keys(value).forEach(function (key) { reasonLeaves(value[key], key, output); });
                return;
            }
            output.push((prefix ? prefix + ': ' : '') + String(value));
        }

        function valuesForKey(value, targetKey, output) {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(function (item) { valuesForKey(item, targetKey, output); });
                return;
            }
            Object.keys(value).forEach(function (key) {
                if (key.toLowerCase() === targetKey.toLowerCase() && value[key] !== null && value[key] !== undefined) output.push(String(value[key]));
                valuesForKey(value[key], targetKey, output);
            });
        }

        function add(system, kind, title, id, tier, source, reason, detail) {
            records.push({
                system: system,
                kind: kind,
                title: title || id || 'Unnamed scope',
                id: id || '',
                tier: self.tierFromReasoning(tier),
                source: source || '',
                reason: reason || 'No reason was persisted for this record.',
                detail: detail
            });
        }

        var azure = rootOf('ScopeReasoning_Azure.json');
        (azure.ScopeDetails || []).forEach(function (detail) {
            add('Azure', 'Azure resource scope', detail.ScopeName, detail.ScopeId, detail.EAMTier || detail.ResultingScope,
                detail.Source, detail.Reason, detail);
        });

        var defender = rootOf('ScopeReasoning_Defender.json');
        (defender.CloudSetDetails || []).forEach(function (detail) {
            add('Defender', 'Defender CloudSet', detail.CloudSetName, detail.CloudSetId, detail.ResultingScope,
                detail.ResolutionStatus, detail.Reason, detail);
        });

        var entra = rootOf('ScopeReasoning_EntraID.json');
        (entra.ScopeDetails || []).forEach(function (detail) {
            add('EntraID', detail.ScopeCategory || 'Entra scope', detail.ScopeName, Array.isArray(detail.ScopeId) ? detail.ScopeId.join(', ') : detail.ScopeId,
                'ControlPlane', detail.ScopeCategory, detail.Reason, detail);
        });

        var governance = rootOf('ScopeReasoning_IdentityGovernance.json');
        (governance.ScopeDetails || []).forEach(function (detail) {
            add('IdentityGovernance', detail.ScopeType || 'Identity Governance scope', detail.ScopeName, detail.ScopeId,
                detail.EAMTier || detail.ResultingScope, detail.Source || detail.CatalogDisplayName, detail.Reason, detail);
        });

        var memberPayload = byFile['DeviceManagement_ScopeGroupDeviceMembers.json'];
        var memberRoot = Array.isArray(memberPayload) ? memberPayload[0] : memberPayload;
        var groupMembers = memberRoot && memberRoot.groupDeviceMembers ? memberRoot.groupDeviceMembers : {};
        var device = rootOf('ScopeReasoning_DeviceManagement.json');
        (device.Groups || []).forEach(function (detail) {
            var reasons = [];
            if (detail.IncludedInScopeTagFilter) reasons.push('Matched Intune scope tag filter: ' + (detail.MatchedIntuneScopeTags || 'configured filter'));
            if (Array.isArray(detail.EAMTierLevelName) && detail.EAMTierLevelName.length) reasons.push('Group classification: ' + detail.EAMTierLevelName.join(', '));
            add('DeviceManagement', 'Intune scope group', detail.GroupName, detail.GroupId, detail.EAMTierLevelName,
                detail.IncludedInScopeTagFilter ? 'Intune scope tag filter' : 'Classified group membership', reasons.join('; '), {
                GroupReasoning: detail,
                DeviceMembers: groupMembers[detail.GroupId] || null
            });
        });

        var controlPlane = rootOf('ScopeReasoning_ControlPlane.json');
        (controlPlane.PrivilegedObjects || []).forEach(function (detail) {
            var classificationReason = detail.ClassificationReason || {};
            var reasonSystems = [];
            valuesForKey(classificationReason, 'RoleSystem', reasonSystems);
            reasonSystems = reasonSystems.filter(function (value, index, all) { return all.indexOf(value) === index; });
            var system = reasonSystems.length === 1 ? reasonSystems[0] : 'CrossRbac';
            if (!EOCE.RBAC_SYSTEMS[system]) system = 'CrossRbac';
            var reasonParts = [];
            reasonLeaves(classificationReason, '', reasonParts);
            add(system, 'Dynamically classified object', detail.ObjectDisplayName, detail.ObjectId, 'ControlPlane',
                Array.isArray(detail.ClassificationSource) ? detail.ClassificationSource.join(', ') : detail.ClassificationSource,
                reasonParts.join('; ') || 'Classified as a privileged object by the selected classification sources.', detail);
        });

        return records.sort(function (a, b) {
            var systemCompare = a.system.localeCompare(b.system);
            return systemCompare || a.title.localeCompare(b.title);
        });
    },

    renderReasoning: function (records, reasoningPaths) {
        this.reasoningRecords = records;
        var variant = EOCE.getVariant();
        var html = '<div class="section-title">Resolved tenant scope evidence</div>';

        if (variant === EOCE.VARIANT_TEMPLATE) {
            return html + '<div class="empty"><div class="big">&#9432;</div>Select a tenant-specific classification source in the app bar to inspect its resolved scope evidence.</div>';
        }
        if (!reasoningPaths.length) {
            return html + '<div class="empty"><div class="big">&#9432;</div>No scope reasoning artifacts were generated for ' + EOCE.util.escapeHtml(variant) + '.</div>';
        }

        var systems = records.map(function (record) { return record.system; }).filter(function (value, index, all) { return all.indexOf(value) === index; });
        html += '<p class="muted" style="margin:-4px 0 14px;font-size:12.5px;">Actual reasons persisted by the selected tenant classification run. Open a row to inspect the complete evidence, including nested resources, affected objects, expanded Azure paths and CloudSet subscription correlation.</p>';
        var expectedArtifacts = {
            'ScopeReasoning_Azure.json': 'Azure resource reasoning',
            'ScopeReasoning_Defender.json': 'Defender CloudSet reasoning',
            'ScopeReasoning_EntraID.json': 'Entra ID scope reasoning',
            'ScopeReasoning_IdentityGovernance.json': 'Identity Governance scope reasoning',
            'ScopeReasoning_DeviceManagement.json': 'Intune scope-group reasoning',
            'ScopeReasoning_ControlPlane.json': 'dynamic privileged-object reasoning'
        };
        var presentFiles = reasoningPaths.map(function (path) { return path.split('/').pop(); });
        var missingArtifacts = Object.keys(expectedArtifacts).filter(function (fileName) { return presentFiles.indexOf(fileName) === -1; });
        if (missingArtifacts.length) {
            html += '<div class="callout" style="margin-bottom:14px;"><div class="callout-title">Reasoning not generated</div>' +
                missingArtifacts.map(function (fileName) { return EOCE.util.escapeHtml(expectedArtifacts[fileName]); }).join(', ') +
                '. Re-run dynamic classification for the affected RBAC system to add this evidence.</div>';
        }
        html += '<div class="toolbar"><div class="search"><span class="search-ico">&#128269;</span><input id="scopeReasonSearch" type="search" placeholder="Search scopes, objects, sources and reasons" aria-label="Search resolved scope evidence"></div>';
        html += '<select class="filter" id="scopeReasonSystem" aria-label="Filter by RBAC system"><option value="all">All RBAC systems (' + records.length + ')</option>';
        systems.forEach(function (system) { html += '<option value="' + EOCE.util.escapeHtml(system) + '">' + EOCE.util.escapeHtml((EOCE.RBAC_SYSTEMS[system] || {}).short || system) + '</option>'; });
        html += '</select><span class="toolbar-meta" id="scopeReasonCount"></span></div>';
        html += '<div id="scopeReasonTable"></div>';
        return html;
    },

    updateReasoningTable: function () {
        var self = this;
        var host = document.getElementById('scopeReasonTable');
        if (!host) return;
        var search = (document.getElementById('scopeReasonSearch').value || '').toLowerCase();
        var system = document.getElementById('scopeReasonSystem').value;
        var filtered = (this.reasoningRecords || []).filter(function (record) {
            if (system !== 'all' && record.system !== system) return false;
            return !search || [record.system, record.kind, record.title, record.id, record.source, record.reason, JSON.stringify(record.detail)].join(' ').toLowerCase().indexOf(search) !== -1;
        });
        var count = document.getElementById('scopeReasonCount');
        if (count) count.textContent = filtered.length + ' of ' + (this.reasoningRecords || []).length + ' records';
        if (!filtered.length) {
            host.innerHTML = '<div class="empty">No resolved evidence matches the current filters.</div>';
            return;
        }
        var html = '<div class="table-wrap"><table class="grid-table"><thead><tr><th>RBAC system</th><th>Scope or object</th><th class="nowrap">Plane</th><th>Classification source</th><th>Reason</th></tr></thead><tbody>';
        filtered.forEach(function (record) {
            var index = self.reasoningRecords.indexOf(record);
            var systemMeta = EOCE.RBAC_SYSTEMS[record.system];
            html += '<tr data-reason-index="' + index + '" style="cursor:pointer;"><td><span class="chip brand">' + EOCE.util.escapeHtml(systemMeta ? systemMeta.short : record.system) + '</span><div class="muted" style="margin-top:5px;font-size:11px;">' + EOCE.util.escapeHtml(record.kind) + '</div></td>' +
                '<td><div class="cell-strong">' + EOCE.util.escapeHtml(record.title) + '</div><div class="cell-mono muted" style="font-size:11px;word-break:break-all;">' + EOCE.util.escapeHtml(record.id) + '</div></td>' +
                '<td>' + EOCE.util.tierBadge(record.tier, { short: true }) + '</td><td>' + EOCE.util.escapeHtml(record.source) + '</td><td>' + EOCE.util.escapeHtml(record.reason) + '</td></tr>';
        });
        host.innerHTML = html + '</tbody></table></div>';
        host.querySelectorAll('tr[data-reason-index]').forEach(function (row) {
            row.addEventListener('click', function () { self.openReasoning(self.reasoningRecords[parseInt(row.getAttribute('data-reason-index'), 10)]); });
        });
    },

    openReasoning: function (record) {
        var systemMeta = EOCE.RBAC_SYSTEMS[record.system];
        var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + EOCE.util.tierBadge(record.tier) +
            '<span class="chip brand">' + EOCE.util.escapeHtml(systemMeta ? systemMeta.short : record.system) + '</span><span class="chip">' + EOCE.util.escapeHtml(record.kind) + '</span></div>' +
            '<div class="callout scope"><div class="callout-title">Classification reason</div>' + EOCE.util.escapeHtml(record.reason) + '</div>' +
            '<dl class="kv"><dt>Scope / object ID</dt><dd class="cell-mono" style="word-break:break-all;">' + EOCE.util.escapeHtml(record.id) + '</dd><dt>Source</dt><dd>' + EOCE.util.escapeHtml(record.source) + '</dd></dl>' +
            '<div class="section-title">Complete persisted evidence</div><pre class="cell-mono" style="white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.55;">' + EOCE.util.escapeHtml(JSON.stringify(record.detail, null, 2)) + '</pre>';
        EOCE.app.openDrawer('Resolved scope evidence', EOCE.util.escapeHtml(record.title), body);
    },

    render: function (el) {
        var self = this;
        var keys = this.systemsWithParam;
        var paths = keys.map(function (k) { return EOCE.RBAC_SYSTEMS[k].param; });
        var reasoningPaths = this.selectedReasoningPaths();
        var reasoningPayloads = EOCE.isEntraOpsMode() ? Promise.all(reasoningPaths.map(EOCE.data.loadRaw)) : Promise.resolve([]);
        return Promise.all([EOCE.data.loadAll(paths), reasoningPayloads]).then(function (loaded) {
            var params = loaded[0];
            var reasoningRecords = EOCE.isEntraOpsMode() ? self.normalizeReasoning(reasoningPaths, loaded[1]) : [];
            // Collect scope-aware service entries per system.
            var bySystem = {};
            keys.forEach(function (sysKey, idx) {
                var entries = [];
                params[idx].forEach(function (tierObj) {
                    var tier = tierObj.EAMTierLevelName;
                    (tierObj.TierLevelDefinition || []).forEach(function (def) {
                        var incl = self.paramOf(def.RoleAssignmentScopeName);
                        var excl = self.paramOf(def.ExcludedRoleAssignmentScopeName);
                        if (incl) entries.push({ tier: tier, service: def.Service, placeholder: incl, mode: 'included', actions: def.RoleDefinitionActions || [] });
                        else if (excl) entries.push({ tier: tier, service: def.Service, placeholder: excl, mode: 'excluded', actions: def.RoleDefinitionActions || [] });
                    });
                });
                if (entries.length) bySystem[sysKey] = entries;
            });
            self.bySystem = bySystem;

            var html = '<div class="view">';
            html += '<div class="page-head"><h1>Scope-aware Tiering</h1>' +
                '<p>EntraOps classification is not only about <em>what</em> a role action does, but <em>where</em> it is granted. The same role action can be <strong>Control Plane</strong> when it targets privileged objects and resolve to another configured plane for a lower-impact scope. This dynamic, scope-aware tiering is expressed with scope placeholders in the EntraOps parameter (<span class="cell-mono">*.Param.json</span>) files and resolved to real scopes at runtime. Assignments outside configured Tier 0 or Tier 1 resource scopes retain their base classification; no additional subscription-scope placeholder is used.</p></div>';

            // Worked example
            html += '<div class="card" style="margin-bottom:20px;"><div class="card-head">How it works &middot; a worked example</div><div class="card-pad prose">' +
                '<p>Consider managing user authentication methods or resetting passwords. The actions are identical, but the impact depends entirely on <strong>who</strong> the target is:</p>' +
                '<div class="grid cols-2" style="margin:12px 0;">' +
                '<div class="callout control"><div class="callout-title">' + EOCE.util.tierBadge('ControlPlane') + ' &nbsp;Scoped to privileged users</div>' +
                'Granted over an administrative unit that contains <strong>privileged accounts</strong> (the <code>&lt;ScopeNamePrivilegedUsers&gt;</code> scope) &rarr; this is <strong>Control Plane</strong>. Resetting a Global Administrator\'s credentials is a tenant-takeover path.</div>' +
                '<div class="callout scope"><div class="callout-title">' + EOCE.util.tierBadge('ManagementPlane') + ' &nbsp;Scoped to everyone else</div>' +
                'The same actions granted broadly (scope <code>/</code>) but <strong>excluding</strong> the privileged scope &rarr; <strong>Management Plane</strong>. It manages standard identities without touching the security fabric.</div>' +
                '</div>' +
                '<p class="muted" style="font-size:12.5px;">EntraOps resolves the placeholders (administrative units, Azure resource scopes, or Intune group IDs) to real objects in your tenant when it runs, so the classification of an assignment is computed dynamically from its actual scope.</p>' +
                '</div></div>';

            html += '<div class="callout control" style="margin-bottom:20px;"><div class="callout-title">Conservative classification when scope is unknown</div>' +
                'Scope-aware classification requires the EntraOps parameter files to resolve assignment scopes to their target assets. If you do not use these files, for example by using <code>Update-EntraOpsClassificationControlPlaneScope</code>, EntraOps cannot apply the scope-aware distinction and more assets can be classified as <strong>Control Plane</strong>. Scope-aware classification depends on resolving the assignment scope to its target assets. When that scope cannot be determined reliably, use the more critical classification to avoid a tier breach. Treat permissions over management assets or user-access assets as <strong>Control Plane</strong> until their scope can be verified.</div>';

            if (EOCE.isEntraOpsMode()) html += self.renderReasoning(reasoningRecords, reasoningPaths);

            // Placeholder reference cards
            html += '<div class="section-title">Dynamic scope placeholders</div>';
            html += '<div class="grid cols-4" style="margin-bottom:22px;">';
            Object.keys(EOCE.SCOPE_PLACEHOLDERS).forEach(function (ph) {
                var meta = EOCE.SCOPE_PLACEHOLDERS[ph];
                var sys = EOCE.RBAC_SYSTEMS[meta.system];
                html += '<div class="stat"><span class="stat-accent" style="background:var(--tier-management)"></span>' +
                    '<div class="stat-label cell-mono" style="font-size:11px;word-break:break-all;">' + EOCE.util.escapeHtml(ph) + '</div>' +
                    '<div class="stat-value" style="font-size:18px;margin-top:6px;">' + EOCE.util.escapeHtml(meta.label) + '</div>' +
                    '<div class="stat-sub">' + EOCE.util.escapeHtml(meta.description) + '</div>' +
                    '<div class="stat-sub" style="margin-top:8px;"><span class="chip brand">' + EOCE.util.escapeHtml(sys ? sys.short : meta.system) + '</span></div></div>';
            });
            html += '</div>';

            // Per-system scope-aware services
            html += '<div class="section-title">Scope-aware services across RBAC systems</div>';
            html += '<p class="muted" style="margin:-4px 0 14px;font-size:12.5px;">Source: the EntraOps <span class="cell-mono">*.Param.json</span> definitions. Each row shows how a service shifts plane depending on whether the assignment targets the privileged / Tier 0 scope or a broad scope. Select a service to inspect the affected role actions.</p>';

            self.systemsWithParam.forEach(function (sysKey) {
                var entries = bySystem[sysKey];
                if (!entries) return;
                var sys = EOCE.RBAC_SYSTEMS[sysKey];
                var sorted = entries.slice().sort(function (a, b) {
                    if (a.placeholder !== b.placeholder) return a.placeholder < b.placeholder ? -1 : 1;
                    return EOCE.tier(a.tier).tag < EOCE.tier(b.tier).tag ? -1 : 1;
                });
                html += '<div class="card" style="margin-bottom:14px;"><div class="card-head">' +
                    EOCE.util.escapeHtml(sys.name) + '<span class="hint">' + entries.length + ' scope-aware service' + (entries.length === 1 ? '' : 's') + '</span></div>' +
                    '<div class="table-wrap" style="border:none;box-shadow:none;border-radius:0;"><table class="grid-table">' +
                    '<thead><tr><th>Service</th><th class="nowrap">Plane</th><th class="nowrap">Scope</th><th class="nowrap">Applies when</th><th class="nowrap" style="text-align:right;">Actions</th></tr></thead><tbody>';
                sorted.forEach(function (e, i) {
                    var meta = EOCE.SCOPE_PLACEHOLDERS[e.placeholder] || { label: e.placeholder };
                    var applies = e.mode === 'included'
                        ? 'Scoped <strong>to</strong> ' + EOCE.util.escapeHtml(meta.label)
                        : 'Broad scope <strong>excluding</strong> ' + EOCE.util.escapeHtml(meta.label);
                    html += '<tr data-sys="' + sysKey + '" data-i="' + i + '">' +
                        '<td class="cell-strong">' + EOCE.util.escapeHtml(e.service) + '</td>' +
                        '<td>' + EOCE.util.tierBadge(e.tier) + '</td>' +
                        '<td><span class="chip cell-mono" style="font-size:11px;">' + EOCE.util.escapeHtml(e.placeholder) + '</span></td>' +
                        '<td class="muted">' + applies + '</td>' +
                        '<td class="muted nowrap" style="text-align:right;">' + e.actions.length + ' &#8250;</td>' +
                        '</tr>';
                });
                html += '</tbody></table></div></div>';
                self['_sorted_' + sysKey] = sorted;
            });

            html += '<div class="callout" style="margin-top:18px;"><div class="callout-title">Learn more</div>' +
                'Scope-aware tiering relies on <a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.administrativeUnits + '">administrative units</a>, Azure management-group / resource scopes and Intune scope groups. See the ' +
                '<a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.entraOpsRepo + '">EntraOps project</a> for how scopes are resolved and assignments are evaluated at runtime.</div>';

            html += '</div>';
            el.innerHTML = html;

            el.querySelectorAll('tr[data-sys]').forEach(function (tr) {
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', function () {
                    var sysKey = tr.getAttribute('data-sys');
                    var e = self['_sorted_' + sysKey][parseInt(tr.getAttribute('data-i'), 10)];
                    self.openService(e, sysKey);
                });
            });
            if (EOCE.isEntraOpsMode()) {
                var reasoningSearch = document.getElementById('scopeReasonSearch');
                var reasoningSystem = document.getElementById('scopeReasonSystem');
                if (reasoningSearch && reasoningSystem) {
                    reasoningSearch.addEventListener('input', EOCE.util.debounce(function () { self.updateReasoningTable(); }, 120));
                    reasoningSystem.addEventListener('change', function () { self.updateReasoningTable(); });
                    self.updateReasoningTable();
                }
            }
        });
    },

    openService: function (e, sysKey) {
        var sys = EOCE.RBAC_SYSTEMS[sysKey];
        var meta = EOCE.SCOPE_PLACEHOLDERS[e.placeholder] || { label: e.placeholder };
        var applies = e.mode === 'included'
            ? 'This classification applies when the role is assigned <strong>to</strong> the ' + EOCE.util.escapeHtml(meta.label) + ' scope (<span class="cell-mono">' + EOCE.util.escapeHtml(e.placeholder) + '</span>).'
            : 'This classification applies when the role is assigned over a <strong>broad</strong> scope that <strong>excludes</strong> the ' + EOCE.util.escapeHtml(meta.label) + ' scope (<span class="cell-mono">' + EOCE.util.escapeHtml(e.placeholder) + '</span>).';
        var t = EOCE.tier(e.tier);
        var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + EOCE.util.tierBadge(e.tier) +
            '<span class="chip brand">' + EOCE.util.escapeHtml(sys.short) + '</span><span class="chip">' + (e.mode === 'included' ? 'Privileged / Tier scope' : 'Broad scope') + '</span></div>';
        body += '<div class="callout scope"><div class="callout-title">Scope-aware classification</div>' + applies +
            '<br><br>Plane: <strong>' + EOCE.util.escapeHtml(t.label) + '</strong> &mdash; ' + EOCE.util.escapeHtml(t.description) + '</div>';
        body += '<dl class="kv"><dt>System</dt><dd>' + EOCE.util.escapeHtml(sys.name) + '</dd>' +
            '<dt>Service</dt><dd>' + EOCE.util.escapeHtml(e.service) + '</dd>' +
            '<dt>Scope placeholder</dt><dd class="cell-mono">' + EOCE.util.escapeHtml(e.placeholder) + '</dd>' +
            '<dt>Role actions</dt><dd>' + e.actions.length + '</dd></dl>';
        body += '<div class="section-title">Affected role actions</div>';
        e.actions.forEach(function (a) {
            body += '<div class="action-row" style="border-left:3px solid ' + t.color + ';"><div class="a-name">' + EOCE.util.escapeHtml(a) + '</div>' + EOCE.util.tierBadge(e.tier, { short: true }) + '</div>';
        });
        EOCE.app.openDrawer('Scope-aware service &middot; ' + EOCE.util.escapeHtml(sys.short), EOCE.util.escapeHtml(e.service), body);
    }
};
