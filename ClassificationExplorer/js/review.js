/*
 * EntraOps Classification Explorer - Review list
 *
 * A lightweight "shortlist" for roles, role actions (including their scope) and
 * - when embedded in the EntraOps reporting portal alongside sibling apps (EAM
 * Dashboard, Access Path Map, Tier Breach Analyzer, ...) - privileged principals:
 * items can be starred anywhere and are kept in localStorage (so the list survives
 * reloads/browser restarts and, in entraops mode, is shared across every reporting
 * app served from the same origin) with a deep link that jumps back to the exact
 * place where an item was selected. Useful for collecting findings while triaging
 * the classification before writing them up.
 *
 * This file is intentionally identical between the standalone and entraops copies
 * of this app (see js/mode.js / EOCE.isEntraOpsMode()).
 *
 * API: window.EOReview
 *   init({ app, appLabel })   wire the appbar button + panel for this app
 *   makeId(parts...)          stable item id
 *   has(id) / toggle(item) / remove(id) / clear() / all() / count()
 *   starHtml(id, extraClass)  markup for a star toggle button
 *   updateStar(btn, on)       sync a star button's visual state
 */
(function () {
    "use strict";

    var KEY = "entraops.reviewList.v1";
    var APP = { id: "", label: "" };

    function esc(s) {
        return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // ---- Storage -------------------------------------------------------------
    function load() {
        try {
            var raw = localStorage.getItem(KEY);
            var list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function save(list) {
        try {
            localStorage.setItem(KEY, JSON.stringify(list));
        } catch (e) { /* storage unavailable (private mode etc.) */ }
        refreshCount();
        if (panelEl && panelEl.classList.contains("open")) renderPanel();
    }

    function makeId() {
        return Array.prototype.slice.call(arguments).join("|");
    }

    function all() { return load(); }
    function count() { return load().length; }
    function has(id) {
        return load().some(function (i) { return i.id === id; });
    }
    // Set of all item ids, computed once from a single localStorage read. Use this
    // (plus starHtml's optional knownOn param) instead of has()/starHtml() per row
    // when rendering many rows - has()/starHtml() alone re-read and re-parse
    // localStorage on every single call, which adds up at large table sizes.
    function idsSet() {
        var set = new Set();
        load().forEach(function (i) { set.add(i.id); });
        return set;
    }

    function remove(id) {
        save(load().filter(function (i) { return i.id !== id; }));
    }

    function clear() { save([]); }

    /*
     * item: { id, kind ('Role'|'Role action'|'Permission'|'Principal'), system, name,
     *         scope, tier, hash (location hash for the deep link) }
     * app/appLabel/addedAt are filled in automatically.
     * Returns true when the item was added, false when it was removed.
     */
    function toggle(item) {
        var list = load();
        var idx = -1;
        list.forEach(function (i, n) { if (i.id === item.id) idx = n; });
        if (idx >= 0) {
            list.splice(idx, 1);
            save(list);
            return false;
        }
        list.push({
            id: item.id,
            kind: item.kind || "Role",
            system: item.system || "",
            name: item.name || "",
            scope: item.scope || "",
            tier: item.tier || "",
            hash: item.hash || "",
            app: APP.id,
            appLabel: APP.label,
            addedAt: new Date().toISOString(),
        });
        save(list);
        return true;
    }

    // ---- Deep links ------------------------------------------------------------
    function linkFor(item) {
        // In entraops mode, sibling apps live in sibling folders below Reports/, so a
        // relative link keeps working wherever the portal is hosted (file://, static
        // web server, ...). In standalone mode every item's app is always this app.
        var base = item.app === APP.id ? "index.html" : "../" + item.app + "/index.html";
        return base + (item.hash || "");
    }

    // ---- Star buttons ------------------------------------------------------------
    // knownOn: pass a precomputed boolean (e.g. from idsSet().has(id)) to skip the
    // internal has() lookup - important when rendering many rows, since has() alone
    // re-reads and re-parses localStorage on every call.
    function starHtml(id, extraClass, knownOn) {
        var on = typeof knownOn === "boolean" ? knownOn : has(id);
        return (
            '<button type="button" class="eo-star' + (on ? " on" : "") + (extraClass ? " " + extraClass : "") +
            '" title="' + (on ? "Remove from review list" : "Add to review list") +
            '" aria-label="' + (on ? "Remove from review list" : "Add to review list") +
            '" aria-pressed="' + (on ? "true" : "false") + '">' + (on ? "&#9733;" : "&#9734;") + "</button>"
        );
    }

    function updateStar(btn, on) {
        if (!btn) return;
        btn.classList.toggle("on", on);
        btn.innerHTML = on ? "&#9733;" : "&#9734;";
        btn.title = on ? "Remove from review list" : "Add to review list";
        btn.setAttribute("aria-label", btn.title);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    // ---- Appbar button + panel ------------------------------------------------------
    var badgeEl = null, panelEl = null, backdropEl = null;

    function refreshCount() {
        if (!badgeEl) return;
        var n = count();
        badgeEl.textContent = n;
        badgeEl.classList.toggle("empty", n === 0);
        // Stars elsewhere on the page may be stale (item removed via the panel).
        document.querySelectorAll(".eo-star[data-eo-id]").forEach(function (btn) {
            updateStar(btn, has(btn.getAttribute("data-eo-id")));
        });
    }

    function buildUi() {
        // Appbar button (inserted right after the flexible spacer).
        var appbar = document.querySelector(".appbar");
        var spacer = appbar ? appbar.querySelector(".spacer") : null;
        if (!spacer) return;

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "eo-review-btn";
        btn.innerHTML = '&#9733; <span class="eo-review-label">Review list</span> <span class="eo-review-count" id="eoReviewCount">0</span>';
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            openPanel();
        });
        spacer.insertAdjacentElement("afterend", btn);
        badgeEl = btn.querySelector(".eo-review-count");

        backdropEl = document.createElement("div");
        backdropEl.className = "eo-review-backdrop";
        backdropEl.addEventListener("click", closePanel);
        document.body.appendChild(backdropEl);

        panelEl = document.createElement("aside");
        panelEl.className = "eo-review-panel";
        panelEl.setAttribute("aria-label", "Review list");
        panelEl.setAttribute("aria-hidden", "true");
        document.body.appendChild(panelEl);

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closePanel();
        });
        // Keep the count in sync when another tab (or, in entraops mode, another
        // sibling reporting app) changes the list.
        window.addEventListener("storage", function (e) {
            if (e.key === KEY) {
                refreshCount();
                if (panelEl.classList.contains("open")) renderPanel();
            }
        });
        refreshCount();
    }

    function openPanel() {
        renderPanel();
        panelEl.classList.add("open");
        panelEl.setAttribute("aria-hidden", "false");
        backdropEl.classList.add("open");
        EOCE.a11y.openDialog(panelEl, panelEl.querySelector("[data-eo-close]"));
    }

    function closePanel() {
        if (!panelEl) return;
        var wasOpen = panelEl.classList.contains("open");
        panelEl.classList.remove("open");
        panelEl.setAttribute("aria-hidden", "true");
        backdropEl.classList.remove("open");
        if (wasOpen) EOCE.a11y.closeDialog(panelEl);
    }

    function tierChip(tier) {
        if (!tier) return "";
        var cls = {
            ControlPlane: "tier-controlplane",
            ManagementPlane: "tier-managementplane",
            WorkloadPlane: "tier-workloadplane",
            UserAccess: "tier-useraccess",
        }[tier] || "tier-unclassified";
        return '<span class="tier-badge ' + cls + '"><span class="tier-dot"></span>' + esc(tier) + "</span>";
    }

    function renderPanel() {
        var list = load();
        var sharedSub = (window.EOCE && EOCE.isEntraOpsMode && EOCE.isEntraOpsMode())
            ? " &middot; shared across all reporting tools" : "";
        var html =
            '<div class="eo-review-head"><span class="eo-review-title">&#9733; Review list</span>' +
            '<span class="eo-review-sub">' + list.length + " item(s)" + sharedSub + "</span>" +
            '<button type="button" class="eo-review-close" aria-label="Close review list" data-eo-close>&#10005;</button></div>' +
            '<div class="eo-review-body">';

        if (!list.length) {
            var otherApps = (window.EOCE && EOCE.isEntraOpsMode && EOCE.isEntraOpsMode())
                ? " in the Classification Explorer, the EAM Dashboard, the Access Path Map or the Tier Breach Analyzer"
                : " in the explorer";
            html +=
                '<div class="eo-review-empty">No items yet.<br><br>Use the &#9734; star next to a role, role action ' +
                "(incl. its scope) or permission" + otherApps + " to collect it here for review.</div>";
        } else {
            list.slice().reverse().forEach(function (item) {
                var kindChipCls = item.kind === "Role action" ? "docdiff" : (item.kind === "Permission" || item.kind === "Principal") ? "warn" : "brand";
                html +=
                    '<div class="eo-review-item">' +
                    '<div class="eo-review-item-head">' +
                    '<span class="chip ' + kindChipCls + '">' + esc(item.kind) + "</span>" +
                    tierChip(item.tier) +
                    '<button type="button" class="eo-review-remove" aria-label="Remove ' + esc(item.name) + ' from review list" data-eo-remove="' + esc(item.id) + '">&#10005;</button>' +
                    "</div>" +
                    '<div class="eo-review-item-name">' + esc(item.name) + "</div>" +
                    '<div class="eo-review-item-meta">' +
                    (item.system ? "<span><b>System:</b> " + esc(item.system) + "</span>" : "") +
                    (item.scope ? "<span><b>Scope:</b> " + esc(item.scope) + "</span>" : "") +
                    "</div>" +
                    '<div class="eo-review-item-foot">' +
                    ((window.EOCE && EOCE.isEntraOpsMode && EOCE.isEntraOpsMode())
                        ? '<span class="eo-review-source">from ' + esc(item.appLabel || item.app) + "</span>"
                        : "") +
                    '<a class="eo-review-open" href="' + esc(linkFor(item)) + '">Jump back &rarr;</a>' +
                    "</div></div>";
            });
        }
        html += "</div>";
        html +=
            '<div class="eo-review-foot">' +
            '<button type="button" class="btn small" data-eo-export' + (list.length ? "" : " disabled") + ">Export CSV</button>" +
            '<button type="button" class="btn small" data-eo-clear' + (list.length ? "" : " disabled") + ">Clear all</button>" +
            "</div>";

        panelEl.innerHTML = html;

        panelEl.querySelector("[data-eo-close]").addEventListener("click", closePanel);
        panelEl.querySelectorAll("[data-eo-remove]").forEach(function (b) {
            b.addEventListener("click", function () { remove(b.getAttribute("data-eo-remove")); });
        });
        var clearBtn = panelEl.querySelector("[data-eo-clear]");
        if (clearBtn) clearBtn.addEventListener("click", function () { clear(); });
        var exportBtn = panelEl.querySelector("[data-eo-export]");
        if (exportBtn) exportBtn.addEventListener("click", exportCsv);
        panelEl.querySelectorAll(".eo-review-open").forEach(function (a) {
            a.addEventListener("click", function () { closePanel(); });
        });
    }

    function exportCsv() {
        var cols = ["kind", "name", "system", "scope", "tier", "appLabel", "hash", "addedAt"];
        var head = ["Kind", "Name", "System", "Scope", "Tier", "Tool", "DeepLink", "AddedAt"];
        var cell = function (v) {
            var s = v === undefined || v === null ? "" : String(v);
            // Neutralise spreadsheet formula injection before RFC-4180 quoting. Excel and Sheets execute a
            // cell whose text begins with = + - @ (or a leading tab/CR), and these exports carry tenant
            // display names, which are attacker-influenceable (a guest can set their own). A leading
            // apostrophe forces the cell to be treated as literal text.
            var csvSafe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
            return /[",\n\r]/.test(csvSafe) ? '"' + csvSafe.replace(/"/g, '""') + '"' : csvSafe;
        };
        var lines = [head.join(",")];
        load().forEach(function (i) {
            lines.push(cols.map(function (c) { return cell(i[c]); }).join(","));
        });
        var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "entraops-review-list.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function init(opts) {
        APP.id = opts.app;
        APP.label = opts.appLabel || opts.app;
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", buildUi);
        } else {
            buildUi();
        }
    }

    window.EOReview = {
        init: init,
        makeId: makeId,
        all: all,
        count: count,
        has: has,
        idsSet: idsSet,
        toggle: toggle,
        remove: remove,
        clear: clear,
        starHtml: starHtml,
        updateStar: updateStar,
        refresh: refreshCount,
    };
})();
