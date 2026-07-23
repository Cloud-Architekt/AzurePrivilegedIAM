/*
 * EntraOps Classification Explorer - collapsible navigation rail
 *
 * Lets the left navigation rail be minimized to an icon-only strip so
 * investigations have more room on the main page. Icons always stay visible;
 * only the text labels, group headers and counters are hidden when collapsed
 * (native title tooltips are added so the labels remain discoverable on hover).
 * The preference is remembered in localStorage under the same key used by
 * every sibling reporting app served from the same origin (in entraops mode),
 * so it follows the user when navigating between apps; in standalone mode it
 * simply persists for this single app.
 *
 * This file is intentionally identical between the standalone and entraops
 * copies of this app - see js/review.js for the same pattern.
 */
(function () {
    "use strict";

    var KEY = "entraops.navCollapsed";

    function apply(collapsed) {
        var nav = document.getElementById("nav");
        var btn = document.getElementById("navCollapseToggle");
        if (!nav) return;
        nav.classList.toggle("collapsed", collapsed);
        if (btn) {
            btn.innerHTML = collapsed ? "&#187;" : "&#171;";
            btn.title = collapsed ? "Expand navigation" : "Collapse navigation";
            btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        }
        // Native tooltips for icon-only items - cache the label once so
        // re-collapsing doesn't re-read the (by then hidden) label spans.
        nav.querySelectorAll(".nav-item").forEach(function (el) {
            if (collapsed) {
                if (!el.dataset.eoNavLabel) {
                    var label = Array.prototype.slice.call(el.querySelectorAll("span"))
                        .filter(function (s) { return !s.classList.contains("ico") && !s.classList.contains("count"); })
                        .map(function (s) { return s.textContent.trim(); })
                        .filter(Boolean)
                        .join(" ");
                    el.dataset.eoNavLabel = label || el.textContent.trim();
                }
                el.title = el.dataset.eoNavLabel;
            } else {
                el.removeAttribute("title");
            }
        });
    }

    function init() {
        var nav = document.getElementById("nav");
        var btn = document.getElementById("navCollapseToggle");
        if (!nav || !btn) return;

        var stored = null;
        try {
            stored = localStorage.getItem(KEY);
        } catch (e) { /* private mode */ }
        apply(stored === "1");

        btn.addEventListener("click", function () {
            var next = !nav.classList.contains("collapsed");
            apply(next);
            try {
                localStorage.setItem(KEY, next ? "1" : "0");
            } catch (e) { /* private mode */ }
        });

        window.addEventListener("storage", function (e) {
            // Keep multiple open tabs/apps in sync when the preference changes elsewhere.
            if (e.key === KEY) apply(e.newValue === "1");
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
