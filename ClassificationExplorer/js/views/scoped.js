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

    systemsWithParam: ['EntraID', 'Azure', 'DeviceManagement', 'Defender'],

    render: function (el) {
        var self = this;
        var keys = this.systemsWithParam;
        var paths = keys.map(function (k) { return EOCE.RBAC_SYSTEMS[k].param; });
        return EOCE.data.loadAll(paths).then(function (params) {
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
