/*
 * EntraOps Classification Explorer - Data loader & utilities
 */
window.EOCE = window.EOCE || {};

EOCE.util = (function () {
    var scriptPromises = {};

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
    //
    // Matching must skip over HTML entities. Searching the escaped text directly meant a term such as
    // "amp", "quot", "lt" or "39" matched inside &amp; / &quot; / &#39;, producing &<mark>amp</mark>;
    // which breaks the entity and leaks its raw text into the page. Anyone searching for "<" or "&" in
    // a role action hit this. The entity runs are therefore split out and passed through untouched,
    // and only the text between them is searched.
    function highlight(escaped, term) {
        if (!term) return escaped;
        var safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var matcher;
        try {
            matcher = new RegExp('(' + safe + ')', 'ig');
        } catch (e) {
            return escaped;
        }
        // Alternating segments: even indexes are plain text, odd indexes are whole entities.
        return String(escaped)
            .split(/(&(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)/)
            .map(function (segment, i) {
                if (i % 2 === 1) return segment;               // an entity - never highlight inside it
                matcher.lastIndex = 0;
                return segment.replace(matcher, '<mark>$1</mark>');
            })
            .join('');
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
    //
    // The result is also HTML-escaped, because every caller interpolates it straight into a
    // double-quoted href="..." attribute. Validating only the scheme left the rest of the string raw,
    // so a quote inside an otherwise valid https:// URL closed the attribute and allowed injecting an
    // event handler - e.g. front matter in content/attack-paths/*.md of the form
    //   basedOn: Researcher | https://example.com" onmouseover="...
    // Escaping here rather than at each call site keeps the guarantee with the function that callers
    // already trust to make a URL safe to emit.
    function safeUrl(url) {
        if (!url) return '#';
        var s = String(url).trim();
        return /^https?:\/\//i.test(s) ? escapeHtml(s) : '#';
    }

    function loadScript(src) {
        if (scriptPromises[src]) return scriptPromises[src];
        scriptPromises[src] = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = function () {
                delete scriptPromises[src];
                reject(new Error('Unable to load script: ' + src));
            };
            document.head.appendChild(script);
        });
        return scriptPromises[src];
    }

    function loadScripts(sources) {
        return sources.reduce(function (pending, src) {
            return pending.then(function () { return loadScript(src); });
        }, Promise.resolve());
    }

    return {
        escapeHtml: escapeHtml,
        debounce: debounce,
        highlight: highlight,
        tierBadge: tierBadge,
        formatNumber: formatNumber,
        highestTier: highestTier,
        safeUrl: safeUrl,
        loadScripts: loadScripts
    };
})();

EOCE.data = (function () {
    var cache = {};

    // All classification data is embedded at build/generation time into
    // window.EOCE_DATA (data/classification-data.js), keyed by repo-relative path,
    // by the mode-aware Update-EntraOpsClassificationExplorerData generator.
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
        return Promise.reject(new Error('"' + path + '" is not present in the embedded classification bundle. Run "' + EOCE.GENERATOR_COMMAND + '" to refresh data/classification-data.js.'));
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
