/*
 * Template Comparison (entraops mode only) - diff built-in classification
 * templates against the tenant-specific copies written by
 * Update-EntraOpsClassificationControlPlaneScope.
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.views.compare = (function () {
    var FIELDS = [
        { key: 'RoleAssignmentScopeName', label: 'Included scopes', group: 'scope' },
        { key: 'ExcludedRoleAssignmentScopeName', label: 'Excluded scopes', group: 'scope' },
        { key: 'RoleDefinitionActions', label: 'Included role actions', group: 'action' },
        { key: 'ExcludedRoleDefinitionActions', label: 'Excluded role actions', group: 'action' }
    ];
    // Placeholder forms: sanitized («param:X», from *.Param.json embedding) and raw ("<X>").
    var PARAM_RE = /^\u00ABparam:([A-Za-z0-9_]+)\u00BB$/;
    var RAW_PARAM_RE = /^<([A-Za-z0-9_]+)>$/;

    var state = { tenant: null, file: null };

    function esc(v) { return EOCE.util.escapeHtml(v); }

    function baseName(path) { return String(path).split('/').pop(); }

    function templatePathFor(tenantFile) {
        return EOCE.templateFile(baseName(tenantFile));
    }

    function paramPathFor(templatePath) {
        return templatePath.replace(/\.json$/i, '.Param.json');
    }

    // Comparable files of a tenant: tenant copies whose template counterpart is known.
    function comparableFiles(tenant) {
        return (tenant.files || []).filter(function (f) { return !/\.Param\.json$/i.test(f); });
    }

    function entryKey(tier, def) {
        return tier + '|' + (def.Category || '') + '|' + (def.Service || '');
    }

    // Flatten a classification file into a map keyed by tier|category|service.
    function indexEntries(data) {
        var map = {};
        (data || []).forEach(function (tierObj) {
            var tier = tierObj.EAMTierLevelName;
            (tierObj.TierLevelDefinition || []).forEach(function (def) {
                var key = entryKey(tier, def);
                map[key] = { tier: tier, category: def.Category || '', service: def.Service || '', def: def };
            });
        });
        return map;
    }

    function fieldValues(def, field) {
        var v = def && def[field];
        if (!Array.isArray(v)) return [];
        return v.filter(function (x) { return typeof x === 'string'; });
    }

    // Placeholders used by an entry in the *.Param.json template (if any).
    function placeholdersOf(def) {
        var found = {};
        ['RoleAssignmentScopeName', 'ExcludedRoleAssignmentScopeName'].forEach(function (field) {
            fieldValues(def, field).forEach(function (v) {
                var m = v.match(PARAM_RE) || v.match(RAW_PARAM_RE);
                if (m) found['<' + m[1] + '>'] = true;
            });
        });
        return Object.keys(found);
    }

    function diffArrays(templateArr, tenantArr) {
        var t = {}, n = {};
        templateArr.forEach(function (v) { t[v] = true; });
        tenantArr.forEach(function (v) { n[v] = true; });
        return {
            added: tenantArr.filter(function (v) { return !t[v]; }),
            removed: templateArr.filter(function (v) { return !n[v]; })
        };
    }

    // Index every field value of a classification file:
    //   fieldKey -> value -> [ { tier, category, service } ] (every location it appears in).
    function indexValues(data) {
        var map = {};
        FIELDS.forEach(function (f) { map[f.key] = {}; });
        (data || []).forEach(function (tierObj) {
            var tier = tierObj.EAMTierLevelName;
            (tierObj.TierLevelDefinition || []).forEach(function (def) {
                FIELDS.forEach(function (f) {
                    fieldValues(def, f.key).forEach(function (v) {
                        (map[f.key][v] = map[f.key][v] || []).push({ tier: tier, category: def.Category || '', service: def.Service || '' });
                    });
                });
            });
        });
        return map;
    }

    // Diff two classification files (template vs tenant), annotated with the
    // placeholder info from the corresponding *.Param.json (paramMap may be null).
    // A role action / scope that disappears from one entry but is still present
    // elsewhere in the same field of the other file is reported as *moved*
    // (different service) or *reclassified* (different plane / tier level)
    // instead of a plain addition or removal.
    function buildDiff(templateData, tenantData, paramMap) {
        var tpl = indexEntries(templateData);
        var ten = indexEntries(tenantData);
        var tplVals = indexValues(templateData);
        var tenVals = indexValues(tenantData);
        var keys = {};
        Object.keys(tpl).forEach(function (k) { keys[k] = true; });
        Object.keys(ten).forEach(function (k) { keys[k] = true; });

        var rows = [];
        var recls = [];
        var seenMove = {};
        var seenRecls = {};
        var totals = { services: 0, changed: 0, scopeAdd: 0, scopeDel: 0, scopeMove: 0, actionAdd: 0, actionDel: 0, actionMove: 0 };

        // Count each moved value once (a move surfaces as 'in' on one entry and 'out'
        // on another) and collect tier-level reclassifications for the summary table.
        function registerMove(f, v, m) {
            var id = f.key + '|' + v;
            if (!seenMove[id]) {
                seenMove[id] = true;
                if (f.group === 'scope') totals.scopeMove++; else totals.actionMove++;
            }
            if (m.tierChanged && !seenRecls[id]) {
                seenRecls[id] = true;
                recls.push({
                    value: v, label: f.label, group: f.group,
                    fromTier: m.dir === 'in' ? m.other.tier : m.rowTier,
                    toTier: m.dir === 'in' ? m.rowTier : m.other.tier,
                    fromService: m.dir === 'in' ? m.other.service : m.rowService,
                    toService: m.dir === 'in' ? m.rowService : m.other.service
                });
            }
        }

        Object.keys(keys).sort().forEach(function (key) {
            totals.services++;
            var a = tpl[key], b = ten[key];
            var row = {
                key: key,
                tier: (a || b).tier,
                category: (a || b).category,
                service: (a || b).service,
                status: a && b ? 'both' : (a ? 'template-only' : 'tenant-only'),
                placeholders: paramMap && paramMap[key] ? placeholdersOf(paramMap[key].def) : [],
                fields: []
            };
            var changed = row.status !== 'both';
            FIELDS.forEach(function (f) {
                var d = diffArrays(a ? fieldValues(a.def, f.key) : [], b ? fieldValues(b.def, f.key) : []);
                if (!d.added.length && !d.removed.length) return;
                var added = [], removed = [], moves = [];
                // Value new to this tenant entry: if the template still lists it under the
                // same field elsewhere, it moved (in) - otherwise it is a real addition.
                d.added.forEach(function (v) {
                    var elsewhere = tplVals[f.key][v] || [];
                    if (elsewhere.length) {
                        var m = {
                            value: v, dir: 'in', other: elsewhere[0],
                            rowTier: row.tier, rowService: row.service,
                            tierChanged: elsewhere.every(function (l) { return l.tier !== row.tier; })
                        };
                        moves.push(m); registerMove(f, v, m);
                    } else { added.push(v); }
                });
                // Value gone from this template entry: if the tenant still lists it under
                // the same field elsewhere, it moved (out) - otherwise it is a real removal.
                d.removed.forEach(function (v) {
                    var elsewhere = tenVals[f.key][v] || [];
                    if (elsewhere.length) {
                        var m = {
                            value: v, dir: 'out', other: elsewhere[0],
                            rowTier: row.tier, rowService: row.service,
                            tierChanged: elsewhere.every(function (l) { return l.tier !== row.tier; })
                        };
                        moves.push(m); registerMove(f, v, m);
                    } else { removed.push(v); }
                });
                changed = true;
                row.fields.push({ label: f.label, group: f.group, added: added, removed: removed, moves: moves });
                if (f.group === 'scope') { totals.scopeAdd += added.length; totals.scopeDel += removed.length; }
                else { totals.actionAdd += added.length; totals.actionDel += removed.length; }
            });
            if (changed) {
                totals.changed++;
                rows.push(row);
            }
        });
        recls.sort(function (x, y) {
            if (x.group !== y.group) return x.group < y.group ? -1 : 1;
            return x.value < y.value ? -1 : (x.value > y.value ? 1 : 0);
        });
        return { rows: rows, totals: totals, recls: recls };
    }

    function fieldDelta(row, group) {
        var add = 0, del = 0, mov = 0;
        row.fields.forEach(function (f) {
            if (f.group !== group) return;
            add += f.added.length;
            del += f.removed.length;
            mov += (f.moves || []).length;
        });
        var parts = [];
        if (add) parts.push('<span class="chip diff-add">+' + add + '</span>');
        if (del) parts.push('<span class="chip diff-del">&minus;' + del + '</span>');
        if (mov) parts.push('<span class="chip diff-move" title="Present in template and tenant version, but under a different plane or service">&#8644;' + mov + '</span>');
        return parts.length ? parts.join(' ') : '<span class="muted">&mdash;</span>';
    }

    function statCard(label, value, sub) {
        return '<div class="stat"><span class="stat-accent" style="background:var(--tier-management)"></span>' +
            '<div class="stat-label">' + esc(label) + '</div>' +
            '<div class="stat-value">' + value + '</div>' +
            (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
    }

    // Per-plane distribution of a classification file: number of service entries and
    // distinct included role actions classified at each access level.
    function tierStats(data) {
        var stats = {};
        EOCE.TIER_ORDER.forEach(function (t) { stats[t] = { services: 0, actions: {} }; });
        (data || []).forEach(function (tierObj) {
            var t = stats[tierObj.EAMTierLevelName] ? tierObj.EAMTierLevelName : 'Unclassified';
            (tierObj.TierLevelDefinition || []).forEach(function (def) {
                stats[t].services++;
                fieldValues(def, 'RoleDefinitionActions').forEach(function (v) { stats[t].actions[v] = true; });
            });
        });
        EOCE.TIER_ORDER.forEach(function (t) { stats[t].actions = Object.keys(stats[t].actions).length; });
        return stats;
    }

    function deltaChip(from, to) {
        var d = to - from;
        if (!d) return '<span class="muted">&plusmn;0</span>';
        return d > 0 ? '<span class="chip diff-add">+' + d + '</span>' : '<span class="chip diff-del">&minus;' + (-d) + '</span>';
    }

    // Access-level distribution table: how many services / role actions each side
    // classifies as Control Plane, Management Plane and User Access.
    function tierDistributionHtml(templateData, tenantData, tenantName) {
        var tpl = tierStats(templateData);
        var ten = tierStats(tenantData);
        var html = '<div class="section-title">Access level distribution</div>' +
            '<p class="muted" style="margin:4px 0 10px;">How the template and the tenant-specific version distribute classified services and their included role actions across the Enterprise Access Model planes.</p>';
        html += '<div class="table-wrap" style="margin-bottom:22px;"><table class="grid-table">' +
            '<thead><tr><th>Access level</th>' +
            '<th class="nowrap">Services (template)</th><th class="nowrap">Services (' + esc(tenantName) + ')</th><th class="nowrap">&Delta;</th>' +
            '<th class="nowrap">Role actions (template)</th><th class="nowrap">Role actions (' + esc(tenantName) + ')</th><th class="nowrap">&Delta;</th></tr></thead><tbody>';
        EOCE.TIER_ORDER.forEach(function (t) {
            var a = tpl[t], b = ten[t];
            if (t === 'Unclassified' && !a.services && !b.services) return;
            html += '<tr><td>' + EOCE.util.tierBadge(t) + '</td>' +
                '<td>' + EOCE.util.formatNumber(a.services) + '</td>' +
                '<td>' + EOCE.util.formatNumber(b.services) + '</td>' +
                '<td class="nowrap">' + deltaChip(a.services, b.services) + '</td>' +
                '<td>' + EOCE.util.formatNumber(a.actions) + '</td>' +
                '<td>' + EOCE.util.formatNumber(b.actions) + '</td>' +
                '<td class="nowrap">' + deltaChip(a.actions, b.actions) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    function openRow(row, tenantName) {
        var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + EOCE.util.tierBadge(row.tier) +
            '<span class="chip brand">' + esc(row.category) + '</span>';
        if (row.status === 'tenant-only') body += '<span class="chip diff-add">Only in ' + esc(tenantName) + '</span>';
        if (row.status === 'template-only') body += '<span class="chip diff-del">Missing in ' + esc(tenantName) + '</span>';
        row.placeholders.forEach(function (ph) {
            body += '<span class="chip scope cell-mono" style="font-size:11px;">' + esc(ph) + '</span>';
        });
        body += '</div>';
        if (row.placeholders.length) {
            body += '<div class="callout scope"><div class="callout-title">Scope-aware entry</div>' +
                'The built-in template parameterizes this service with ' +
                row.placeholders.map(function (ph) { return '<span class="cell-mono">' + esc(ph) + '</span>'; }).join(', ') +
                '. <code>Update-EntraOpsClassificationControlPlaneScope</code> resolved the placeholder(s) to the concrete scopes of your tenant, which explains the differences below.</div>';
        }
        if (!row.fields.length) {
            body += '<p class="muted">The service exists only on one side; no field-level differences to show.</p>';
        }
        row.fields.forEach(function (f) {
            body += '<div class="section-title">' + esc(f.label) + '</div>';
            f.added.forEach(function (v) {
                body += '<div class="action-row" style="border-left:3px solid var(--diff-add,#2e9e5b);"><div class="a-name cell-mono">' + esc(v) + '</div><span class="chip diff-add">' + esc(tenantName) + '</span></div>';
            });
            f.removed.forEach(function (v) {
                body += '<div class="action-row" style="border-left:3px solid var(--diff-del,#c8452c);"><div class="a-name cell-mono">' + esc(v) + '</div><span class="chip diff-del">template</span></div>';
            });
            (f.moves || []).forEach(function (m) {
                var fromTier = m.dir === 'in' ? m.other.tier : row.tier;
                var toTier = m.dir === 'in' ? row.tier : m.other.tier;
                var fromSvc = m.dir === 'in' ? m.other.service : row.service;
                var toSvc = m.dir === 'in' ? row.service : m.other.service;
                body += '<div class="action-row" style="border-left:3px solid var(--diff-move,#d68f00);">' +
                    '<div class="a-name cell-mono">' + esc(m.value) + '</div>' +
                    '<span class="chip diff-move">' + (m.tierChanged ? 'reclassified' : 'moved') + '</span>' +
                    '<span style="display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
                    EOCE.util.tierBadge(fromTier, { short: true }) +
                    '<span class="muted" style="font-size:11px;">' + esc(fromSvc) + '</span>' +
                    '<span class="muted">&rarr;</span>' +
                    EOCE.util.tierBadge(toTier, { short: true }) +
                    '<span class="muted" style="font-size:11px;">' + esc(toSvc) + '</span></span></div>';
            });
        });
        EOCE.app.openDrawer('Template comparison &middot; ' + esc(tenantName), esc(row.service), body);
    }

    function render(el) {
        if (!EOCE.TENANTS.length) {
            el.innerHTML = '<div class="view"><div class="page-head"><h1>Template Comparison</h1>' +
                '<p>Compare the built-in classification templates with the tenant-specific, parameterized copies.</p></div>' +
                '<div class="callout"><div class="callout-title">No tenant-specific classifications found</div>' +
                'Run <code>Update-EntraOpsClassificationControlPlaneScope</code> in EntraOps to write parameterized classification files to ' +
                '<span class="cell-mono">Classification/&lt;TenantName&gt;/</span>, then re-run <span class="cell-mono">Update-EntraOpsClassificationExplorerData -Mode EntraOps</span> to refresh the embedded data of this app.</div></div>';
            return Promise.resolve();
        }

        // Validate / default selection.
        var tenant = EOCE.tenantByName(state.tenant) || EOCE.TENANTS[0];
        state.tenant = tenant.name;
        var files = comparableFiles(tenant);
        if (files.indexOf(state.file) === -1) state.file = files[0] || null;

        if (!state.file) {
            el.innerHTML = '<div class="view"><div class="page-head"><h1>Template Comparison</h1></div>' +
                '<div class="callout"><div class="callout-title">No comparable files</div>The tenant folder <span class="cell-mono">Classification/' +
                esc(tenant.name) + '/</span> contains no classification files with a built-in template counterpart.</div></div>';
            return Promise.resolve();
        }

        var tplPath = templatePathFor(state.file);
        var paramPath = paramPathFor(tplPath);
        return Promise.all([
            EOCE.data.loadRaw(tplPath),
            EOCE.data.loadRaw(state.file),
            EOCE.data.loadRaw(paramPath).catch(function () { return null; })
        ]).then(function (res) {
            var paramMap = res[2] ? indexEntries(res[2]) : null;
            var diff = buildDiff(res[0], res[1], paramMap);

            var html = '<div class="view">';
            html += '<div class="page-head"><h1>Template Comparison</h1>' +
                '<p>Differences between the <strong>built-in template</strong> (<span class="cell-mono">' + esc(EOCE.TEMPLATE_BASE) + '</span>) and the <strong>tenant-specific</strong> classification written by <code>Update-EntraOpsClassificationControlPlaneScope</code> (<span class="cell-mono">Classification/' + esc(tenant.name) + '</span>). Scope placeholders such as <code>&lt;ScopeNamePrivilegedUsers&gt;</code> are resolved to concrete tenant scopes in the tenant version, so scope differences on parameterized services are expected. Role actions and scopes that exist on both sides but are <strong>classified differently</strong> are flagged as <span class="chip diff-move">&#8644; reclassified</span> (different plane) or <span class="chip diff-move">&#8644; moved</span> (different service) instead of being counted as plain additions/removals.</p></div>';

            // Controls
            html += '<div class="toolbar">';
            if (EOCE.TENANTS.length > 1) {
                html += '<select class="filter" id="cmpTenant" aria-label="Tenant">';
                EOCE.TENANTS.forEach(function (t) {
                    html += '<option value="' + esc(t.name) + '"' + (t.name === tenant.name ? ' selected' : '') + '>' + esc(t.name) + '</option>';
                });
                html += '</select>';
            }
            html += '<select class="filter" id="cmpFile" aria-label="Classification file">';
            files.forEach(function (f) {
                html += '<option value="' + esc(f) + '"' + (f === state.file ? ' selected' : '') + '>' + esc(baseName(f)) + '</option>';
            });
            html += '</select></div>';

            // Summary stats
            var totals = diff.totals;
            html += '<div class="grid cols-4" style="margin-bottom:22px;">' +
                statCard('Services compared', EOCE.util.formatNumber(totals.services), esc(baseName(state.file))) +
                statCard('Services with differences', EOCE.util.formatNumber(totals.changed),
                    totals.changed ? 'template vs. ' + esc(tenant.name) : 'template and tenant version are identical') +
                statCard('Scope changes',
                    '<span class="chip diff-add">+' + totals.scopeAdd + '</span> <span class="chip diff-del">&minus;' + totals.scopeDel + '</span>' +
                    (totals.scopeMove ? ' <span class="chip diff-move">&#8644;' + totals.scopeMove + '</span>' : ''),
                    'assignment scopes added / removed / reclassified in the tenant version') +
                statCard('Role action changes',
                    '<span class="chip diff-add">+' + totals.actionAdd + '</span> <span class="chip diff-del">&minus;' + totals.actionDel + '</span>' +
                    (totals.actionMove ? ' <span class="chip diff-move">&#8644;' + totals.actionMove + '</span>' : ''),
                    'role actions added / removed / reclassified in the tenant version') +
                '</div>';

            // Per-plane distribution: template vs tenant.
            html += tierDistributionHtml(res[0], res[1], tenant.name);

            // Tier-level reclassifications - same role action / scope, different plane.
            if (diff.recls.length) {
                html += '<div class="section-title">Reclassified role actions &amp; scopes</div>' +
                    '<p class="muted" style="margin:4px 0 10px;">These values exist in both the template and the tenant version, but the tenant classifies them at a <strong>different access level</strong>.</p>';
                html += '<div class="table-wrap" style="margin-bottom:22px;"><table class="grid-table">' +
                    '<thead><tr><th>Role action / scope</th><th>Field</th><th class="nowrap">Template</th><th class="nowrap">' + esc(tenant.name) + '</th><th>Service (template &rarr; tenant)</th></tr></thead><tbody>';
                diff.recls.forEach(function (r) {
                    var svc = r.fromService === r.toService
                        ? esc(r.fromService)
                        : esc(r.fromService) + ' <span class="muted">&rarr;</span> ' + esc(r.toService);
                    html += '<tr><td class="cell-mono">' + esc(r.value) + '</td>' +
                        '<td class="muted">' + esc(r.label) + '</td>' +
                        '<td>' + EOCE.util.tierBadge(r.fromTier, { short: true }) + '</td>' +
                        '<td>' + EOCE.util.tierBadge(r.toTier, { short: true }) + '</td>' +
                        '<td class="muted">' + svc + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }

            if (!diff.rows.length) {
                html += '<div class="callout"><div class="callout-title">No differences</div>The tenant-specific file matches the built-in template.</div>';
            } else {
                html += '<div class="section-title">Changed services</div>';
                html += '<div class="table-wrap"><table class="grid-table">' +
                    '<thead><tr><th>Service</th><th class="nowrap">Plane</th><th>Category</th><th class="nowrap">Scopes &Delta;</th><th class="nowrap">Actions &Delta;</th><th class="nowrap">Placeholder</th></tr></thead><tbody>';
                diff.rows.forEach(function (row, i) {
                    var ph = row.placeholders.length
                        ? row.placeholders.map(function (p) { return '<span class="chip scope cell-mono" style="font-size:11px;">' + esc(p) + '</span>'; }).join(' ')
                        : '<span class="muted">&mdash;</span>';
                    var statusChip = row.status === 'tenant-only' ? ' <span class="chip diff-add">tenant-only</span>'
                        : row.status === 'template-only' ? ' <span class="chip diff-del">template-only</span>' : '';
                    html += '<tr data-i="' + i + '" style="cursor:pointer;">' +
                        '<td class="cell-strong">' + esc(row.service) + statusChip + '</td>' +
                        '<td>' + EOCE.util.tierBadge(row.tier) + '</td>' +
                        '<td class="muted">' + esc(row.category) + '</td>' +
                        '<td class="nowrap">' + fieldDelta(row, 'scope') + '</td>' +
                        '<td class="nowrap">' + fieldDelta(row, 'action') + '</td>' +
                        '<td>' + ph + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }
            html += '</div>';
            el.innerHTML = html;

            var tenantSel = el.querySelector('#cmpTenant');
            if (tenantSel) tenantSel.addEventListener('change', function () {
                state.tenant = tenantSel.value;
                state.file = null;
                render(el);
            });
            el.querySelector('#cmpFile').addEventListener('change', function () {
                state.file = el.querySelector('#cmpFile').value;
                render(el);
            });
            el.querySelectorAll('tr[data-i]').forEach(function (tr) {
                tr.addEventListener('click', function () {
                    openRow(diff.rows[parseInt(tr.getAttribute('data-i'), 10)], tenant.name);
                });
            });
        });
    }

    return { render: render };
})();
