/*
 * Shared chart/aggregate helpers + Overview & Enterprise Access Model views
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.charts = (function () {
    function emptyDist() {
        return { ControlPlane: 0, ManagementPlane: 0, UserAccess: 0, Unclassified: 0, total: 0 };
    }
    function addToDist(dist, tierName) {
        var key = EOCE.TIERS[tierName] ? tierName : 'Unclassified';
        dist[key]++;
        dist.total++;
    }

    function distBar(dist) {
        var html = '<div class="dist-bar">';
        EOCE.TIER_ORDER.forEach(function (k) {
            var n = dist[k] || 0;
            if (!n) return;
            var pct = dist.total ? (n / dist.total) * 100 : 0;
            html += '<div class="dist-seg tier-' + k.toLowerCase() + '" style="width:' + pct.toFixed(2) + '%" title="' +
                EOCE.tier(k).label + ': ' + n + '"></div>';
        });
        html += '</div>';
        return html;
    }

    function distLegend(dist) {
        var html = '<div class="dist-legend">';
        EOCE.TIER_ORDER.forEach(function (k) {
            var n = dist[k] || 0;
            var t = EOCE.tier(k);
            var pct = dist.total ? Math.round((n / dist.total) * 100) : 0;
            html += '<span class="li"><span class="sw" style="background:' + t.color + '"></span>' +
                EOCE.util.escapeHtml(t.label) + ' &middot; <strong>' + EOCE.util.formatNumber(n) + '</strong> (' + pct + '%)</span>';
        });
        html += '</div>';
        return html;
    }

    // Horizontal labelled bars from [{label, value, color}]
    function barList(rows, max) {
        max = max || rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0) || 1;
        var html = '<div class="bars">';
        rows.forEach(function (r) {
            var pct = (r.value / max) * 100;
            html += '<div class="bar-row"><div class="muted" title="' + EOCE.util.escapeHtml(r.label) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                EOCE.util.escapeHtml(r.label) + '</div>' +
                '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + (r.color || 'var(--brand)') + '"></div></div>' +
                '<div class="bar-val">' + EOCE.util.formatNumber(r.value) + '</div></div>';
        });
        html += '</div>';
        return html;
    }

    return { emptyDist: emptyDist, addToDist: addToDist, distBar: distBar, distLegend: distLegend, barList: barList };
})();

EOCE.views.overview = {
    render: function (el) {
        var rolePaths = EOCE.rolesSystemKeys().map(function (k) { return EOCE.RBAC_SYSTEMS[k].file; });
        var permPaths = Object.keys(EOCE.PERMISSION_SETS).map(function (k) { return EOCE.PERMISSION_SETS[k].file; });
        return Promise.all([
            EOCE.data.loadAll(rolePaths),
            EOCE.data.loadAll(permPaths),
            EOCE.data.load(EOCE.OVERWRITES_FILE),
            EOCE.data.load(EOCE.RBAC_SYSTEMS.Defender.definition)
        ]).then(function (res) {
            var roleSets = res[0], permSets = res[1], overwrites = res[2], defenderDef = res[3];
            var sysKeys = EOCE.rolesSystemKeys();
            var permKeys = Object.keys(EOCE.PERMISSION_SETS);

            var totalRoles = 0, totalActions = 0, totalPriv = 0;
            var globalRoleDist = EOCE.charts.emptyDist();
            var globalActionDist = EOCE.charts.emptyDist();

            var sysStats = sysKeys.map(function (k, i) {
                var sys = EOCE.RBAC_SYSTEMS[k];
                var data = roleSets[i];
                var roleDist = EOCE.charts.emptyDist();
                var actionDist = EOCE.charts.emptyDist();
                var priv = 0;
                data.forEach(function (r) {
                    var cls = (r.Classification && r.Classification.EAMTierLevelName) || 'Unclassified';
                    EOCE.charts.addToDist(roleDist, cls);
                    EOCE.charts.addToDist(globalRoleDist, cls);
                    if (r.isPrivileged === true) priv++;
                    EOCE.rolePerms(r).forEach(function (p) {
                        EOCE.charts.addToDist(actionDist, p.EAMTierLevelName);
                        EOCE.charts.addToDist(globalActionDist, p.EAMTierLevelName);
                    });
                });
                totalRoles += data.length;
                totalActions += actionDist.total;
                totalPriv += priv;
                return { sys: sys, count: data.length, priv: priv, roleDist: roleDist, actionDist: actionDist };
            });

            // Defender (definition-only system): derive a per-action tier distribution.
            var defActionTier = {};
            var defServices = {};
            (defenderDef || []).forEach(function (tierObj) {
                var tier = tierObj.EAMTierLevelName || 'Unclassified';
                (tierObj.TierLevelDefinition || []).forEach(function (def) {
                    if (def.Service) defServices[def.Service] = true;
                    (def.RoleDefinitionActions || []).forEach(function (action) {
                        var cur = defActionTier[action];
                        if (!cur || EOCE.tier(tier).tag < EOCE.tier(cur).tag) defActionTier[action] = tier;
                    });
                });
            });
            var defenderDist = EOCE.charts.emptyDist();
            Object.keys(defActionTier).forEach(function (a) { EOCE.charts.addToDist(defenderDist, defActionTier[a]); });
            var defenderServiceCount = Object.keys(defServices).length;

            var totalPerms = 0;
            var permDist = EOCE.charts.emptyDist();
            var permStats = permKeys.map(function (k, i) {
                var set = EOCE.PERMISSION_SETS[k];
                var data = permSets[i];
                var dist = EOCE.charts.emptyDist();
                data.forEach(function (p) { EOCE.charts.addToDist(dist, p.EAMTierLevelName); });
                totalPerms += data.length;
                EOCE.TIER_ORDER.forEach(function (t) { permDist[t] += dist[t]; });
                permDist.total += dist.total;
                return { set: set, count: data.length, dist: dist };
            });

            var html = '<div class="view">';
            html += '<div class="page-head"><h1>Classification Overview</h1>' +
                '<p>A holistic, scope-aware view of how Microsoft Entra ID, Azure and Intune roles, role actions and API permissions are classified against the ' +
                '<a href="' + EOCE.DOCS.enterpriseAccessModel + '" target="_blank" rel="noopener noreferrer">Enterprise Access Model</a> by ' +
                '<a href="' + EOCE.DOCS.entraOpsRepo + '" target="_blank" rel="noopener noreferrer">EntraOps</a>. ' +
                'Every classification answers one question: <em>could this access control the security and identity fabric, manage a workload, or just read?</em></p></div>';

            // Stat tiles
            html += '<div class="grid cols-4" style="margin-bottom:20px;">';
            html += stat('Classified roles', EOCE.util.formatNumber(totalRoles), sysKeys.length + ' RBAC role systems', 'var(--brand)');
            html += stat('Classified role actions', EOCE.util.formatNumber(totalActions), 'Permission operations', 'var(--tier-management)');
            html += stat('Classified API permissions', EOCE.util.formatNumber(totalPerms), 'AppRoles, Scopes & 1st-party APIs', 'var(--tier-user)');
            html += stat('Control Plane footprint', EOCE.util.formatNumber(globalRoleDist.ControlPlane), 'Tier 0 classified roles', 'var(--tier-control)');
            html += '</div>';

            // EAM distribution
            html += '<div class="grid cols-2" style="margin-bottom:20px;">';
            html += '<div class="card"><div class="card-head">Role classification by access level<span class="hint">' + EOCE.util.formatNumber(globalRoleDist.total) + ' roles</span></div>' +
                '<div class="card-pad">' + EOCE.charts.distBar(globalRoleDist) + EOCE.charts.distLegend(globalRoleDist) +
                '<p class="muted" style="margin:14px 0 0;font-size:12.5px;">Each role takes the <strong>highest-privilege</strong> tier among its role actions (single-classification), reflecting its real blast radius.</p></div></div>';
            html += '<div class="card"><div class="card-head">Role action classification<span class="hint">' + EOCE.util.formatNumber(globalActionDist.total) + ' actions</span></div>' +
                '<div class="card-pad">' + EOCE.charts.distBar(globalActionDist) + EOCE.charts.distLegend(globalActionDist) +
                '<p class="muted" style="margin:14px 0 0;font-size:12.5px;">Individual operations are classified independently &mdash; a single role often spans all three planes.</p></div></div>';
            html += '</div>';

            // Per-system cards
            html += '<div class="section-title">RBAC systems</div>';
            html += '<div class="grid cols-3" style="margin-bottom:20px;">';
            sysStats.forEach(function (s) {
                html += '<div class="card" style="cursor:pointer;" data-goto="roles/' + s.sys.key + '">' +
                    '<div class="card-head">' + EOCE.util.escapeHtml(s.sys.short) +
                    '<span class="hint">' + EOCE.util.formatNumber(s.count) + ' roles</span></div>' +
                    '<div class="card-pad">' +
                    '<p class="muted" style="margin:0 0 12px;font-size:12.5px;min-height:34px;">' + EOCE.util.escapeHtml(s.sys.description) + '</p>' +
                    EOCE.charts.distBar(s.roleDist) +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
                    tierMini('ControlPlane', s.roleDist.ControlPlane) +
                    tierMini('ManagementPlane', s.roleDist.ManagementPlane) +
                    tierMini('UserAccess', s.roleDist.UserAccess) +
                    (s.priv ? '<span class="chip priv">' + s.priv + ' privileged</span>' : '') +
                    '</div></div></div>';
            });
            // Defender (definition-only): classified role actions, no per-role export.
            html += '<div class="card" style="cursor:pointer;" data-goto="actions/Defender">' +
                '<div class="card-head">' + EOCE.util.escapeHtml(EOCE.RBAC_SYSTEMS.Defender.short) +
                '<span class="hint">' + EOCE.util.formatNumber(defenderDist.total) + ' role actions</span></div>' +
                '<div class="card-pad">' +
                '<p class="muted" style="margin:0 0 12px;font-size:12.5px;min-height:34px;">' + EOCE.util.escapeHtml(EOCE.RBAC_SYSTEMS.Defender.description) + '</p>' +
                EOCE.charts.distBar(defenderDist) +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
                tierMini('ControlPlane', defenderDist.ControlPlane) +
                tierMini('ManagementPlane', defenderDist.ManagementPlane) +
                tierMini('UserAccess', defenderDist.UserAccess) +
                (defenderServiceCount ? '<span class="chip brand">' + defenderServiceCount + ' services</span>' : '') +
                '</div></div></div>';
            html += '</div>';

            // Permission catalogs + overwrites
            html += '<div class="grid cols-2">';
            html += '<div class="card"><div class="card-head">API permission catalogs<span class="hint">' + EOCE.util.formatNumber(totalPerms) + ' permissions</span></div><div class="card-pad">';
            permStats.forEach(function (p) {
                html += '<div style="margin-bottom:14px;cursor:pointer;" data-goto="permissions/' + p.set.key + '">' +
                    '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;"><strong>' +
                    EOCE.util.escapeHtml(p.set.short) + '</strong><span class="muted">' + EOCE.util.formatNumber(p.count) + '</span></div>' +
                    EOCE.charts.distBar(p.dist) + '</div>';
            });
            html += '</div></div>';

            html += '<div class="card"><div class="card-head">Classification logic highlights</div><div class="card-pad prose">' +
                '<p><strong>Scope-aware tiering.</strong> The same role action can be Control Plane or Management Plane depending on <em>where</em> it is granted. EntraOps resolves this dynamically using scope placeholders.</p>' +
                '<p><a href="#scoped">Explore scope-aware tiering &#8594;</a></p>' +
                '<p style="margin-top:16px;"><strong>Role definition overwrites.</strong> ' + EOCE.util.formatNumber(overwrites.length) + ' roles are classified independently of their listed role actions, each with a documented justification.</p>' +
                '<p><a href="#overwrites">Review role overwrites &#8594;</a></p>' +
                '</div></div>';
            html += '</div>';

            html += '</div>';
            el.innerHTML = html;

            el.querySelectorAll('[data-goto]').forEach(function (node) {
                node.addEventListener('click', function () { EOCE.app.go(node.getAttribute('data-goto')); });
            });
        });

        function stat(label, value, sub, accent) {
            return '<div class="stat"><span class="stat-accent" style="background:' + accent + '"></span>' +
                '<div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' +
                '<div class="stat-sub">' + sub + '</div></div>';
        }
        function tierMini(tier, n) {
            if (!n) return '';
            var t = EOCE.tier(tier);
            return '<span class="chip" style="color:' + t.color + ';border-color:' + t.border + ';background:' + t.bg + '">' +
                '<span class="tier-dot" style="background:' + t.color + '"></span>' + n + ' ' + t.short + '</span>';
        }
    }
};

EOCE.views.model = {
    render: function (el) {
        var rolePaths = EOCE.rolesSystemKeys().map(function (k) { return EOCE.RBAC_SYSTEMS[k].file; });
        return EOCE.data.loadAll(rolePaths).then(function (roleSets) {
            var dist = EOCE.charts.emptyDist();
            roleSets.forEach(function (data) {
                data.forEach(function (r) {
                    EOCE.charts.addToDist(dist, (r.Classification && r.Classification.EAMTierLevelName) || 'Unclassified');
                });
            });

            var html = '<div class="view">';
            html += '<div class="page-head"><h1>Enterprise Access Model</h1>' +
                '<p>Microsoft\'s Enterprise Access Model groups privileged access into planes by the impact of compromise. EntraOps maps every role action and permission to one of these access levels, so you can reason about lateral movement and escalation paths consistently across clouds.</p></div>';

            html += '<div class="eam-stack" style="margin-bottom:22px;">';
            ['ControlPlane', 'ManagementPlane', 'UserAccess'].forEach(function (k) {
                var t = EOCE.tier(k);
                html += '<div class="eam-plane tier-' + k.toLowerCase() + '">' +
                    '<div class="eam-tag">' + t.tag + '</div>' +
                    '<div style="min-width:0;"><div class="eam-name">' + t.label + ' &middot; Tier ' + t.tag + '</div>' +
                    '<div class="eam-desc">' + EOCE.util.escapeHtml(t.description) + '</div>' +
                    '<div class="muted" style="font-size:12px;margin-top:6px;"><strong>Typical:</strong> ' + EOCE.util.escapeHtml(t.examples) + '</div></div>' +
                    '<div class="eam-count"><div class="n" style="color:' + t.color + '">' + EOCE.util.formatNumber(dist[k]) + '</div><div class="l">classified roles</div></div>' +
                    '</div>';
            });
            html += '</div>';

            html += '<div class="grid cols-2">';
            html += '<div class="card"><div class="card-head">Why classify access into planes?</div><div class="card-pad prose">' +
                '<p>An attacker who reaches the <strong>Control Plane</strong> can grant themselves anything &mdash; it governs identities, credentials and security policy. The model exists to keep Control Plane access small, isolated and heavily protected, while preventing escalation from lower planes.</p>' +
                '<ul>' +
                '<li><strong>Control Plane (Tier 0):</strong> manage the identity &amp; security fabric.</li>' +
                '<li><strong>Management Plane (Tier 1):</strong> manage workloads, apps, devices and resources.</li>' +
                '<li><strong>User Access (Tier 2):</strong> read or self-service, limited blast radius.</li>' +
                '</ul>' +
                '<p>EntraOps classifies each role action, then a role inherits the <em>highest</em> plane it touches.</p>' +
                '</div></div>';
            html += '<div class="card"><div class="card-head">Learn more</div><div class="card-pad prose">' +
                '<ul>' +
                '<li><a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.enterpriseAccessModel + '">Enterprise Access Model (Microsoft Learn)</a></li>' +
                '<li><a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.securedWorkstations + '">Privileged access: secured workstations</a></li>' +
                '<li><a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.hipSessionVideo + '">Defending Tier 0: Taking Control of Your Cloud\'s Control Plane</a></li>' +
                '<li><a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.administrativeUnits + '">Administrative units (scoping)</a></li>' +
                '<li><a target="_blank" rel="noopener noreferrer" href="' + EOCE.DOCS.entraOpsRepo + '">EntraOps project on GitHub</a></li>' +
                '</ul>' +
                '<div class="callout"><div class="callout-title">Tip</div>Use the <a href="#scoped">Scope-aware Tiering</a> page to see how the same permission can change plane based on whether it targets privileged objects.</div>' +
                '</div></div>';
            html += '</div>';

            html += '</div>';
            el.innerHTML = html;
        });
    }
};
