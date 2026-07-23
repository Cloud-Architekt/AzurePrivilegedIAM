/*
 * EntraOps Classification Explorer - Data loader & utilities
 */
window.EOCE = window.EOCE || {};

EOCE.util = (function () {
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function debounce(fn, wait) {
        var t;
        return function () {
            var ctx = this;
            var args = arguments;
            clearTimeout(t);
            t = setTimeout(function () {
                fn.apply(ctx, args);
            }, wait || 200);
        };
    }

    // Highlight a search term inside an already escaped string.
    function highlight(escaped, term) {
        if (!term) return escaped;
        var safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            return escaped.replace(new RegExp('(' + safe + ')', 'ig'), '<mark>$1</mark>');
        } catch (e) {
            return escaped;
        }
    }

    function tierBadge(tierName, opts) {
        opts = opts || {};
        var t = EOCE.tier(tierName);
        var cls = 'tier-badge tier-' + t.key.toLowerCase();
        var dot = opts.dot === false ? '' : '<span class="tier-dot"></span>';
        var label = opts.short ? t.short : t.label;
        return '<span class="' + cls + '" title="' + escapeHtml(t.description) + '">' + dot + escapeHtml(label) + '</span>';
    }

    function formatNumber(n) {
        return (n || 0).toLocaleString('en-US');
    }

    // Compute the dominant (highest-privilege) tier from a list of tier names.
    function highestTier(tierNames) {
        for (var i = 0; i < EOCE.TIER_ORDER.length; i++) {
            if (tierNames.indexOf(EOCE.TIER_ORDER[i]) !== -1) return EOCE.TIER_ORDER[i];
        }
        return 'Unclassified';
    }

    // Return url only when it starts with https:// or http://, otherwise '#'.
    // Prevents javascript: and data: protocol injection from data-driven URLs.
    function safeUrl(url) {
        if (!url) return '#';
        var s = String(url).trim();
        return /^https?:\/\//i.test(s) ? s : '#';
    }

    return {
        escapeHtml: escapeHtml,
        debounce: debounce,
        highlight: highlight,
        tierBadge: tierBadge,
        formatNumber: formatNumber,
        highestTier: highestTier,
        safeUrl: safeUrl
    };
})();

EOCE.data = (function () {
    var cache = {};

    // All classification data is embedded at build/generation time into
    // window.EOCE_DATA (data/classification-data.js), keyed by repo-relative path,
    // by the (mode-aware) generator script - see Scripts/Update-EntraOpsClassificationExplorerData.ps1.
    // This is the only loading strategy: both the standalone and entraops
    // deployments run fully client-side from file:// with no web server and no
    // runtime fetch/manifest fallback. *.Param.json placeholders are already
    // sanitized into the embedded objects by the generator.
    function loadRaw(path) {
        if (cache[path]) return Promise.resolve(cache[path]);
        if (window.EOCE_DATA && Object.prototype.hasOwnProperty.call(window.EOCE_DATA, path)) {
            cache[path] = window.EOCE_DATA[path];
            return Promise.resolve(cache[path]);
        }
        // Resilience: a bundle generated under the other mode's template-base
        // convention (EntraOps_Classification/ vs Classification/Templates/) still
        // resolves, provided the basename matches - keeps older bundles working
        // across a TEMPLATE_BASE convention change.
        var bases = ['Classification/Templates/', 'EntraOps_Classification/'];
        for (var i = 0; i < bases.length; i++) {
            if (path.indexOf(bases[i]) !== 0) continue;
            var rest = path.slice(bases[i].length);
            for (var j = 0; j < bases.length; j++) {
                if (j === i) continue;
                var alt = bases[j] + rest;
                if (window.EOCE_DATA && Object.prototype.hasOwnProperty.call(window.EOCE_DATA, alt)) {
                    cache[path] = window.EOCE_DATA[alt];
                    return Promise.resolve(cache[path]);
                }
            }
        }
        return Promise.reject(new Error('"' + path + '" is not present in the embedded classification bundle. Re-run the generator script (Scripts/Update-EntraOpsClassificationExplorerData.ps1) to refresh data/classification-data.js.'));
    }

    // Variant resolution: when a tenant-specific classification source is selected
    // (entraops mode only), template paths are transparently remapped to
    // Classification/<TenantName>/. The cache is keyed by the resolved path, so
    // switching variants re-renders with the correct dataset without any cache
    // invalidation. No-op in standalone mode.
    function load(path) {
        return loadRaw(EOCE.resolveDataPath ? EOCE.resolveDataPath(path) : path);
    }

    function loadAll(paths) {
        return Promise.all(paths.map(load));
    }

    return { load: load, loadRaw: loadRaw, loadAll: loadAll, _cache: cache };
})();
