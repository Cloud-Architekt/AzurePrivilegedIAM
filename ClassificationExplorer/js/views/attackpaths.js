/*
 * Attack Paths - known privilege-escalation paths through classified roles & actions
 *
 * Defensive, descriptive view: it explains why specific Control Plane role
 * actions are dangerous and links each path to external write-ups, so defenders
 * can prioritise least privilege, scoping and monitoring.
 */
window.EOCE = window.EOCE || {};
EOCE.views = EOCE.views || {};

EOCE.views.attackpaths = {
    state: { q: '', sys: 'all', learnOnly: false },

    render: function (el, params) {
        var self = this;
        var sysKeys = EOCE.rolesSystemKeys();
        var rolePaths = sysKeys.map(function (k) { return EOCE.RBAC_SYSTEMS[k].file; });
        // Microsoft Learn permissions reference (currently EntraID only) - used to
        // mark path participants (roles / role actions) that only exist in the
        // documentation, not in any live Microsoft Graph role definition.
        var docsKeys = sysKeys.filter(function (k) { return EOCE.hasDocsCompare(k); });
        var docsPaths = docsKeys.map(function (k) { return EOCE.DOCS_COMPARE[k].file; });

        return Promise.all([EOCE.data.loadAll(rolePaths), EOCE.data.loadAll(docsPaths)]).then(function (res) {
            var sets = res[0], docsSets = res[1];
            // Resolve role names -> ids per system so chips can deep-link precisely.
            var roleIdByName = {};
            sysKeys.forEach(function (k, i) {
                sets[i].forEach(function (r) {
                    roleIdByName[k + '|' + String(r.RoleName).toLowerCase()] = r.RoleId;
                });
            });
            self.roleIdByName = roleIdByName;

            // Roles / role actions that are documented (Classification_*FromMsftDocs.json)
            // but do not exist in any live role definition - included via the
            // "Include Microsoft Learn-only" toolbar filter, same as the Roles and
            // Role Actions views.
            var docsRoleIdByName = {}, docsOnlyRoleNames = {}, docsOnlyActions = {};
            docsKeys.forEach(function (k, i) {
                var si = sysKeys.indexOf(k);
                var liveNames = {}, liveActions = {};
                if (si !== -1) {
                    sets[si].forEach(function (r) {
                        liveNames[String(r.RoleName).toLowerCase()] = true;
                        EOCE.rolePerms(r).forEach(function (p) {
                            if (p.AuthorizedResourceAction) liveActions[String(p.AuthorizedResourceAction).toLowerCase()] = true;
                        });
                    });
                }
                (docsSets[i] || []).forEach(function (r) {
                    if (!r || !r.RoleName) return;
                    var lname = String(r.RoleName).toLowerCase();
                    docsRoleIdByName[k + '|' + lname] = r.RoleId;
                    if (!liveNames[lname]) docsOnlyRoleNames[k + '|' + lname] = true;
                    EOCE.rolePerms(r).forEach(function (p) {
                        if (!p.AuthorizedResourceAction) return;
                        var laction = String(p.AuthorizedResourceAction).toLowerCase();
                        if (!liveActions[laction]) docsOnlyActions[k + '|' + laction] = true;
                    });
                });
            });
            self.docsRoleIdByName = docsRoleIdByName;
            self.docsOnlyRoleNames = docsOnlyRoleNames;
            self.docsOnlyActions = docsOnlyActions;

            if (params && params[0]) self.state.focus = params[0];

            var byTier = { ControlPlane: 0, ManagementPlane: 0, UserAccess: 0, Unclassified: 0 };
            EOCE.ATTACK_PATHS.forEach(function (p) {
                var t = EOCE.TIERS[p.targetTier] ? p.targetTier : 'Unclassified';
                byTier[t]++;
            });

            var html = '<div class="view">';
            html += '<div class="page-head"><h1>Attack Paths</h1>' +
                '<p>Well-documented privilege-escalation and lateral-movement paths that run through classified roles and role actions. ' +
                'Each path shows the enabling access plane operations, an escalation chain and references to public write-ups. ' +
                'Roles and role actions that participate in a path are tagged with an <span class="chip attack">\u26A0 attack path</span> badge throughout the explorer. ' +
                'This is a <strong>defensive</strong> aid for prioritising least privilege, scoping and monitoring \u2014 not a how-to.</p></div>';

            html += '<div class="grid cols-4" style="margin-bottom:20px;">';
            html += stat('Documented paths', EOCE.util.formatNumber(EOCE.ATTACK_PATHS.length), 'Across all RBAC systems', 'var(--brand)');
            html += stat('Reaching Control Plane', EOCE.util.formatNumber(byTier.ControlPlane), 'Tier 0 takeover potential', 'var(--tier-control)');
            html += stat('Entra ID paths', EOCE.util.formatNumber(countForSystem('EntraID')), 'Directory role escalation', 'var(--tier-management)');
            html += stat('Azure & Intune paths', EOCE.util.formatNumber(countForSystem('Azure') + countForSystem('DeviceManagement')), 'Resource & endpoint abuse', 'var(--tier-user)');
            html += '</div>';

            html += '<div class="callout" style="margin-bottom:20px;"><div class="callout-title">Contribute an attack path</div>' +
                '<p style="margin:0 0 12px;">Share your own attack-path story or improve an existing entry by contributing to the Markdown catalog.</p>' +
                '<a class="btn primary" target="_blank" rel="noopener noreferrer" href="https://github.com/Cloud-Architekt/AzurePrivilegedIAM/tree/main/ClassificationExplorer/content/attack-paths">Contribute on GitHub &#8599;</a></div>';

            html += '<div id="apToolbar"></div>';
            html += '<div id="apGraph"></div>';
            html += '<div id="apList"></div>';
            html += self.creditsHtml();
            html += '</div>';
            el.innerHTML = html;

            self.renderToolbar();
            self.renderGraph();
            self.renderList();

            if (self.state.focus) self.focusPath(self.state.focus);
        });

        function stat(label, value, sub, accent) {
            return '<div class="stat"><span class="stat-accent" style="background:' + accent + '"></span>' +
                '<div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' +
                '<div class="stat-sub">' + sub + '</div></div>';
        }
        function countForSystem(sys) {
            return EOCE.ATTACK_PATHS.filter(function (p) { return self.systemsOf(p).indexOf(sys) !== -1; }).length;
        }
    },

    // Pseudo-system key used for API permission (App Role / Scope) participants,
    // which are not part of EOCE.RBAC_SYSTEMS but need a system tag / filter segment.
    PERM_SYS: 'ApiPermissions',

    // Distinct systems referenced by a path (via its actions, roles or API permissions).
    systemsOf: function (p) {
        var set = {};
        (p.actions || []).forEach(function (a) { set[a.sys] = true; });
        (p.roles || []).forEach(function (r) { set[r.sys] = true; });
        if ((p.permissions || []).length) set[this.PERM_SYS] = true;
        return Object.keys(set);
    },

    // Short display label for a system key. Falls back to the raw key so a
    // typo/unknown system in an attack-path markdown file can't crash the view.
    sysShort: function (sys) {
        if (sys === this.PERM_SYS) return 'API Permissions';
        return (EOCE.RBAC_SYSTEMS[sys] && EOCE.RBAC_SYSTEMS[sys].short) || sys;
    },

    // Whether a path's role / role action participant only exists in the
    // Microsoft Learn permissions reference, not in any live role definition.
    roleIsDocsOnly: function (sys, name) {
        return !!this.docsOnlyRoleNames[sys + '|' + String(name).toLowerCase()];
    },
    actionIsDocsOnly: function (sys, action) {
        return !!this.docsOnlyActions[sys + '|' + String(action).toLowerCase()];
    },

    // Resolve a role name to its deep link, preferring the live (Microsoft Graph)
    // role id and falling back to the Microsoft Learn-only role id, so a
    // Learn-only role chip still opens the exact role instead of just its
    // system's role list.
    roleGoto: function (sys, name) {
        var lname = String(name).toLowerCase();
        var id = this.roleIdByName[sys + '|' + lname] || this.docsRoleIdByName[sys + '|' + lname];
        return id ? 'roles/' + sys + '/' + encodeURIComponent(id) : 'roles/' + sys;
    },

    // A path's roles / role actions, hiding Microsoft Learn-only participants
    // unless the "Include Microsoft Learn-only" toolbar filter is on.
    visibleRoles: function (p) {
        var self = this;
        return (p.roles || []).filter(function (r) { return self.state.learnOnly || !self.roleIsDocsOnly(r.sys, r.name); });
    },
    visibleActions: function (p) {
        var self = this;
        return (p.actions || []).filter(function (a) { return self.state.learnOnly || !self.actionIsDocsOnly(a.sys, a.action); });
    },

    // Deep-link hash for an API permission chip/node: prefilter by Application
    // (Roles) / Delegated (Scopes) and prefill the search with the value.
    permGoto: function (perm) {
        var seg = String(perm.type || '').toLowerCase() === 'delegated' ? 'scopes' : 'roles';
        return 'permissions/' + seg + '/' + encodeURIComponent(perm.value);
    },

    // Community researchers whose public work these attack paths are based on.
    CREDITS: [
        { name: 'Andy Robbins (SpecterOps / BloodHound)', url: 'https://posts.specterops.io/azure-privilege-escalation-via-azure-api-permissions-abuse-74aee1006f48' },
        { name: 'Fabian Bader (cloudbrothers.info)', url: 'https://cloudbrothers.info/en/azure-attack-paths/' },
        { name: 'Emilien Socchi (AzTier / aztier.com)', url: 'https://github.com/emiliensocchi/azure-tiering' },
        { name: 'Microsoft \u2014 Azure Threat Research Matrix (ATRM)', url: 'https://microsoft.github.io/Azure-Threat-Research-Matrix/' },
        { name: 'Dirk-jan Mollema (dirkjanm.io)', url: 'https://dirkjanm.io/azure-ad-privilege-escalation-application-admin/' },
        { name: 'Dr. Nestori Syynimaa (o365blog / AADInternals)', url: 'https://aadinternals.com/post/on-prem_admin/' },
        { name: 'Karl Fosaaen (NetSPI)', url: 'https://www.netspi.com/blog/technical/cloud-penetration-testing/abusing-azure-hybrid-workers-for-privilege-escalation/' },
        { name: 'Shaked Reiner (CyberArk)', url: 'https://www.cyberark.com/resources/threat-research-blog/golden-saml-newly-discovered-attack-technique-forges-authentication-to-cloud-apps' },
        { name: 'Sami Lamppu & Thomas Naunheim (AzureAD-Attack-Defense)', url: 'https://github.com/Cloud-Architekt/AzureAD-Attack-Defense' },
        { name: 'Thomas Naunheim (cloud-architekt.net)', url: 'https://www.cloud-architekt.net/' },
        { name: 'Thomas Naunheim \u2014 EntraOps (Identity Governance classification)', url: 'https://github.com/Cloud-Architekt/EntraOps' },
        { name: 'Microsoft Learn \u2014 Security & RBAC documentation', url: 'https://learn.microsoft.com/security/' },
        { name: 'Andreas Happe / m365internals', url: 'https://m365internals.com/2021/11/30/lateral-movement-with-managed-identities-of-azure-virtual-machines/' }
    ],

    creditsHtml: function () {
        var items = this.CREDITS.map(function (c) {
            return '<li><a href="' + EOCE.util.safeUrl(c.url) + '" target="_blank" rel="noopener noreferrer">' +
                EOCE.util.escapeHtml(c.name) + '</a></li>';
        }).join('');
        return '<div class="ap-credits">' +
            '<h2>Sources &amp; credits</h2>' +
            '<p>These attack paths are summarised from the public research of the security community. ' +
            'Full credit goes to the original authors \u2014 each path links to its specific write-up, and the researchers below ' +
            'are the primary sources for this catalogue.</p>' +
            '<ul class="ap-credits-list">' + items + '</ul></div>';
    },

    renderToolbar: function () {
        var self = this;
        var systems = {};
        EOCE.ATTACK_PATHS.forEach(function (p) { self.systemsOf(p).forEach(function (s) { systems[s] = true; }); });
        var sysKeys = Object.keys(EOCE.RBAC_SYSTEMS).filter(function (k) { return systems[k]; });
        if (systems[this.PERM_SYS]) sysKeys.push(this.PERM_SYS);

        var html = '<div class="toolbar">';
        html += '<div class="search"><span class="search-ico">&#128269;</span>' +
            '<input id="apSearch" type="text" placeholder="Search attack paths, roles, actions or permissions&hellip;" value="' + EOCE.util.escapeHtml(this.state.q) + '"></div>';
        html += '<div class="seg-group" id="apSysSeg"><button class="seg' + (this.state.sys === 'all' ? ' active' : '') + '" data-sys="all">All</button>';
        sysKeys.forEach(function (k) {
            html += '<button class="seg' + (self.state.sys === k ? ' active' : '') + '" data-sys="' + k + '">' + EOCE.util.escapeHtml(self.sysShort(k)) + '</button>';
        });
        html += '</div>';
        if (this.state.sys === 'all' || EOCE.hasDocsCompare(this.state.sys)) {
            html += '<label class="chip" style="cursor:pointer;gap:6px;" title="Include roles and role actions that only exist in the Microsoft Learn permissions reference and are not part of any live Microsoft Graph role definition"><input type="checkbox" id="apLearnOnly"' + (this.state.learnOnly ? ' checked' : '') + '> \u21C4 Include Microsoft Learn-only</label>';
        }
        html += '<span class="toolbar-meta" id="apCount"></span></div>';
        document.getElementById('apToolbar').innerHTML = html;

        document.getElementById('apSearch').addEventListener('input', EOCE.util.debounce(function (e) {
            self.state.q = e.target.value.trim(); self.renderGraph(); self.renderList();
        }, 180));
        document.getElementById('apSysSeg').addEventListener('click', function (e) {
            var b = e.target.closest('[data-sys]'); if (!b) return;
            self.state.sys = b.getAttribute('data-sys'); self.renderToolbar(); self.renderGraph(); self.renderList();
        });
        var learnOnlyToggle = document.getElementById('apLearnOnly');
        if (learnOnlyToggle) {
            learnOnlyToggle.addEventListener('change', function (e) {
                self.state.learnOnly = e.target.checked; self.renderGraph(); self.renderList();
            });
        }
    },

    filtered: function () {
        var self = this, s = this.state, q = s.q.toLowerCase();
        return EOCE.ATTACK_PATHS.filter(function (p) {
            if (s.sys !== 'all' && self.systemsOf(p).indexOf(s.sys) === -1) return false;
            if (q) {
                var hay = (p.name + ' ' + p.summary + ' ' + (p.steps || []).join(' ') + ' ' +
                    (p.actions || []).map(function (a) { return a.action; }).join(' ') + ' ' +
                    (p.roles || []).map(function (r) { return r.name; }).join(' ') + ' ' +
                    (p.permissions || []).map(function (x) { return x.value; }).join(' ')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
    },

    renderList: function () {
        var self = this;
        var paths = this.filtered();
        var html = '';

        if (!paths.length) {
            html = '<div class="empty"><div class="big">&#128269;</div>No attack paths match your filters.</div>';
        } else {
            paths.forEach(function (p) { html += self.cardHtml(p); });
        }
        var list = document.getElementById('apList');
        list.innerHTML = html;
        document.getElementById('apCount').textContent =
            EOCE.util.formatNumber(paths.length) + ' path' + (paths.length === 1 ? '' : 's');

        list.querySelectorAll('[data-goto]').forEach(function (node) {
            node.addEventListener('click', function (e) {
                e.preventDefault();
                EOCE.app.go(node.getAttribute('data-goto'));
            });
        });
    },

    cardHtml: function (p) {
        var self = this;
        var esc = EOCE.util.escapeHtml;
        var t = EOCE.tier(p.targetTier);
        var sevClass = p.severity === 'Critical' ? 'priv' : 'warn';

        var html = '<div class="card" id="ap-' + esc(p.id) + '" style="margin-bottom:16px;">';
        html += '<div class="card-head">' + esc(p.name) +
            '<span class="hint">' + self.systemsOf(p).map(function (s) { return esc(self.sysShort(s)); }).join(' &middot; ') + '</span></div>';
        html += '<div class="card-pad">';

        if (p.source) {
            html += '<div class="attack-byline">Source: ' +
                '<a href="' + EOCE.util.safeUrl(p.source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.source.name) + ' &#8599;</a></div>';
        }

        html += '<div class="attack-meta">' +
            '<span class="chip ' + sevClass + '">' + esc(p.severity) + '</span>' +
            EOCE.util.tierBadge(p.targetTier) +
            '<span class="muted" style="font-size:12.5px;">Reaches <strong>' + esc(t.label) + '</strong></span>' +
            '</div>';

        html += '<p style="margin:0 0 8px;font-size:13.5px;">' + esc(p.summary) + '</p>';
        if (p.prerequisite) {
            html += '<p class="muted" style="margin:0 0 12px;font-size:12.5px;"><strong>Prerequisite:</strong> ' + esc(p.prerequisite) + '</p>';
        }

        // Per-path BloodHound-style node/edge graph
        html += '<div class="section-title" style="margin-top:6px;">Attack graph</div>';
        html += self.pathGraphSvg(p);

        // Escalation chain
        html += '<div class="section-title" style="margin-top:6px;">Escalation chain</div>';
        html += '<div class="attack-chain">';
        (p.steps || []).forEach(function (step, i) {
            html += '<div class="attack-step"><div class="step-n">' + (i + 1) + '</div>' +
                '<div class="step-body">' + esc(step) + '</div></div>';
        });
        html += '</div>';

        // Enabling role actions
        if (p.actions && p.actions.length) {
            var visActions = self.visibleActions(p);
            var hiddenActions = p.actions.length - visActions.length;
            html += '<div class="section-title">Enabling role actions</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            visActions.forEach(function (a) {
                var sysShort = self.sysShort(a.sys);
                var docsOnly = self.actionIsDocsOnly(a.sys, a.action);
                html += '<a href="#actions/' + esc(a.sys) + '/' + encodeURIComponent(a.action) + '" ' +
                    'data-goto="actions/' + esc(a.sys) + '/' + encodeURIComponent(a.action) + '" ' +
                    'class="chip attack cell-mono" style="font-size:11.5px;cursor:pointer;" ' +
                    'title="' + esc(sysShort) + (docsOnly ? ' \u00b7 Microsoft Learn-only' : '') + ' \u00b7 open in Role Actions">' + esc(a.action) + '</a>';
                if (docsOnly) {
                    html += '<span class="chip docdiff" style="font-size:11px;" title="This role action only exists in the Microsoft Learn permissions reference - it is not part of any live Microsoft Graph role definition">\u21c4 Learn-only</span>';
                }
            });
            if (hiddenActions) {
                html += '<span class="chip docdiff" style="cursor:default;font-size:11px;" title="' + hiddenActions + ' role action(s) documented only in the Microsoft Learn permissions reference \u2014 enable \u201cInclude Microsoft Learn-only\u201d above to show">\u21c4 ' + hiddenActions + ' Learn-only hidden</span>';
            }
            html += '</div>';
        }

        // Enabling API permissions (App Roles / Scopes)
        if (p.permissions && p.permissions.length) {
            html += '<div class="section-title">Enabling API permissions</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            p.permissions.forEach(function (perm) {
                var goto = self.permGoto(perm);
                var typeLabel = perm.type ? (String(perm.type).toLowerCase() === 'delegated' ? 'Scope' : 'App role') : 'Permission';
                var title = (perm.app ? perm.app + ' · ' : '') + typeLabel + ' · open in API Permissions';
                html += '<a href="#' + esc(goto) + '" data-goto="' + esc(goto) + '" ' +
                    'class="chip attack cell-mono" style="font-size:11.5px;cursor:pointer;" ' +
                    'title="' + esc(title) + '">' + esc(perm.value) + '</a>';
            });
            html += '</div>';
        }

        // Enabling roles
        if (p.roles && p.roles.length) {
            var visRoles = self.visibleRoles(p);
            var hiddenRoles = p.roles.length - visRoles.length;
            html += '<div class="section-title">Commonly involved roles</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            visRoles.forEach(function (r) {
                var goto = self.roleGoto(r.sys, r.name);
                var docsOnly = self.roleIsDocsOnly(r.sys, r.name);
                html += '<a href="#' + esc(goto) + '" data-goto="' + esc(goto) + '" class="chip brand" style="cursor:pointer;" ' +
                    'title="Open in Roles' + (docsOnly ? ' \u00b7 Microsoft Learn-only' : '') + '">' + esc(r.name) + '</a>';
                if (docsOnly) {
                    html += '<span class="chip docdiff" style="font-size:11px;" title="This role only exists in the Microsoft Learn permissions reference - it is not returned by Microsoft Graph">\u21C4 Learn-only</span>';
                }
            });
            if (hiddenRoles) {
                html += '<span class="chip docdiff" style="cursor:default;font-size:11px;" title="' + hiddenRoles + ' role(s) documented only in the Microsoft Learn permissions reference \u2014 enable \u201cInclude Microsoft Learn-only\u201d above to show">\u21C4 ' + hiddenRoles + ' Learn-only hidden</span>';
            }
            html += '</div>';
        }

        if (p.mitigations && p.mitigations.length) {
            html += '<div class="section-title">Mitigations</div><ul class="attack-notes">';
            p.mitigations.forEach(function (mitigation) { html += '<li>' + esc(mitigation) + '</li>'; });
            html += '</ul>';
        }

        if (p.detection && p.detection.length) {
            html += '<div class="section-title">Detection</div><ul class="attack-notes">';
            p.detection.forEach(function (item) { html += '<li>' + esc(item) + '</li>'; });
            html += '</ul>';
        }

        // References
        if (p.references && p.references.length) {
            html += '<div class="section-title">References</div>';
            html += '<div class="attack-refs">';
            p.references.forEach(function (ref) {
                html += '<a href="' + EOCE.util.safeUrl(ref.url) + '" target="_blank" rel="noopener noreferrer" class="inline-link">' + esc(ref.title) + ' &#8599;</a>';
            });
            html += '</div>';
        }

        html += '</div></div>';
        return html;
    },

    // ---- Per-path BloodHound-style mini graph ----------------------------
    // A compact, static, layered node/edge diagram for a single attack path:
    // Technique -> Role(s) -> Role action(s) -> Control Plane target.
    // Role and action nodes deep-link (via data-goto) just like the chips.
    pathGraphSvg: function (p) {
        var self = this;
        var esc = EOCE.util.escapeHtml;
        var safeId = String(p.id).replace(/[^a-z0-9_-]/gi, '');
        var markerId = 'apaArrow-' + safeId;

        function shortAction(a) {
            var parts = String(a).split('/');
            return parts.length > 2 ? '\u2026/' + parts.slice(-2).join('/') : String(a);
        }
        function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

        // ---- build columns (skip empty role / action stages) --------------
        var tier = EOCE.tier(p.targetTier);
        var cols = [];
        cols.push([{ type: 'technique', label: clip(p.name, 22), full: p.name + ' \u2014 ' + p.severity, r: 13 }]);

        var roleNodes = self.visibleRoles(p).map(function (r) {
            var docsOnly = self.roleIsDocsOnly(r.sys, r.name);
            return {
                type: 'role', label: clip(r.name, 20),
                full: self.sysShort(r.sys) + ' \u00b7 ' + r.name + (docsOnly ? ' (Microsoft Learn-only)' : ''), r: 11,
                goto: self.roleGoto(r.sys, r.name)
            };
        });
        if (roleNodes.length) cols.push(roleNodes);

        var actionNodes = self.visibleActions(p).map(function (a) {
            var docsOnly = self.actionIsDocsOnly(a.sys, a.action);
            return {
                type: 'action', label: clip(shortAction(a.action), 20),
                full: self.sysShort(a.sys) + ' \u00b7 ' + a.action + (docsOnly ? ' (Microsoft Learn-only)' : ''), r: 9,
                goto: 'actions/' + a.sys + '/' + encodeURIComponent(a.action)
            };
        });
        var permNodes = (p.permissions || []).map(function (perm) {
            return {
                type: 'perm', label: clip(shortAction(perm.value), 20),
                full: self.sysShort(self.PERM_SYS) + ' \u00b7 ' + perm.value + (perm.type ? ' (' + perm.type + ')' : ''), r: 9,
                goto: self.permGoto(perm)
            };
        });
        // Role actions and API permissions share the "capability" column (both are
        // the dangerous operations that enable the escalation).
        var capNodes = actionNodes.concat(permNodes);
        if (capNodes.length) cols.push(capNodes);

        var targetNode = { type: 'tier', label: tier.label, full: tier.label + ' (Tier ' + tier.tag + ')', r: 15 };
        cols.push([targetNode]);

        // ---- geometry -----------------------------------------------------
        var W = 720, leftPad = 76, rightPad = 92;
        var maxRows = cols.reduce(function (m, c) { return Math.max(m, c.length); }, 1);
        // Fixed canvas so every card's mini graph renders at the same size; rows
        // are distributed (and gapped) to fit within the constant height.
        var H = 300;
        var rowGap = maxRows > 1 ? Math.min(70, (H - 80) / (maxRows - 1)) : 0;
        var colCount = cols.length;
        var innerW = W - leftPad - rightPad;
        cols.forEach(function (col, ci) {
            var x = colCount > 1 ? leftPad + innerW * (ci / (colCount - 1)) : W / 2;
            var totalH = (col.length - 1) * rowGap;
            var startY = H / 2 - totalH / 2;
            col.forEach(function (n, ri) { n.x = x; n.y = startY + ri * rowGap; });
        });

        // ---- edges (mirror buildGraph topology) ---------------------------
        var tech = cols[0][0];
        var edges = [];
        function connect(a, b) { edges.push([a, b]); }
        if (roleNodes.length) {
            roleNodes.forEach(function (rn) { connect(tech, rn); });
            if (capNodes.length) {
                roleNodes.forEach(function (rn) { capNodes.forEach(function (an) { connect(rn, an); }); });
            } else {
                roleNodes.forEach(function (rn) { connect(rn, targetNode); });
            }
        } else {
            capNodes.forEach(function (an) { connect(tech, an); });
        }
        capNodes.forEach(function (an) { connect(an, targetNode); });

        // ---- render -------------------------------------------------------
        var svg = '<svg class="ap-cg-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" ' +
            'aria-label="Attack path graph for ' + esc(p.name) + '">';
        svg += '<defs><marker id="' + markerId + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
            'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgba(120,130,150,.8)"></path></marker></defs>';

        // column captions
        var caps = ['Technique'];
        if (roleNodes.length) caps.push('Role');
        if (capNodes.length) caps.push(actionNodes.length && permNodes.length ? 'Action / permission' : (permNodes.length ? 'API permission' : 'Role action'));
        caps.push('Target');
        cols.forEach(function (col, ci) {
            svg += '<text class="ap-cg-col" x="' + col[0].x.toFixed(1) + '" y="16" text-anchor="middle">' + esc(caps[ci]) + '</text>';
        });

        // edges (drawn first so nodes sit on top)
        edges.forEach(function (e) {
            var s = e[0], t = e[1];
            var dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            var ux = dx / d, uy = dy / d;
            var x1 = s.x + ux * (s.r + 2), y1 = s.y + uy * (s.r + 2);
            var x2 = t.x - ux * (t.r + 5), y2 = t.y - uy * (t.r + 5);
            svg += '<line class="ap-edge" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' +
                x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" marker-end="url(#' + markerId + ')"></line>';
        });

        // nodes
        cols.forEach(function (col) {
            col.forEach(function (n) {
                var attrs = 'class="ap-node ap-' + n.type + '" transform="translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')"';
                if (n.goto) attrs += ' data-goto="' + esc(n.goto) + '" tabindex="0" role="link" style="cursor:pointer;"';
                svg += '<g ' + attrs + '>';
                svg += '<title>' + esc(n.full) + '</title>';
                svg += '<circle r="' + n.r + '"></circle>';
                svg += '<text class="ap-node-label ap-cg-label" x="0" y="' + (n.r + 14) + '" text-anchor="middle">' + esc(n.label) + '</text>';
                svg += '</g>';
            });
        });

        svg += '</svg>';
        return '<div class="ap-card-graph">' + svg + '</div>';
    },

    focusPath: function (id) {
        var node = document.getElementById('ap-' + id);
        if (!node) return;
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        node.style.transition = 'box-shadow .2s ease';
        node.style.boxShadow = '0 0 0 2px var(--tier-control)';
        setTimeout(function () { node.style.boxShadow = ''; }, 1600);
    },

    // ---- BloodHound-style attack graph -----------------------------------
    // Builds a directed node/edge graph from the (filtered) attack paths.
    // Node types: technique (the attack path), role, action, target tier.
    // Edges model: technique -> role -> action -> Control Plane target.
    buildGraph: function (paths) {
        var self = this, nodes = {}, edges = [], edgeSeen = {};
        function add(id, label, full, type, meta) {
            if (!nodes[id]) nodes[id] = { id: id, label: label, full: full || label, type: type, meta: meta || {}, deg: 0 };
            return nodes[id];
        }
        function link(s, t, rel) {
            var key = s + '\u2192' + t;
            if (edgeSeen[key]) return;
            edgeSeen[key] = 1;
            edges.push({ s: s, t: t, rel: rel });
            if (nodes[s]) nodes[s].deg++; if (nodes[t]) nodes[t].deg++;
        }
        function shortAction(a) {
            var parts = String(a).split('/');
            return parts.length > 2 ? '\u2026/' + parts.slice(-2).join('/') : a;
        }

        paths.forEach(function (p) {
            var tier = EOCE.tier(p.targetTier);
            var targetId = 'tier:' + p.targetTier;
            add(targetId, tier.label, tier.label + ' (Tier ' + tier.tag + ')', 'tier', { tier: p.targetTier });

            var techId = 'tech:' + p.id;
            add(techId, p.name, p.name + ' \u2014 ' + p.severity + (p.source ? ' \u00b7 by ' + p.source.name : ''), 'technique', { path: p, severity: p.severity });

            var roleNodes = self.visibleRoles(p).map(function (r) {
                var id = 'role:' + r.sys + '|' + String(r.name).toLowerCase();
                var docsOnly = self.roleIsDocsOnly(r.sys, r.name);
                return add(id, r.name, self.sysShort(r.sys) + ' \u00b7 ' + r.name + (docsOnly ? ' (Microsoft Learn-only)' : ''), 'role', { sys: r.sys, name: r.name, docsOnly: docsOnly });
            });
            var actionNodes = self.visibleActions(p).map(function (a) {
                var id = 'action:' + a.sys + '|' + String(a.action).toLowerCase();
                var docsOnly = self.actionIsDocsOnly(a.sys, a.action);
                return add(id, shortAction(a.action), self.sysShort(a.sys) + ' \u00b7 ' + a.action + (docsOnly ? ' (Microsoft Learn-only)' : ''), 'action', { sys: a.sys, action: a.action, docsOnly: docsOnly });
            });
            var permNodes = (p.permissions || []).map(function (perm) {
                var id = 'perm:' + String(perm.value).toLowerCase() + '|' + String(perm.type || '').toLowerCase();
                return add(id, shortAction(perm.value), self.sysShort(self.PERM_SYS) + ' \u00b7 ' + perm.value + (perm.type ? ' (' + perm.type + ')' : ''), 'perm', { perm: perm });
            });
            // Role actions and API permissions are the enabling "capabilities" and
            // share the same position in the escalation topology.
            var capNodes = actionNodes.concat(permNodes);

            if (roleNodes.length) {
                roleNodes.forEach(function (rn) { link(techId, rn.id, 'enables'); });
                if (capNodes.length) {
                    roleNodes.forEach(function (rn) { capNodes.forEach(function (an) { link(rn.id, an.id, 'can use'); }); });
                } else {
                    roleNodes.forEach(function (rn) { link(rn.id, targetId, 'escalates to'); });
                }
            } else {
                capNodes.forEach(function (an) { link(techId, an.id, 'abuses'); });
            }
            capNodes.forEach(function (an) { link(an.id, targetId, 'escalates to'); });
        });

        return { nodes: Object.keys(nodes).map(function (k) { return nodes[k]; }), edges: edges };
    },

    renderGraph: function () {
        var self = this;
        if (self._raf) { cancelAnimationFrame(self._raf); self._raf = null; }

        var host = document.getElementById('apGraph');
        if (!host) return;
        var g = this.buildGraph(this.filtered());

        if (!g.nodes.length) {
            host.innerHTML = '<div class="ap-graph-panel"><div class="empty" style="padding:30px;"><div class="big">&#128376;</div>No graph for the current filter.</div></div>';
            return;
        }

        var maxed = !!this.state.graphMax;
        var NS = 'http://www.w3.org/2000/svg';

        host.innerHTML =
            '<div class="ap-graph-panel' + (maxed ? ' maximized' : '') + '">' +
            '<div class="ap-graph-bar">' +
            '<span class="ap-graph-title">Attack graph</span>' +
            '<span class="ap-graph-meta">' + g.nodes.length + ' nodes \u00b7 ' + g.edges.length + ' edges \u2014 drag nodes to explore, click a role or action to open it</span>' +
            '<button class="seg" id="apGraphReplay" title="Re-run layout">&#8635; Re-layout</button>' +
            '<button class="seg" id="apGraphMax" title="' + (maxed ? 'Exit full screen (Esc)' : 'Maximize the graph') + '">' +
            (maxed ? '&#10005; Exit full screen' : '&#9974; Maximize') + '</button>' +
            '</div>' +
            '<div class="ap-graph-legend">' +
            '<span class="lg lg-technique"><i></i>Attack technique</span>' +
            '<span class="lg lg-role"><i></i>Role</span>' +
            '<span class="lg lg-action"><i></i>Role action</span>' +
            '<span class="lg lg-perm"><i></i>API permission</span>' +
            '<span class="lg lg-tier"><i></i>Control Plane target</span>' +
            '</div>' +
            '<div class="ap-graph-canvas" id="apGraphCanvas"></div>' +
            '</div>';

        var canvas = document.getElementById('apGraphCanvas');
        // A `transform` on the `.view` ancestor (entrance animation) would make it
        // the containing block for our position:fixed panel, breaking full screen.
        // The transform comes from a CSS animation (which overrides inline styles),
        // so disable both the animation and transform while maximized.
        var viewEl = host.closest('.view');
        if (viewEl) {
            viewEl.style.animation = maxed ? 'none' : '';
            viewEl.style.transform = maxed ? 'none' : '';
        }
        // Measure the canvas AFTER the (possibly maximized) panel is in the DOM
        // so the force layout uses the real available space.
        var W = Math.max(canvas.clientWidth || host.clientWidth || 900, 320);
        var H = Math.max(canvas.clientHeight || 460, 320);

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'ap-graph-svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        var defs = document.createElementNS(NS, 'defs');
        defs.innerHTML =
            '<marker id="apArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
            '<path d="M0,0 L10,5 L0,10 z" fill="rgba(120,130,150,.75)"></path></marker>';
        svg.appendChild(defs);

        var zoomG = document.createElementNS(NS, 'g');
        svg.appendChild(zoomG);
        var edgeG = document.createElementNS(NS, 'g');
        var nodeG = document.createElementNS(NS, 'g');
        zoomG.appendChild(edgeG);
        zoomG.appendChild(nodeG);
        canvas.appendChild(svg);

        // ---- init node positions (circle) + radius/colour by type ----------
        var radius = { technique: 11, role: 9, action: 7, perm: 7, tier: 15 };
        var cx = W / 2, cy = H / 2;
        g.nodes.forEach(function (n, i) {
            var ang = (i / g.nodes.length) * Math.PI * 2;
            var rr = n.type === 'tier' ? 20 : 150 + (i % 5) * 18;
            n.x = cx + Math.cos(ang) * rr;
            n.y = cy + Math.sin(ang) * rr;
            n.vx = 0; n.vy = 0;
            n.r = radius[n.type] || 8;
        });
        var byId = {};
        g.nodes.forEach(function (n) { byId[n.id] = n; });

        // ---- build SVG elements -------------------------------------------
        g.edges.forEach(function (e) {
            e.line = document.createElementNS(NS, 'line');
            e.line.setAttribute('class', 'ap-edge');
            e.line.setAttribute('marker-end', 'url(#apArrow)');
            edgeG.appendChild(e.line);
        });

        g.nodes.forEach(function (n) {
            var grp = document.createElementNS(NS, 'g');
            grp.setAttribute('class', 'ap-node ap-' + n.type);
            var goto = null;
            if (n.type === 'action') goto = 'actions/' + n.meta.sys + '/' + encodeURIComponent(n.meta.action);
            else if (n.type === 'perm') goto = self.permGoto(n.meta.perm);
            else if (n.type === 'role') goto = self.roleGoto(n.meta.sys, n.meta.name);
            if (goto) grp.style.cursor = 'pointer';

            var circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('r', n.r);
            grp.appendChild(circle);

            var title = document.createElementNS(NS, 'title');
            title.textContent = n.full;
            grp.appendChild(title);

            var label = document.createElementNS(NS, 'text');
            label.setAttribute('class', 'ap-node-label');
            label.setAttribute('x', n.r + 4);
            label.setAttribute('y', 4);
            label.textContent = n.label.length > 30 ? n.label.slice(0, 29) + '\u2026' : n.label;
            grp.appendChild(label);

            n.el = grp;
            n.goto = goto;
            nodeG.appendChild(grp);

            // drag + click
            grp.addEventListener('pointerdown', function (ev) {
                ev.preventDefault();
                n.dragging = true; n.fixed = true;
                n._moved = false;
                grp.setPointerCapture(ev.pointerId);
                self._alpha = Math.max(self._alpha || 0, 0.6);
                self._tick();
            });
            grp.addEventListener('pointermove', function (ev) {
                if (!n.dragging) return;
                var pt = self._toGraph(svg, zoomG, ev.clientX, ev.clientY);
                if (Math.abs(pt.x - n.x) > 2 || Math.abs(pt.y - n.y) > 2) n._moved = true;
                n.x = pt.x; n.y = pt.y; n.vx = 0; n.vy = 0;
                self._alpha = Math.max(self._alpha || 0, 0.3);
            });
            grp.addEventListener('pointerup', function (ev) {
                n.dragging = false; n.fixed = false;
                try { grp.releasePointerCapture(ev.pointerId); } catch (e) { }
                if (!n._moved && n.goto) EOCE.app.go(n.goto);
            });
        });

        document.getElementById('apGraphReplay').addEventListener('click', function () {
            g.nodes.forEach(function (n, i) {
                var ang = Math.random() * Math.PI * 2;
                n.x = cx + Math.cos(ang) * (60 + Math.random() * 150);
                n.y = cy + Math.sin(ang) * (60 + Math.random() * 110);
                n.vx = 0; n.vy = 0;
            });
            self._alpha = 1; self._tick();
        });

        document.getElementById('apGraphMax').addEventListener('click', function () {
            self.state.graphMax = !self.state.graphMax;
            self.renderGraph();
        });

        // Allow Esc to leave full screen (bound once).
        if (!self._escBound) {
            self._escBound = true;
            document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && self.state.graphMax) {
                    self.state.graphMax = false;
                    if (document.getElementById('apGraph')) self.renderGraph();
                }
            });
        }

        // ---- force simulation ---------------------------------------------
        this._graph = g; this._svg = svg; this._zoomG = zoomG; this._dims = { W: W, H: H, cx: cx, cy: cy };
        this._alpha = 1;

        this._step = function () {
            var nodes = g.nodes, edges = g.edges, a = self._alpha;
            var REP = 4200, SPRING = 0.035, LEN = 96, GRAV = 0.025, DAMP = 0.84;
            var i, j, n, m, dx, dy, d, f;
            // repulsion
            for (i = 0; i < nodes.length; i++) {
                n = nodes[i];
                for (j = i + 1; j < nodes.length; j++) {
                    m = nodes[j];
                    dx = n.x - m.x; dy = n.y - m.y;
                    d = Math.sqrt(dx * dx + dy * dy) || 0.5;
                    f = (REP / (d * d)) * a;
                    var ux = dx / d, uy = dy / d;
                    n.vx += ux * f; n.vy += uy * f;
                    m.vx -= ux * f; m.vy -= uy * f;
                }
            }
            // springs
            for (i = 0; i < edges.length; i++) {
                var s = byId[edges[i].s], tt = byId[edges[i].t];
                dx = tt.x - s.x; dy = tt.y - s.y;
                d = Math.sqrt(dx * dx + dy * dy) || 0.5;
                f = SPRING * (d - LEN) * a;
                var vx = (dx / d) * f, vy = (dy / d) * f;
                s.vx += vx; s.vy += vy; tt.vx -= vx; tt.vy -= vy;
            }
            // gravity + integrate
            for (i = 0; i < nodes.length; i++) {
                n = nodes[i];
                if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
                n.vx += (self._dims.cx - n.x) * GRAV * a;
                n.vy += (self._dims.cy - n.y) * GRAV * a;
                n.vx *= DAMP; n.vy *= DAMP;
                n.x += n.vx; n.y += n.vy;
                n.x = Math.max(n.r + 4, Math.min(self._dims.W - n.r - 4, n.x));
                n.y = Math.max(n.r + 4, Math.min(self._dims.H - n.r - 4, n.y));
            }
            self._alpha *= 0.985;
            self._paint();
        };

        this._paint = function () {
            g.edges.forEach(function (e) {
                var s = byId[e.s], t = byId[e.t];
                // stop the line at the target circle edge so the arrow head sits outside
                var dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                var tx = t.x - (dx / d) * (t.r + 3), ty = t.y - (dy / d) * (t.r + 3);
                e.line.setAttribute('x1', s.x); e.line.setAttribute('y1', s.y);
                e.line.setAttribute('x2', tx); e.line.setAttribute('y2', ty);
            });
            g.nodes.forEach(function (n) { n.el.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')'); });
        };

        this._tick = function () {
            if (self._raf) cancelAnimationFrame(self._raf);
            function loop() {
                if (!document.body.contains(svg)) { self._raf = null; return; }
                self._step();
                if (self._alpha > 0.015 || g.nodes.some(function (n) { return n.dragging; })) {
                    self._raf = requestAnimationFrame(loop);
                } else {
                    self._raf = null;
                }
            }
            self._raf = requestAnimationFrame(loop);
        };

        this._tick();
    },

    // Convert client (pointer) coords to graph coordinate space.
    _toGraph: function (svg, group, clientX, clientY) {
        var pt = svg.createSVGPoint();
        pt.x = clientX; pt.y = clientY;
        var ctm = group.getScreenCTM();
        if (!ctm) return { x: clientX, y: clientY };
        var inv = pt.matrixTransform(ctm.inverse());
        return { x: inv.x, y: inv.y };
    }
};
