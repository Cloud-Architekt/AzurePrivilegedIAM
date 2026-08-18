/*
 * Customize Overwrites - load, modify or create classification overwrite files
 * (Classification_RoleDefinitionOverwrites.json / Classification_RoleActionOverwrites.json /
 * Classification_ApiPermissionOverwrites.json).
 *
 * Built-in templates live under Classification/Templates, tenant-specific
 * customizations under Classification/<TenantName>. The editor keeps a draft in
 * localStorage; Import/Export/Save handle the JSON file content. Entries can be
 * added from the shared Review list (roles and role actions, including "add all
 * role actions of a role") or picked from the current primary classification
 * source (tenant-specific template when one exists, built-in template otherwise).
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.views.customize = (function () {
    'use strict';

    // ---- Static metadata ---------------------------------------------------
    var TYPES = {
        roledef: {
            key: 'roledef',
            label: 'Role Definitions',
            title: 'Role Definition Overwrites',
            fileName: 'Classification_RoleDefinitionOverwrites.json',
            template: EOCE.templateFile('Classification_RoleDefinitionOverwrites.json'),
            // Systems whose EAM cmdlets consume Classification_RoleDefinitionOverwrites.json at runtime.
            systems: ['EntraID', 'IdentityGovernance', 'DeviceManagement', 'Defender'],
            hint: 'Down- or upgrade the tier of an entire role definition, identified by RoleDefinitionId and/or RoleDefinitionName. ' +
                'EntraOps prefers a tenant-specific file (Classification/&lt;TenantName&gt;/) and falls back to the built-in template. Applied at runtime by the Get-EntraOpsPrivilegedEAM* cmdlets (TaggedBy: RoleDefinitionOverwrites).'
        },
        roleaction: {
            key: 'roleaction',
            label: 'Role Actions',
            title: 'Role Action Overwrites',
            fileName: 'Classification_RoleActionOverwrites.json',
            template: EOCE.templateFile('Classification_RoleActionOverwrites.json'),
            // ClassificationParameterScope of Update-EntraOpsClassificationControlPlaneScope.
            systems: ['EntraID', 'IdentityGovernance', 'DeviceManagement', 'Defender'],
            hint: 'Down- or upgrade the tier of individual role definition actions on a scope. ' +
                'EntraOps reads this file <strong>only</strong> from the tenant-specific folder (Classification/&lt;TenantName&gt;/) &mdash; a Templates file serves as a starting point here but is ignored at runtime. ' +
                'Applied at classification file generation time by Update-EntraOpsClassificationControlPlaneScope and baked into the tenant-specific Classification_*.json files. ' +
                'For <strong>Resource Apps (API permissions)</strong>, use the separate "API Permissions" tab instead &mdash; it has its own schema aligned with Classification_ApiPermissions.json.'
        },
        apipermission: {
            key: 'apipermission',
            label: 'API Permissions',
            title: 'API Permission Overwrites',
            fileName: 'Classification_ApiPermissionOverwrites.json',
            template: EOCE.templateFile('Classification_ApiPermissionOverwrites.json'),
            // Only ResourceApps consumes Classification_ApiPermissionOverwrites.json (baked into the
            // tenant-specific Classification_ApiPermissions.json by Update-EntraOpsClassificationControlPlaneScope).
            systems: ['ResourceApps'],
            hint: 'Down- or upgrade the tier of an individual API permission (application or delegated permission on Microsoft Graph or another resource app), identified by PermissionValue. ' +
                'Schema is aligned with an entry of Classification_ApiPermissions.json (PermissionValue/PermissionType/TargetAppId/Category) instead of the role-action/scope-pattern shape used by Classification_RoleActionOverwrites.json. ' +
                'EntraOps reads this file <strong>only</strong> from the tenant-specific folder (Classification/&lt;TenantName&gt;/) &mdash; a Templates file serves as a starting point here but is ignored at runtime. ' +
                'Optionally set Target App ID and/or Permission type (Application/Delegated/All) to pin the overwrite to a specific resource application or permission type &mdash; required to classify a permission that is not yet covered by any entry in Classification_ApiPermissions.json.'
        }
    };

    // Classification-logic definition files used as "primary source" pickers
    // (role actions with their current tier / service). ResourceApps (API permissions) is
    // intentionally excluded here - its picker (below) searches the flat permission catalog instead.
    var DEFINITION_FILES = {
        EntraID: EOCE.templateFile('Classification_AadResources.json'),
        IdentityGovernance: EOCE.templateFile('Classification_IdentityGovernance.json'),
        DeviceManagement: EOCE.templateFile('Classification_DeviceManagement.json'),
        Defender: EOCE.templateFile('Classification_Defender.json')
    };

    // Flat permission catalog used as the picker source for the API Permissions tab
    // (same source Reports/ClassificationExplorer's Permissions view browses).
    var PERMISSION_CATALOG_FILE = EOCE.PERMISSION_SETS.ApiPermissions.file;

    var TIER_CHOICES = ['ControlPlane', 'ManagementPlane', 'UserAccess'];
    var LS_KEY = 'eoce.customize.v1';

    function esc(v) { return EOCE.util.escapeHtml(v); }

    function sysShort(key) {
        if (EOCE.RBAC_SYSTEMS[key]) return EOCE.RBAC_SYSTEMS[key].short;
        return key === 'ResourceApps' ? 'Resource Apps' : key;
    }

    // Reverse map: review items store the RBAC system's short label.
    function sysKeyFromShort(shortLabel) {
        var keys = Object.keys(EOCE.RBAC_SYSTEMS);
        for (var i = 0; i < keys.length; i++) {
            if (EOCE.RBAC_SYSTEMS[keys[i]].short === shortLabel) return keys[i];
        }
        return null;
    }

    // ---- Draft persistence ---------------------------------------------------
    function emptyDraft() { return { entries: [], source: 'New file (unsaved)', dirty: false }; }

    function loadDrafts() {
        try {
            var raw = window.localStorage.getItem(LS_KEY);
            var d = raw ? JSON.parse(raw) : null;
            if (d && d.roledef && d.roleaction && d.apipermission) return d;
        } catch (e) { /* private mode / corrupt draft */ }
        return { roledef: emptyDraft(), roleaction: emptyDraft(), apipermission: emptyDraft() };
    }

    function persistDrafts(drafts) {
        try { window.localStorage.setItem(LS_KEY, JSON.stringify(drafts)); } catch (e) { /* ignore */ }
    }

    // ---- Entry model ---------------------------------------------------------
    function toArray(v) {
        if (v === undefined || v === null || v === '') return [];
        return (Array.isArray(v) ? v : [v]).map(function (x) { return String(x); }).filter(Boolean);
    }

    function normalizeEntry(type, raw) {
        var e = raw || {};
        var base = {
            RbacSystem: e.RbacSystem && TYPES[type].systems.indexOf(String(e.RbacSystem)) !== -1 ? String(e.RbacSystem) : (e.RbacSystem ? String(e.RbacSystem) : TYPES[type].systems[0]),
            EAMTierLevelName: TIER_CHOICES.indexOf(String(e.EAMTierLevelName)) !== -1 ? String(e.EAMTierLevelName) : (e.EAMTierLevelName ? String(e.EAMTierLevelName) : ''),
            Service: e.Service ? String(e.Service) : '',
            Justification: e.Justification ? String(e.Justification) : ''
        };
        if (type === 'roledef') {
            base.RoleDefinitionId = e.RoleDefinitionId ? String(e.RoleDefinitionId) : '';
            base.RoleDefinitionName = e.RoleDefinitionName ? String(e.RoleDefinitionName) : '';
        } else if (type === 'apipermission') {
            // Category is the API permission catalog's equivalent of Service - stored in the same
            // internal `Service` field so the generic Service input/label can be reused, but
            // serialized back out as `Category` (see serializeEntries).
            base.PermissionValue = e.PermissionValue ? String(e.PermissionValue) : '';
            base.PermissionType = ['Application', 'Delegated', 'All'].indexOf(String(e.PermissionType)) !== -1 ? String(e.PermissionType) : '';
            base.TargetAppId = e.TargetAppId ? String(e.TargetAppId) : '';
        } else {
            base.RoleDefinitionActions = toArray(e.RoleDefinitionActions);
            base.RoleAssignmentScopeName = toArray(e.RoleAssignmentScopeName);
            if (!base.RoleAssignmentScopeName.length) base.RoleAssignmentScopeName = ['/*'];
        }
        return base;
    }

    // Serialize the editor model back into the EntraOps overwrite file schema.
    function serializeEntries(type, entries) {
        return entries.map(function (e) {
            var tier = EOCE.TIERS[e.EAMTierLevelName];
            var out = { RbacSystem: e.RbacSystem };
            if (type === 'roledef') {
                if (e.RoleDefinitionId) out.RoleDefinitionId = e.RoleDefinitionId;
                if (e.RoleDefinitionName) out.RoleDefinitionName = e.RoleDefinitionName;
            } else if (type === 'apipermission') {
                out.PermissionValue = e.PermissionValue;
                if (e.PermissionType) out.PermissionType = e.PermissionType;
                if (e.TargetAppId) out.TargetAppId = e.TargetAppId;
            } else {
                out.RoleDefinitionActions = e.RoleDefinitionActions.slice();
                out.RoleAssignmentScopeName = e.RoleAssignmentScopeName.length ? e.RoleAssignmentScopeName.slice() : ['/*'];
            }
            out.EAMTierLevelName = e.EAMTierLevelName;
            out.EAMTierLevelTagValue = tier ? tier.tag : '';
            if (e.Service) { out[type === 'apipermission' ? 'Category' : 'Service'] = e.Service; }
            out.Justification = e.Justification || '';
            return out;
        });
    }

    // Issues that would make Import-EntraOpsClassificationOverwrites skip the entry.
    function validateEntries(type, entries) {
        var issues = [];
        entries.forEach(function (e, i) {
            var label = 'Entry ' + (i + 1);
            if (type === 'roledef' && !e.RoleDefinitionId && !e.RoleDefinitionName) {
                issues.push({ idx: i, msg: label + ': RoleDefinitionId or RoleDefinitionName is required.' });
            }
            if (type === 'roleaction' && (!e.RoleDefinitionActions || !e.RoleDefinitionActions.length)) {
                issues.push({ idx: i, msg: label + ': at least one role definition action is required.' });
            }
            if (type === 'apipermission' && !e.PermissionValue) {
                issues.push({ idx: i, msg: label + ': PermissionValue is required.' });
            }
            if (TIER_CHOICES.indexOf(e.EAMTierLevelName) === -1) {
                issues.push({ idx: i, msg: label + ': EAMTierLevelName must be one of ' + TIER_CHOICES.join(', ') + '.' });
            }
            if (!e.Justification) {
                issues.push({ idx: i, msg: label + ': a Justification is mandatory to document the classification change.' });
            }
        });
        return issues;
    }

    // ---- Source resolution ---------------------------------------------------
    function sourceOptions(type) {
        var t = TYPES[type];
        var opts = [{ key: 'template', label: 'Built-in template (' + EOCE.TEMPLATE_BASE + ')', path: t.template }];
        EOCE.TENANTS.forEach(function (tn) {
            if (!tn || !tn.name) return;
            var p = 'Classification/' + tn.name + '/' + t.fileName;
            if ((tn.files || []).indexOf(p) !== -1) {
                opts.push({ key: 'tenant:' + tn.name, label: tn.name + ' (tenant-specific)', path: p });
            }
        });
        return opts;
    }

    // Primary classification source: tenant-specific copy when one exists
    // (selected variant first, otherwise the single discovered tenant), else template.
    function primaryPath(templatePath) {
        var variant = EOCE.getVariant();
        var p = null;
        if (variant !== EOCE.VARIANT_TEMPLATE) p = EOCE.tenantFileFor(variant, templatePath);
        if (!p && EOCE.TENANTS.length === 1) p = EOCE.tenantFileFor(EOCE.TENANTS[0].name, templatePath);
        return p || templatePath;
    }

    function sourceLabelForPath(path) {
        if (path.indexOf(EOCE.TEMPLATE_BASE + '/') === 0) return 'built-in template';
        var m = /^Classification\/([^\/]+)\//.exec(path);
        return m ? 'tenant-specific (' + m[1] + ')' : path;
    }

    // Flatten a tier-definition file into [{ action, service, tier }] (first occurrence wins).
    function flattenDefinition(defArray) {
        var seen = {}, out = [];
        (defArray || []).forEach(function (tierObj) {
            var tier = tierObj && tierObj.EAMTierLevelName;
            ((tierObj && tierObj.TierLevelDefinition) || []).forEach(function (def) {
                ((def && def.RoleDefinitionActions) || []).forEach(function (a) {
                    var k = String(a).toLowerCase();
                    if (seen[k]) return;
                    seen[k] = true;
                    out.push({
                        action: String(a), service: (def && def.Service) || '', tier: tier || 'Unclassified',
                        resourceAppId: (def && def.ResourceAppId) || '', resourceScope: (def && def.ResourceScope) || ''
                    });
                });
            });
        });
        return out;
    }

    // ---- Roles index (for the role picker and review-list expansion) ----------
    var rolesIndexPromise = null;
    function loadRolesIndex() {
        if (rolesIndexPromise) return rolesIndexPromise;
        // Azure RBAC is excluded: the overwrite files are not consumed by the Azure EAM pipeline.
        var keys = EOCE.rolesSystemKeys().filter(function (k) { return k !== 'Azure'; });
        rolesIndexPromise = Promise.all(keys.map(function (k) {
            return EOCE.data.load(EOCE.RBAC_SYSTEMS[k].file).catch(function () { return []; });
        })).then(function (sets) {
            var list = [], byId = {};
            keys.forEach(function (k, i) {
                (sets[i] || []).forEach(function (r) {
                    var actions = EOCE.rolePerms(r).map(function (p) { return p.AuthorizedResourceAction; }).filter(Boolean);
                    var item = {
                        sysKey: k,
                        id: r.RoleId || '',
                        name: r.RoleName || '',
                        tier: (r.Classification && r.Classification.EAMTierLevelName) || 'Unclassified',
                        actions: actions
                    };
                    list.push(item);
                    byId[k + '|' + item.id] = item;
                });
            });
            return { list: list, byId: byId };
        });
        return rolesIndexPromise;
    }

    // ---- Review list helpers ---------------------------------------------------
    function reviewItems() {
        return window.EOReview ? EOReview.all() : [];
    }

    // Resolve a review item into { kind, sysKey, roleId?, action?, name }.
    function resolveReviewItem(item) {
        var m;
        if (item.kind === 'Role') {
            m = /#roles\/([^\/]+)\/(.+)$/.exec(item.hash || '');
            return { kind: 'role', sysKey: m ? decodeURIComponent(m[1]) : sysKeyFromShort(item.system), roleId: m ? decodeURIComponent(m[2]) : null, name: item.name };
        }
        if (item.kind === 'Role action') {
            m = /#actions\/([^\/]+)\/(.+)$/.exec(item.hash || '');
            return { kind: 'action', sysKey: m ? decodeURIComponent(m[1]) : sysKeyFromShort(item.system), action: m ? decodeURIComponent(m[2]) : item.name, name: item.name };
        }
        return null;
    }

    // ---- File download / save ---------------------------------------------------
    function downloadJson(fileName, jsonText) {
        var blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function saveWithPicker(fileName, jsonText) {
        if (!window.showSaveFilePicker) return Promise.reject(new Error('unsupported'));
        return window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        }).then(function (handle) {
            return handle.createWritable().then(function (writable) {
                return writable.write(jsonText).then(function () { return writable.close(); });
            });
        });
    }

    // ---- Inline error banner (replaces window.alert) ---------------------------
    // Renders a dismissible error callout (same .callout.attack styling as the
    // validation-issues box above the table) into the given host element:
    // #custError in the main view, #cfError inside the add/edit blade.
    function showError(hostId, message) {
        var host = document.getElementById(hostId);
        if (!host) return;
        host.innerHTML = '<div class="callout attack" role="alert" style="margin-bottom:14px;">' +
            '<button type="button" class="btn small" style="float:right;" data-dismiss title="Dismiss" aria-label="Dismiss error">&#10005;</button>' +
            '<div class="callout-title">&#9888; Error</div>' +
            '<div style="white-space:pre-line;">' + esc(message) + '</div></div>';
        host.querySelector('[data-dismiss]').addEventListener('click', function () { host.innerHTML = ''; });
        if (host.firstChild && host.firstChild.scrollIntoView) host.firstChild.scrollIntoView({ block: 'nearest' });
    }

    function clearError(hostId) {
        var host = document.getElementById(hostId);
        if (host) host.innerHTML = '';
    }

    // ==========================================================================
    var view = {
        state: { type: 'roledef' },
        drafts: null,
        form: null, // blade state: { editIndex, entry, roleQ, actionQ }

        draft: function () { return this.drafts[this.state.type]; },

        markDirty: function () {
            this.draft().dirty = true;
            persistDrafts(this.drafts);
        },

        // ---- Main view ------------------------------------------------------
        render: function (el, params) {
            var self = this;
            this.el = el;
            if (!this.drafts) this.drafts = loadDrafts();
            if (params && params[0] && TYPES[params[0]]) this.state.type = params[0];

            el.innerHTML =
                '<div class="view">' +
                '<div class="page-head"><h1>Customize Overwrites</h1>' +
                '<p>Create or modify EntraOps classification overwrite files: pin an entire <strong>role definition</strong> to a tier, down-/upgrade individual <strong>role actions</strong> on a scope, or down-/upgrade an individual <strong>API permission</strong>. ' +
                'Load the built-in template or a tenant-specific file, edit the entries, then export or save the JSON. Store your customization as <code>Classification/&lt;TenantName&gt;/&lt;file&gt;</code> in your EntraOps repository.</p></div>' +
                '<div id="custToolbar"></div>' +
                '<div id="custError"></div>' +
                '<div id="custIssues"></div>' +
                '<div class="table-wrap"><table class="grid-table" id="custTable"></table></div>' +
                '<div class="cust-footer" id="custFooter"></div>' +
                '<div class="callout" style="margin-top:18px;" id="custHint"></div>' +
                '</div>';

            this.renderToolbar();
            this.renderTable();
            this.renderFooter();
            this.renderHint();
            return Promise.resolve();
        },

        renderToolbar: function () {
            var self = this;
            var type = this.state.type;
            var d = this.draft();
            var opts = sourceOptions(type);

            var html = '<div class="toolbar">';
            html += '<div class="seg-group" id="custTypeSeg">';
            Object.keys(TYPES).forEach(function (k) {
                html += '<button class="seg' + (type === k ? ' active' : '') + '" data-type="' + k + '">' + esc(TYPES[k].label) + '</button>';
            });
            html += '</div>';

            html += '<select class="filter" id="custSource" title="Overwrite file to load">';
            opts.forEach(function (o) {
                html += '<option value="' + esc(o.key) + '">' + esc(o.label) + '</option>';
            });
            html += '</select>';
            html += '<button class="btn" id="custLoad" title="Load the selected overwrite file into the editor (replaces the current draft)">Load</button>';
            html += '<button class="btn" id="custNew" title="Start a new, empty overwrite file">New</button>';
            html += '<button class="btn" id="custImport" title="Import an overwrite JSON file from disk">Import&hellip;</button>';
            html += '<input type="file" id="custImportFile" accept=".json,application/json" hidden>';

            html += '<span class="toolbar-meta" id="custMeta"></span>';
            html += '</div>';
            html += '<div class="cust-status" id="custStatus"></div>';

            document.getElementById('custToolbar').innerHTML = html;
            this.updateStatus();

            document.getElementById('custTypeSeg').addEventListener('click', function (e) {
                var b = e.target.closest('[data-type]'); if (!b) return;
                self.state.type = b.getAttribute('data-type');
                clearError('custError');
                self.renderToolbar(); self.renderTable(); self.renderFooter(); self.renderHint();
            });
            document.getElementById('custLoad').addEventListener('click', function () {
                var sel = document.getElementById('custSource');
                var opt = opts.filter(function (o) { return o.key === sel.value; })[0];
                if (!opt) return;
                if (self.draft().dirty && !window.confirm('Replace the current draft (' + self.draft().entries.length + ' entries) with "' + opt.label + '"?')) return;
                EOCE.data.loadRaw(opt.path).then(function (arr) {
                    self.drafts[self.state.type] = {
                        entries: (Array.isArray(arr) ? arr : []).map(function (e) { return normalizeEntry(self.state.type, e); }),
                        source: opt.label,
                        dirty: false
                    };
                    persistDrafts(self.drafts);
                    clearError('custError');
                    self.renderTable(); self.renderFooter(); self.updateStatus();
                }).catch(function (err) {
                    showError('custError', 'Could not load "' + opt.path + '": ' + (err && err.message ? err.message : err) +
                        '\n\nThe file may not exist (yet) or the app is running without an embedded data bundle.');
                });
            });
            document.getElementById('custNew').addEventListener('click', function () {
                if (self.draft().dirty && !window.confirm('Discard the current draft (' + self.draft().entries.length + ' entries) and start empty?')) return;
                self.drafts[self.state.type] = emptyDraft();
                persistDrafts(self.drafts);
                self.renderTable(); self.renderFooter(); self.updateStatus();
            });
            document.getElementById('custImport').addEventListener('click', function () {
                document.getElementById('custImportFile').click();
            });
            document.getElementById('custImportFile').addEventListener('change', function (e) {
                var file = e.target.files && e.target.files[0];
                e.target.value = '';
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function () {
                    try {
                        var arr = JSON.parse(String(reader.result));
                        if (!Array.isArray(arr)) throw new Error('Expected a JSON array of overwrite entries.');
                        if (self.draft().dirty && !window.confirm('Replace the current draft with the imported file "' + file.name + '"?')) return;
                        self.drafts[self.state.type] = {
                            entries: arr.map(function (x) { return normalizeEntry(self.state.type, x); }),
                            source: 'Imported: ' + file.name,
                            dirty: true
                        };
                        persistDrafts(self.drafts);
                        clearError('custError');
                        self.renderTable(); self.renderFooter(); self.updateStatus();
                    } catch (err) {
                        showError('custError', 'Import failed: ' + (err && err.message ? err.message : err));
                    }
                };
                reader.readAsText(file);
            });
        },

        updateStatus: function () {
            var d = this.draft();
            var statusEl = document.getElementById('custStatus');
            var metaEl = document.getElementById('custMeta');
            if (metaEl) metaEl.textContent = d.entries.length + ' entr' + (d.entries.length === 1 ? 'y' : 'ies');
            if (statusEl) {
                statusEl.innerHTML = '<span class="chip brand">' + esc(TYPES[this.state.type].fileName) + '</span> ' +
                    '<span class="muted">Source: ' + esc(d.source) + '</span>' +
                    (d.dirty ? ' <span class="chip warn" title="The draft differs from the loaded source and has not been exported/saved yet">unsaved changes</span>' : '');
            }
        },

        renderTable: function () {
            var self = this;
            var type = this.state.type;
            var d = this.draft();
            var issues = validateEntries(type, d.entries);
            var issueIdx = {};
            issues.forEach(function (i) { issueIdx[i.idx] = true; });

            var issuesEl = document.getElementById('custIssues');
            if (issuesEl) {
                issuesEl.innerHTML = issues.length
                    ? '<div class="callout attack" style="margin-bottom:14px;"><div class="callout-title">&#9888; ' + issues.length + ' validation issue' + (issues.length === 1 ? '' : 's') + '</div>' +
                    'EntraOps skips invalid entries with a warning when loading the file.<ul style="margin:8px 0 0 18px;padding:0;">' +
                    issues.slice(0, 10).map(function (i) { return '<li>' + esc(i.msg) + '</li>'; }).join('') +
                    (issues.length > 10 ? '<li>&hellip; and ' + (issues.length - 10) + ' more</li>' : '') +
                    '</ul></div>'
                    : '';
            }

            var html = '<thead><tr>';
            if (type === 'roledef') {
                html += '<th>Role</th><th class="nowrap">System</th><th class="nowrap">Overwrite to</th><th class="nowrap">Service</th><th>Justification</th><th class="no-sort"></th>';
            } else if (type === 'apipermission') {
                html += '<th>Permission</th><th class="nowrap">Type / App</th><th class="nowrap">System</th><th class="nowrap">Overwrite to</th><th>Justification</th><th class="no-sort"></th>';
            } else {
                html += '<th>Role actions</th><th class="nowrap">Scope</th><th class="nowrap">System</th><th class="nowrap">Overwrite to</th><th>Justification</th><th class="no-sort"></th>';
            }
            html += '</tr></thead><tbody>';

            if (!d.entries.length) {
                html += '<tr><td colspan="6"><div class="empty"><div class="big">&#9998;</div>No overwrite entries yet.<br>' +
                    'Load a template or tenant file, import a JSON file, or add an entry &mdash; also directly from your Review list.</div></td></tr>';
            } else {
                d.entries.forEach(function (e, idx) {
                    var warn = issueIdx[idx] ? ' <span class="chip attack" title="This entry has validation issues">&#9888;</span>' : '';
                    var tierCell = TIER_CHOICES.indexOf(e.EAMTierLevelName) !== -1 ? EOCE.util.tierBadge(e.EAMTierLevelName) : '<span class="chip">' + esc(e.EAMTierLevelName || '—') + '</span>';
                    html += '<tr data-idx="' + idx + '">';
                    if (type === 'roledef') {
                        html += '<td><span class="cell-strong">' + esc(e.RoleDefinitionName || '(by ID only)') + '</span>' + warn +
                            (e.RoleDefinitionId ? '<div class="cell-mono muted" style="font-size:11px;">' + esc(e.RoleDefinitionId) + '</div>' : '') + '</td>' +
                            '<td class="muted nowrap">' + esc(sysShort(e.RbacSystem)) + '</td>' +
                            '<td>' + tierCell + '</td>' +
                            '<td class="muted nowrap">' + esc(e.Service || '—') + '</td>';
                    } else if (type === 'apipermission') {
                        html += '<td><span class="cell-strong cell-mono">' + esc(e.PermissionValue || '(not set)') + '</span>' + warn + '</td>' +
                            '<td class="muted nowrap">' + esc(e.PermissionType || 'All') +
                            (e.TargetAppId ? '<div class="cell-mono muted" style="font-size:11px;">' + esc(e.TargetAppId) + '</div>' : '') + '</td>' +
                            '<td class="muted nowrap">' + esc(sysShort(e.RbacSystem)) + '</td>' +
                            '<td>' + tierCell + '</td>';
                    } else {
                        var acts = e.RoleDefinitionActions || [];
                        var preview = acts.slice(0, 3).map(function (a) { return '<div class="cell-mono" style="font-size:11.5px;">' + esc(a) + '</div>'; }).join('');
                        html += '<td><span class="cell-strong">' + acts.length + ' action' + (acts.length === 1 ? '' : 's') + '</span>' + warn + preview +
                            (acts.length > 3 ? '<div class="muted" style="font-size:11px;">&hellip; ' + (acts.length - 3) + ' more</div>' : '') + '</td>' +
                            '<td class="muted nowrap cell-mono" style="font-size:11.5px;">' + esc((e.RoleAssignmentScopeName || []).join(', ')) + '</td>' +
                            '<td class="muted nowrap">' + esc(sysShort(e.RbacSystem)) + '</td>' +
                            '<td>' + tierCell + '</td>';
                    }
                    html += '<td class="muted">' + esc((e.Justification || '').length > 140 ? e.Justification.slice(0, 140) + '…' : (e.Justification || '')) + '</td>' +
                        '<td class="nowrap" style="text-align:right;">' +
                        '<button class="btn small" data-edit="' + idx + '">Edit</button> ' +
                        '<button class="btn small" data-del="' + idx + '" title="Remove this entry">&#10005;</button></td>';
                    html += '</tr>';
                });
            }
            html += '</tbody>';

            var table = document.getElementById('custTable');
            table.innerHTML = html;

            table.querySelectorAll('[data-edit]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    self.openBlade(parseInt(b.getAttribute('data-edit'), 10));
                });
            });
            table.querySelectorAll('[data-del]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    self.draft().entries.splice(parseInt(b.getAttribute('data-del'), 10), 1);
                    self.markDirty();
                    self.renderTable(); self.updateStatus();
                });
            });
            table.querySelectorAll('tbody tr[data-idx]').forEach(function (tr) {
                tr.addEventListener('click', function () { self.openBlade(parseInt(tr.getAttribute('data-idx'), 10)); });
            });
        },

        renderFooter: function () {
            var self = this;
            var footer = document.getElementById('custFooter');
            footer.innerHTML =
                '<button class="btn primary" id="custAdd">+ Add entry</button>' +
                '<span style="flex:1;"></span>' +
                '<button class="btn" id="custExport" title="Download the overwrite file as JSON">Export JSON</button>' +
                '<button class="btn primary" id="custSave" title="Save the overwrite file to disk (choose Classification/&lt;TenantName&gt;/ in your EntraOps repository)">Save&hellip;</button>';

            document.getElementById('custAdd').addEventListener('click', function () { self.openBlade(-1); });
            document.getElementById('custExport').addEventListener('click', function () { self.exportFile(false); });
            document.getElementById('custSave').addEventListener('click', function () { self.exportFile(true); });
        },

        renderHint: function () {
            var t = TYPES[this.state.type];
            document.getElementById('custHint').innerHTML =
                '<div class="callout-title">How EntraOps consumes ' + esc(t.fileName) + '</div>' + t.hint +
                '<div style="margin-top:8px;">Every entry requires a <strong>Justification</strong>; entries without one are skipped with a warning. ' +
                '<code>EAMTierLevelTagValue</code> is derived automatically from the tier name on export.</div>';
        },

        // ---- Export / Save ----------------------------------------------------
        exportFile: function (useSavePicker) {
            var self = this;
            var type = this.state.type;
            var d = this.draft();
            var issues = validateEntries(type, d.entries);
            if (issues.length && !window.confirm('The draft has ' + issues.length + ' validation issue(s); EntraOps will skip those entries. Continue anyway?')) return;

            var jsonText = JSON.stringify(serializeEntries(type, d.entries), null, 2) + '\n';
            var fileName = TYPES[type].fileName;

            function done() {
                d.dirty = false;
                persistDrafts(self.drafts);
                self.updateStatus();
            }

            if (useSavePicker && window.showSaveFilePicker) {
                saveWithPicker(fileName, jsonText).then(done).catch(function (err) {
                    if (err && err.name === 'AbortError') return; // user cancelled
                    downloadJson(fileName, jsonText);
                    done();
                });
            } else {
                downloadJson(fileName, jsonText);
                done();
            }
        },

        // ---- Blade (add / edit entry) ------------------------------------------
        openBlade: function (editIndex) {
            var self = this;
            var type = this.state.type;
            var entry = editIndex >= 0
                ? JSON.parse(JSON.stringify(this.draft().entries[editIndex]))
                : normalizeEntry(type, { RbacSystem: TYPES[type].systems[0], EAMTierLevelName: '' });
            this.form = { editIndex: editIndex, entry: entry, roleQ: '', actionQ: '', permQ: '', currentTier: null };

            var title = (editIndex >= 0 ? 'Edit' : 'Add') + ' overwrite entry';
            EOCE.app.openDrawer(esc(TYPES[type].title), title, this.bladeHtml());
            this.bindBlade();
        },

        bladeHtml: function () {
            var type = this.state.type;
            var e = this.form.entry;
            var html = '<div class="cust-form">';

            // RBAC system
            html += '<label class="f-label">RBAC system</label>' +
                '<select class="filter f-input" id="cfSys">' +
                TYPES[type].systems.map(function (s) {
                    return '<option value="' + esc(s) + '"' + (e.RbacSystem === s ? ' selected' : '') + '>' + esc(sysShort(s)) + ' (' + esc(s) + ')</option>';
                }).join('') + '</select>';

            if (type === 'roledef') {
                html += '<div class="section-title">Role definition</div>' +
                    '<p class="muted f-note">Pick a role from the current primary classification source, use an item from your Review list, or enter the role manually. RoleDefinitionId and/or RoleDefinitionName is required.</p>';
                html += '<div class="search" style="min-width:auto;"><span class="search-ico">&#128269;</span>' +
                    '<input id="cfRoleSearch" type="text" placeholder="Search classified roles (current primary source)&hellip;"></div>' +
                    '<div class="cust-pick" id="cfRoleResults"></div>';
                html += '<label class="f-label">RoleDefinitionId</label>' +
                    '<input class="f-input cell-mono" id="cfRoleId" type="text" value="' + esc(e.RoleDefinitionId) + '" placeholder="e.g. 62e90394-69f5-4237-9190-012177145e10">';
                html += '<label class="f-label">RoleDefinitionName</label>' +
                    '<input class="f-input" id="cfRoleName" type="text" value="' + esc(e.RoleDefinitionName) + '" placeholder="e.g. Global Administrator">';
                html += '<div id="cfCurrentTier"></div>';
            } else if (type === 'apipermission') {
                html += '<div class="section-title">API permission</div>' +
                    '<p class="muted f-note">Pick a permission from the API Permissions catalog (Classification_ApiPermissions.json), or enter it manually. PermissionValue is required.</p>';
                html += '<div class="search" style="min-width:auto;"><span class="search-ico">&#128269;</span>' +
                    '<input id="cfPermSearch" type="text" placeholder="Search API permissions&hellip;"></div>' +
                    '<div class="cust-pick" id="cfPermResults"></div>';
                html += '<label class="f-label">PermissionValue</label>' +
                    '<input class="f-input cell-mono" id="cfPermValue" type="text" value="' + esc(e.PermissionValue) + '" placeholder="e.g. User.ReadWrite.All">';
                html += '<label class="f-label">Target App ID <span class="muted">(optional &mdash; leave empty to match the permission in any resource app)</span></label>' +
                    '<input class="f-input cell-mono" id="cfPermAppId" type="text" value="' + esc(e.TargetAppId) + '" placeholder="e.g. 00000003-0000-0000-c000-000000000000 (Microsoft Graph)">';
                html += '<label class="f-label">Permission type <span class="muted">(optional)</span></label>' +
                    '<select class="filter f-input" id="cfPermType">' +
                    ['', 'All', 'Application', 'Delegated'].map(function (v) {
                        return '<option value="' + v + '"' + ((e.PermissionType || '') === v ? ' selected' : '') + '>' + (v || 'Not set (any)') + '</option>';
                    }).join('') + '</select>';
            } else {
                html += '<div class="section-title">Role definition actions</div>' +
                    '<p class="muted f-note">Add role actions from the current primary classification source (tenant-specific template when available, built-in otherwise), from your Review list &mdash; incl. all actions of a starred role &mdash; or manually.</p>';
                html += '<div class="cust-chips" id="cfActionChips"></div>';
                html += '<div class="cust-addrow"><input class="f-input cell-mono" id="cfActionManual" type="text" placeholder="Add action manually, e.g. microsoft.directory/devices/delete">' +
                    '<button class="btn small" id="cfActionManualAdd">Add</button></div>';
                html += '<div class="search" style="min-width:auto;margin-top:10px;"><span class="search-ico">&#128269;</span>' +
                    '<input id="cfActionSearch" type="text" placeholder="Search role actions in the primary source&hellip;"></div>' +
                    '<div class="muted f-note" id="cfActionSourceNote"></div>' +
                    '<div class="cust-pick" id="cfActionResults"></div>';
                html += '<label class="f-label">Role assignment scope(s) <span class="muted">(comma separated, wildcards allowed)</span></label>' +
                    '<input class="f-input cell-mono" id="cfScopes" type="text" value="' + esc((e.RoleAssignmentScopeName || []).join(', ')) + '" placeholder="/*">';
            }

            // Review list
            html += '<div class="section-title">&#9733; From your Review list</div><div id="cfReview"></div>';

            // Target tier
            html += '<div class="section-title">New classification</div>';
            html += '<label class="f-label">Tier level (EAMTierLevelName)</label>' +
                '<select class="filter f-input" id="cfTier"><option value=""' + (e.EAMTierLevelName ? '' : ' selected') + ' disabled>Select tier&hellip;</option>' +
                TIER_CHOICES.map(function (t) {
                    var tier = EOCE.tier(t);
                    return '<option value="' + t + '"' + (e.EAMTierLevelName === t ? ' selected' : '') + '>' + esc(tier.label) + ' (Tier ' + tier.tag + ')</option>';
                }).join('') + '</select>';
            html += '<div id="cfTierChange"></div>';
            html += '<label class="f-label">' + (type === 'apipermission' ? 'Category' : 'Service') + ' <span class="muted">(optional, shown as classification ' + (type === 'apipermission' ? 'category' : 'service') + ')</span></label>' +
                '<input class="f-input" id="cfService" type="text" value="' + esc(e.Service) + '" placeholder="e.g. Device Management">';
            html += '<label class="f-label">Justification <span class="chip attack" style="font-size:10px;">required</span></label>' +
                '<textarea class="f-input" id="cfJust" rows="3" placeholder="Document why this classification is changed, e.g. \'No privileged access workstation is present in the tenant.\'">' + esc(e.Justification) + '</textarea>';

            html += '<div id="cfError"></div>';
            html += '<div class="cust-blade-foot">' +
                '<button class="btn primary" id="cfApply">' + (this.form.editIndex >= 0 ? 'Update entry' : 'Add to file') + '</button>' +
                '<button class="btn" id="cfCancel">Cancel</button></div>';
            html += '</div>';
            return html;
        },

        bindBlade: function () {
            var self = this;
            var type = this.state.type;
            var e = this.form.entry;

            document.getElementById('cfSys').addEventListener('change', function (ev) {
                e.RbacSystem = ev.target.value;
                if (type === 'roledef') self.renderRoleResults();
                else if (type === 'roleaction') self.renderActionResults();
                self.renderReviewSection();
            });
            document.getElementById('cfTier').addEventListener('change', function (ev) {
                e.EAMTierLevelName = ev.target.value;
                self.updateTierChange();
            });
            document.getElementById('cfService').addEventListener('input', function (ev) { e.Service = ev.target.value.trim(); });
            document.getElementById('cfJust').addEventListener('input', function (ev) { e.Justification = ev.target.value.trim(); });

            if (type === 'roledef') {
                document.getElementById('cfRoleId').addEventListener('input', function (ev) { e.RoleDefinitionId = ev.target.value.trim(); });
                document.getElementById('cfRoleName').addEventListener('input', function (ev) { e.RoleDefinitionName = ev.target.value.trim(); });
                document.getElementById('cfRoleSearch').addEventListener('input', EOCE.util.debounce(function (ev) {
                    self.form.roleQ = ev.target.value.trim().toLowerCase();
                    self.renderRoleResults();
                }, 150));
                this.renderRoleResults();
                // When editing an existing entry, resolve the current classification
                // of the referenced role so the down-/upgrade indicator works immediately.
                if (e.RoleDefinitionId || e.RoleDefinitionName) {
                    loadRolesIndex().then(function (idx) {
                        var role = idx.byId[e.RbacSystem + '|' + e.RoleDefinitionId];
                        if (!role && e.RoleDefinitionName) {
                            role = idx.list.filter(function (r) {
                                return r.sysKey === e.RbacSystem && r.name.toLowerCase() === e.RoleDefinitionName.toLowerCase();
                            })[0];
                        }
                        if (role) {
                            self.form.currentTier = role.tier;
                            var cur = document.getElementById('cfCurrentTier');
                            if (cur) cur.innerHTML = '<div class="f-note" style="margin-top:6px;">Current classification: ' + EOCE.util.tierBadge(role.tier, { short: true }) + '</div>';
                            self.updateTierChange();
                        }
                    });
                }
            } else if (type === 'apipermission') {
                document.getElementById('cfPermValue').addEventListener('input', function (ev) { e.PermissionValue = ev.target.value.trim(); });
                document.getElementById('cfPermAppId').addEventListener('input', function (ev) { e.TargetAppId = ev.target.value.trim(); });
                document.getElementById('cfPermType').addEventListener('change', function (ev) { e.PermissionType = ev.target.value; });
                document.getElementById('cfPermSearch').addEventListener('input', EOCE.util.debounce(function (ev) {
                    self.form.permQ = ev.target.value.trim().toLowerCase();
                    self.renderPermissionResults();
                }, 150));
                this.renderPermissionResults();
            } else {
                document.getElementById('cfScopes').addEventListener('input', function (ev) {
                    e.RoleAssignmentScopeName = ev.target.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                });
                document.getElementById('cfActionManualAdd').addEventListener('click', function () {
                    var inp = document.getElementById('cfActionManual');
                    var val = inp.value.trim();
                    if (val) { self.addAction(val); inp.value = ''; }
                });
                document.getElementById('cfActionManual').addEventListener('keydown', function (ev) {
                    if (ev.key === 'Enter') { ev.preventDefault(); document.getElementById('cfActionManualAdd').click(); }
                });
                document.getElementById('cfActionSearch').addEventListener('input', EOCE.util.debounce(function (ev) {
                    self.form.actionQ = ev.target.value.trim().toLowerCase();
                    self.renderActionResults(true);
                }, 150));
                this.renderActionChips();
                this.renderActionResults();
            }

            this.renderReviewSection();
            this.updateTierChange();

            document.getElementById('cfApply').addEventListener('click', function () { self.applyBlade(); });
            document.getElementById('cfCancel').addEventListener('click', function () { EOCE.app.closeDrawer(); });
        },

        applyBlade: function () {
            var type = this.state.type;
            var e = this.form.entry;
            var problems = [];
            if (type === 'roledef' && !e.RoleDefinitionId && !e.RoleDefinitionName) problems.push('RoleDefinitionId or RoleDefinitionName is required.');
            if (type === 'roleaction' && !e.RoleDefinitionActions.length) problems.push('At least one role definition action is required.');
            if (type === 'apipermission' && !e.PermissionValue) problems.push('PermissionValue is required.');
            if (TIER_CHOICES.indexOf(e.EAMTierLevelName) === -1) problems.push('Select a tier level.');
            if (!e.Justification) problems.push('A Justification is mandatory.');
            if (problems.length) { showError('cfError', 'Please fix before applying:\n\n- ' + problems.join('\n- ')); return; }

            if (type === 'roleaction' && !e.RoleAssignmentScopeName.length) e.RoleAssignmentScopeName = ['/*'];
            if (this.form.editIndex >= 0) this.draft().entries[this.form.editIndex] = e;
            else this.draft().entries.push(e);
            this.markDirty();
            EOCE.app.closeDrawer();
            this.renderTable(); this.updateStatus();
        },

        // ---- Role picker (roledef) ----------------------------------------------
        renderRoleResults: function () {
            var self = this;
            var box = document.getElementById('cfRoleResults');
            if (!box) return;
            box.innerHTML = '<div class="muted f-note">Loading roles&hellip;</div>';
            loadRolesIndex().then(function (idx) {
                if (!document.getElementById('cfRoleResults')) return;
                var q = self.form.roleQ;
                var sys = self.form.entry.RbacSystem;
                var matches = idx.list.filter(function (r) {
                    if (r.sysKey !== sys) return false;
                    if (q && r.name.toLowerCase().indexOf(q) === -1 && r.id.toLowerCase().indexOf(q) === -1) return false;
                    return true;
                }).slice(0, 25);
                if (!matches.length) {
                    box.innerHTML = '<div class="muted f-note">No classified roles match' + (q ? ' "' + esc(q) + '"' : '') + ' for ' + esc(sysShort(sys)) + '. Defender has no per-role export &mdash; enter the role manually.</div>';
                    return;
                }
                box.innerHTML = matches.map(function (r, i) {
                    return '<div class="action-row cust-pick-row" data-pick="' + i + '" style="cursor:pointer;">' +
                        '<div style="min-width:0;"><div class="a-name">' + esc(r.name) + '</div>' +
                        '<div class="a-cat cell-mono">' + esc(r.id) + '</div></div>' +
                        EOCE.util.tierBadge(r.tier, { short: true }) + '</div>';
                }).join('');
                box.querySelectorAll('[data-pick]').forEach(function (row) {
                    row.addEventListener('click', function () {
                        var r = matches[parseInt(row.getAttribute('data-pick'), 10)];
                        self.selectRole(r);
                    });
                });
            });
        },

        selectRole: function (r) {
            var e = this.form.entry;
            e.RoleDefinitionId = r.id;
            e.RoleDefinitionName = r.name;
            this.form.currentTier = r.tier;
            var idEl = document.getElementById('cfRoleId');
            var nameEl = document.getElementById('cfRoleName');
            if (idEl) idEl.value = r.id;
            if (nameEl) nameEl.value = r.name;
            var cur = document.getElementById('cfCurrentTier');
            if (cur) {
                cur.innerHTML = '<div class="f-note" style="margin-top:6px;">Current classification: ' + EOCE.util.tierBadge(r.tier, { short: true }) + '</div>';
            }
            this.updateTierChange();
        },

        updateTierChange: function () {
            var box = document.getElementById('cfTierChange');
            if (!box) return;
            var cur = this.form.currentTier;
            var next = this.form.entry.EAMTierLevelName;
            if (!cur || TIER_CHOICES.indexOf(next) === -1) { box.innerHTML = ''; return; }
            var curTag = parseInt(EOCE.tier(cur).tag, 10);
            var nextTag = parseInt(EOCE.tier(next).tag, 10);
            var label, cls;
            if (isNaN(curTag) || isNaN(nextTag) || curTag === nextTag) { label = 'No tier change'; cls = ''; }
            else if (nextTag > curTag) { label = '&#8595; Downgrade (less privileged)'; cls = 'scope'; }
            else { label = '&#8593; Upgrade (more privileged)'; cls = 'warn'; }
            box.innerHTML = '<div class="f-note" style="margin-top:6px;">' + EOCE.util.tierBadge(cur, { short: true }) + ' &rarr; ' + EOCE.util.tierBadge(next, { short: true }) + ' <span class="chip ' + cls + '">' + label + '</span></div>';
        },

        // ---- Action picker (roleaction) ---------------------------------------------
        addAction: function (action) {
            var e = this.form.entry;
            var exists = e.RoleDefinitionActions.some(function (a) { return a.toLowerCase() === action.toLowerCase(); });
            if (!exists) e.RoleDefinitionActions.push(action);
            this.renderActionChips();
        },

        renderActionChips: function () {
            var self = this;
            var box = document.getElementById('cfActionChips');
            if (!box) return;
            var acts = this.form.entry.RoleDefinitionActions;
            if (!acts.length) {
                box.innerHTML = '<div class="muted f-note">No actions added yet.</div>';
                return;
            }
            box.innerHTML = acts.map(function (a, i) {
                return '<span class="chip cust-chip cell-mono">' + esc(a) + '<button type="button" class="cust-chip-x" data-rm="' + i + '" title="Remove">&#10005;</button></span>';
            }).join('');
            box.querySelectorAll('[data-rm]').forEach(function (b) {
                b.addEventListener('click', function () {
                    self.form.entry.RoleDefinitionActions.splice(parseInt(b.getAttribute('data-rm'), 10), 1);
                    self.renderActionChips();
                });
            });
        },

        renderActionResults: function (keepNote) {
            var self = this;
            var box = document.getElementById('cfActionResults');
            var note = document.getElementById('cfActionSourceNote');
            if (!box) return;
            var sys = this.form.entry.RbacSystem;
            var tpl = DEFINITION_FILES[sys];
            if (!tpl) { box.innerHTML = ''; if (note) note.textContent = ''; return; }
            var path = primaryPath(tpl);
            if (note && !keepNote) note.innerHTML = 'Primary source: <span class="cell-mono">' + esc(path.split('/').pop()) + '</span> &middot; ' + esc(sourceLabelForPath(path));
            box.innerHTML = '<div class="muted f-note">Loading actions&hellip;</div>';
            EOCE.data.loadRaw(path).catch(function () {
                // Fall back to the built-in template when the tenant copy cannot be loaded.
                return path === tpl ? [] : EOCE.data.loadRaw(tpl).catch(function () { return []; });
            }).then(function (def) {
                if (!document.getElementById('cfActionResults')) return;
                var q = self.form.actionQ;
                var all = flattenDefinition(def);
                if (!all.length) {
                    box.innerHTML = '<div class="muted f-note">No classification definition available for ' + esc(sysShort(sys)) + ' (source not embedded / reachable). Add actions manually or via the Review list.</div>';
                    return;
                }
                var matches = all.filter(function (a) {
                    return !q || a.action.toLowerCase().indexOf(q) !== -1 || (a.service || '').toLowerCase().indexOf(q) !== -1;
                }).slice(0, 25);
                if (!matches.length) { box.innerHTML = '<div class="muted f-note">No actions match "' + esc(q) + '".</div>'; return; }
                box.innerHTML = matches.map(function (a, i) {
                    return '<div class="action-row cust-pick-row" data-pick="' + i + '" style="cursor:pointer;">' +
                        '<div style="min-width:0;"><div class="a-name">' + esc(a.action) + '</div>' +
                        (a.service ? '<div class="a-cat">' + esc(a.service) + '</div>' : '') + '</div>' +
                        EOCE.util.tierBadge(a.tier, { short: true }) + '</div>';
                }).join('');
                box.querySelectorAll('[data-pick]').forEach(function (row) {
                    row.addEventListener('click', function () {
                        var a = matches[parseInt(row.getAttribute('data-pick'), 10)];
                        self.addAction(a.action);
                    });
                });
            });
        },

        // ---- Permission picker (apipermission) ---------------------------------
        // Searches the flat API permission catalog (Classification_ApiPermissions.json),
        // the same source Reports/ClassificationExplorer's Permissions view browses.
        renderPermissionResults: function () {
            var self = this;
            var box = document.getElementById('cfPermResults');
            if (!box) return;
            box.innerHTML = '<div class="muted f-note">Loading permissions&hellip;</div>';
            EOCE.data.load(PERMISSION_CATALOG_FILE).catch(function () { return []; }).then(function (all) {
                if (!document.getElementById('cfPermResults')) return;
                var q = self.form.permQ;
                var matches = (all || []).filter(function (p) {
                    if (!q) return true;
                    return String(p.PermissionValue || '').toLowerCase().indexOf(q) !== -1 ||
                        String(p.TargetAppDisplayName || '').toLowerCase().indexOf(q) !== -1 ||
                        String(p.Category || '').toLowerCase().indexOf(q) !== -1;
                }).slice(0, 25);
                if (!all.length) {
                    box.innerHTML = '<div class="muted f-note">API permission catalog not embedded / reachable. Add the permission manually.</div>';
                    return;
                }
                if (!matches.length) { box.innerHTML = '<div class="muted f-note">No permissions match "' + esc(q) + '".</div>'; return; }
                box.innerHTML = matches.map(function (p, i) {
                    return '<div class="action-row cust-pick-row" data-pick="' + i + '" style="cursor:pointer;">' +
                        '<div style="min-width:0;"><div class="a-name">' + esc(p.PermissionValue) + '</div>' +
                        '<div class="a-cat">' + esc(p.TargetAppDisplayName || '') + (p.PermissionType ? ' &middot; ' + esc(p.PermissionType) : '') + '</div></div>' +
                        (p.EAMTierLevelName ? EOCE.util.tierBadge(p.EAMTierLevelName, { short: true }) : '') + '</div>';
                }).join('');
                box.querySelectorAll('[data-pick]').forEach(function (row) {
                    row.addEventListener('click', function () {
                        self.selectPermission(matches[parseInt(row.getAttribute('data-pick'), 10)]);
                    });
                });
            });
        },

        selectPermission: function (p) {
            var e = this.form.entry;
            e.PermissionValue = p.PermissionValue || '';
            e.TargetAppId = p.TargetAppId || '';
            e.PermissionType = ['Application', 'Delegated'].indexOf(p.PermissionType) !== -1 ? p.PermissionType : '';
            var valEl = document.getElementById('cfPermValue');
            var appEl = document.getElementById('cfPermAppId');
            var typeEl = document.getElementById('cfPermType');
            if (valEl) valEl.value = e.PermissionValue;
            if (appEl) appEl.value = e.TargetAppId;
            if (typeEl) typeEl.value = e.PermissionType;
        },

        // ---- Review list section --------------------------------------------------
        renderReviewSection: function () {
            var self = this;
            var box = document.getElementById('cfReview');
            if (!box) return;
            var type = this.state.type;
            if (type === 'apipermission') {
                box.innerHTML = '<div class="muted f-note">Review-list linking is not yet available for API permissions &mdash; use the picker above or enter the permission manually.</div>';
                return;
            }
            var items = reviewItems().map(function (it) {
                return { item: it, res: resolveReviewItem(it) };
            }).filter(function (x) {
                if (!x.res) return false;
                if (type === 'roledef') return x.res.kind === 'role';
                return true; // role actions AND roles (add all actions of a role)
            });

            if (!items.length) {
                box.innerHTML = '<div class="muted f-note">No matching items on your Review list. Star roles' + (type === 'roleaction' ? ' or role actions' : '') + ' anywhere in the reporting apps to reuse them here.</div>';
                return;
            }

            box.innerHTML = items.map(function (x, i) {
                var it = x.item, res = x.res;
                var btn;
                if (type === 'roledef') {
                    btn = '<button class="btn small" data-rv="' + i + '">Use role</button>';
                } else if (res.kind === 'action') {
                    btn = '<button class="btn small" data-rv="' + i + '">Add action</button>';
                } else {
                    btn = '<button class="btn small" data-rv="' + i + '" title="Add every role action of this role\'s definition">Add all role actions</button>';
                }
                return '<div class="action-row" style="cursor:default;">' +
                    '<div style="min-width:0;"><div class="a-name">' + esc(it.name) + '</div>' +
                    '<div class="a-cat">' + esc(it.kind) + (it.system ? ' &middot; ' + esc(it.system) : '') + (it.tier ? '' : '') + '</div></div>' +
                    (it.tier ? EOCE.util.tierBadge(it.tier, { short: true }) : '') + btn + '</div>';
            }).join('');

            box.querySelectorAll('[data-rv]').forEach(function (b) {
                b.addEventListener('click', function () {
                    self.useReviewItem(items[parseInt(b.getAttribute('data-rv'), 10)]);
                });
            });
        },

        useReviewItem: function (x) {
            var self = this;
            var type = this.state.type;
            var res = x.res, item = x.item;
            var e = this.form.entry;

            if (type === 'roledef') {
                loadRolesIndex().then(function (idx) {
                    var role = (res.sysKey && res.roleId) ? idx.byId[res.sysKey + '|' + res.roleId] : null;
                    if (!role) {
                        // Fallback: match by role name across supported systems.
                        role = idx.list.filter(function (r) { return r.name.toLowerCase() === String(item.name).toLowerCase(); })[0];
                    }
                    if (role) {
                        if (TYPES.roledef.systems.indexOf(role.sysKey) !== -1 && e.RbacSystem !== role.sysKey) {
                            e.RbacSystem = role.sysKey;
                            var sysEl = document.getElementById('cfSys');
                            if (sysEl) sysEl.value = role.sysKey;
                        }
                        self.selectRole(role);
                    } else {
                        e.RoleDefinitionName = item.name;
                        var nameEl = document.getElementById('cfRoleName');
                        if (nameEl) nameEl.value = item.name;
                    }
                });
                return;
            }

            // roleaction mode
            if (res.kind === 'action') {
                if (res.sysKey && TYPES.roleaction.systems.indexOf(res.sysKey) !== -1 && e.RbacSystem !== res.sysKey) {
                    e.RbacSystem = res.sysKey;
                    var sysEl = document.getElementById('cfSys');
                    if (sysEl) sysEl.value = res.sysKey;
                    this.renderActionResults();
                }
                this.addAction(res.action);
                return;
            }

            // Role on the review list: add ALL role actions of its role definition.
            loadRolesIndex().then(function (idx) {
                var role = (res.sysKey && res.roleId) ? idx.byId[res.sysKey + '|' + res.roleId] : null;
                if (!role) role = idx.list.filter(function (r) { return r.name.toLowerCase() === String(item.name).toLowerCase(); })[0];
                if (!role) { showError('cfError', 'Could not resolve the role definition for "' + item.name + '" in the classified role exports.'); return; }
                if (!role.actions.length) { showError('cfError', 'The role "' + role.name + '" has no role actions in its definition.'); return; }
                if (TYPES.roleaction.systems.indexOf(role.sysKey) !== -1 && e.RbacSystem !== role.sysKey) {
                    e.RbacSystem = role.sysKey;
                    var sysEl = document.getElementById('cfSys');
                    if (sysEl) sysEl.value = role.sysKey;
                    self.renderActionResults();
                }
                role.actions.forEach(function (a) { self.addAction(a); });
            });
        }
    };

    return view;
})();
