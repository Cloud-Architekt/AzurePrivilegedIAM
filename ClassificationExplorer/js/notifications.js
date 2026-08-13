/* Shared EntraOps report notification panel. Keep byte-identical across report apps. */
(function (global) {
    "use strict";

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function init(options) {
        var button = document.getElementById("notificationButton");
        if (!button) return;

        var items = Array.isArray(options.items) ? options.items : [];
        var changeSetId = String(options.changeSetId || "none");
        var loadPromise = null;
        var storageKey = "entraops.notifications.read." + options.appId;
        var isRead = false;
        try { isRead = localStorage.getItem(storageKey) === changeSetId; } catch (e) { /* private mode */ }
        var backdrop = document.createElement("div");
        backdrop.className = "eo-notification-backdrop";
        var panel = document.createElement("aside");
        panel.className = "eo-notification-panel";
        panel.setAttribute("aria-hidden", "true");
        panel.setAttribute("aria-labelledby", "notificationTitle");
        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        function updateCount() {
            var count = isRead ? 0 : items.length;
            var badge = button.querySelector(".eo-notification-count");
            badge.textContent = count > 99 ? "99+" : String(count);
            badge.hidden = count === 0;
            button.setAttribute("aria-label", count ? count + " unread changes" : "No unread changes");
        }

        function markRead() {
            isRead = true;
            try { localStorage.setItem(storageKey, changeSetId); } catch (e) { /* private mode */ }
            updateCount();
        }

        function load() {
            if (!options.load || loadPromise) return loadPromise || Promise.resolve();
            loadPromise = Promise.resolve(options.load()).then(function (result) {
                result = result || {};
                items = Array.isArray(result.items) ? result.items : [];
                changeSetId = String(result.changeSetId || result.id || "none");
                try { isRead = localStorage.getItem(storageKey) === changeSetId; } catch (e) { /* private mode */ }
                updateCount();
            });
            return loadPromise;
        }

        function close() {
            var wasOpen = panel.classList.contains("open");
            panel.classList.remove("open");
            backdrop.classList.remove("open");
            panel.setAttribute("aria-hidden", "true");
            if (wasOpen) EOCE.a11y.closeDialog(panel);
        }

        function render() {
            var body = items.length
                ? items.map(function (item) {
                    return '<a class="eo-notification-item" href="' + escapeHtml(item.href || "#") + '" data-notification-link>' +
                        '<span class="eo-notification-kind">' + escapeHtml(item.kind || "Change") + ' · ' + escapeHtml(item.change || "Changed") + '</span>' +
                        '<span class="eo-notification-title">' + escapeHtml(item.title || "Classification changed") + '</span>' +
                        (item.detail ? '<span class="eo-notification-detail">' + escapeHtml(item.detail) + '</span>' : "") +
                        '</a>';
                }).join("")
                : '<div class="eo-notification-empty">No changes were detected in the latest report.</div>';
            panel.innerHTML =
                '<div class="eo-notification-head"><div><strong id="notificationTitle">Recent changes</strong>' +
                '<span>Since the previous classification report</span></div>' +
                '<button type="button" class="eo-notification-close" aria-label="Close notifications">&#10005;</button></div>' +
                '<div class="eo-notification-body">' + body + '</div>';
            panel.querySelector(".eo-notification-close").addEventListener("click", close);
            panel.querySelectorAll("[data-notification-link]").forEach(function (link) {
                link.addEventListener("click", markRead);
            });
        }

        button.addEventListener("click", function () {
            load().catch(function () { items = []; }).then(function () {
                render();
                panel.classList.add("open");
                backdrop.classList.add("open");
                panel.setAttribute("aria-hidden", "false");
                EOCE.a11y.openDialog(panel, panel.querySelector(".eo-notification-close"));
                markRead();
            });
        });
        backdrop.addEventListener("click", close);
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") close();
        });
        window.addEventListener("hashchange", function () {
            if (panel.classList.contains("open")) markRead();
            close();
        });
        updateCount();
    }

    global.EONotifications = { init: init };
})(window);
