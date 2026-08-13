import contextlib
import functools
import hashlib
import http.server
import json
import pathlib
import re
import threading
import unittest

from playwright.sync_api import sync_playwright


ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / "ClassificationExplorer"
ROUTES = (
    "dashboard",
    "model",
    "overview",
    "roles",
    "actions",
    "permissions",
    "attackpaths",
    "scoped",
    "overwrites",
    "history",
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextlib.contextmanager
def serve_app():
    handler = functools.partial(QuietHandler, directory=str(APP))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


class ClassificationExplorerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()
        cls.server = serve_app()
        cls.base_url = cls.server.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.__exit__(None, None, None)

    def setUp(self):
        self.page = self.browser.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.page.close()

    def open_route(self, route):
        self.page.goto(f"{self.base_url}/#{route}")
        self.page.wait_for_selector("#app h1")
        self.assertFalse(self.page.locator("#app .error-box").count())

    def test_all_routes_render_without_browser_errors(self):
        for route in ROUTES:
            with self.subTest(route=route):
                self.open_route(route)
                self.assertTrue(self.page.locator("#app h1").inner_text().strip())
        self.assertEqual([], self.errors)

    def test_secondary_bundles_load_only_on_demand(self):
        requested = []
        self.page.on("request", lambda request: requested.append(request.url))
        self.open_route("dashboard")
        self.assertEqual(0, sum(url.endswith("/assets/vendor/d3.min.js") for url in requested))
        self.assertEqual(0, sum(url.endswith("/assets/vendor/d3-sankey.min.js") for url in requested))

        self.page.evaluate("() => EOCE.app.go('overview')")
        self.page.wait_for_selector("#tmSankey")
        self.assertEqual(1, sum(url.endswith("/assets/vendor/d3.min.js") for url in requested))
        self.assertEqual(1, sum(url.endswith("/assets/vendor/d3-sankey.min.js") for url in requested))
        state = self.page.evaluate("() => [typeof window.EOCE_ATTACK_PATHS_MD, typeof window.EOCE_HISTORY, typeof window.EOCE_NOTIFICATION_DATA]")
        self.assertEqual(["undefined", "undefined", "object"], state)

        self.page.evaluate("() => EOCE.app.go('roles')")
        self.page.wait_for_function("() => typeof window.EOCE_ATTACK_PATHS_MD === 'object'")
        self.assertEqual("undefined", self.page.evaluate("() => typeof window.EOCE_HISTORY"))

        self.page.evaluate("() => document.getElementById('notificationButton').click()")
        self.page.wait_for_selector(".eo-notification-panel.open")
        self.assertEqual("undefined", self.page.evaluate("() => typeof window.EOCE_HISTORY"))

        self.page.evaluate("() => EOCE.app.go('history')")
        self.page.wait_for_function("() => typeof window.EOCE_HISTORY === 'object'")
        self.assertEqual(1, sum(url.endswith("/data/attack-paths.js") for url in requested))
        self.assertEqual(1, sum(url.endswith("/data/history-data.js") for url in requested))

    def test_large_tables_render_incrementally(self):
        self.open_route("roles")
        rows = self.page.locator("#rolesTable tbody tr[data-idx]")
        self.assertEqual(100, rows.count())
        self.page.locator("#rolesPager [data-show-more]").click()
        self.assertEqual(200, rows.count())

        search = self.page.locator("#rolesSearch")
        search.fill("Global Administrator")
        self.page.wait_for_function("() => document.querySelectorAll('#rolesTable tbody tr[data-idx]').length < 100")
        self.assertLess(rows.count(), 100)

    def test_mobile_layout_and_attack_graph(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.open_route("roles")
        layout = self.page.evaluate("""() => ({
            bodyOverflow: document.body.scrollWidth - innerWidth,
            navToggleVisible: getComputedStyle(document.getElementById('navToggle')).display !== 'none',
            tableOverflow: getComputedStyle(document.querySelector('.table-wrap')).overflowX
        })""")
        self.assertLessEqual(layout["bodyOverflow"], 0)
        self.assertTrue(layout["navToggleVisible"])
        self.assertEqual("auto", layout["tableOverflow"])

        self.open_route("attackpaths")
        self.page.wait_for_selector("#apGraph svg")
        graph = self.page.evaluate("""() => {
            const rect = document.querySelector('#apGraph svg').getBoundingClientRect();
            return { width: rect.width, height: rect.height, nodes: document.querySelectorAll('#apGraph circle').length };
        }""")
        self.assertGreater(graph["width"], 0)
        self.assertGreater(graph["height"], 0)
        self.assertGreater(graph["nodes"], 0)

    def test_accessibility_and_reduced_motion(self):
        self.open_route("roles")
        unnamed = self.page.evaluate("""() => [...document.querySelectorAll('#app input, #app select, #app button')]
            .filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') &&
                !(el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) &&
                !el.closest('label') &&
                !el.textContent.trim()).length""")
        self.assertEqual(0, unnamed)

        self.page.locator("#rolesTable tbody tr[data-idx]").first.click()
        self.assertEqual("dialog", self.page.locator("#drawer").get_attribute("role"))
        self.assertTrue(self.page.evaluate("() => document.getElementById('drawer').contains(document.activeElement)"))

        reduced = self.browser.new_page(reduced_motion="reduce")
        try:
            reduced.goto(f"{self.base_url}/#roles")
            reduced.wait_for_selector("#app h1")
            duration = reduced.locator(".drawer").evaluate("el => getComputedStyle(el).transitionDuration")
            self.assertIn(duration, ("0s", "1e-05s"))
        finally:
            reduced.close()

    def test_file_protocol_smoke(self):
        self.page.goto(APP.joinpath("index.html").as_uri() + "#overview")
        self.page.wait_for_selector("#app h1")
        self.assertFalse(self.page.locator("#app .error-box").count())
        self.assertEqual("file:", self.page.evaluate("() => location.protocol"))

    def test_security_utilities(self):
        self.open_route("overview")
        values = self.page.evaluate("""() => ({
            escaped: EOCE.util.escapeHtml('<script>"&'),
            safeHttps: EOCE.util.safeUrl('https://example.test/a?x=\"y'),
            rejectedJavascript: EOCE.util.safeUrl('javascript:alert(1)'),
            highlight: EOCE.util.highlight('A &amp; B', 'amp')
        })""")
        self.assertEqual("&lt;script&gt;&quot;&amp;", values["escaped"])
        self.assertEqual("https://example.test/a?x=&quot;y", values["safeHttps"])
        self.assertEqual("#", values["rejectedJavascript"])
        self.assertEqual("A &amp; B", values["highlight"])

    def test_generated_data_manifest_matches_sources_and_bundle(self):
        manifest = json.loads(APP.joinpath("data-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["fileCount"], len(manifest["files"]))
        for entry in manifest["files"]:
            source = ROOT / entry["path"]
            with self.subTest(source=entry["path"]):
                content = source.read_bytes()
                self.assertEqual(entry["bytes"], len(content))
                self.assertEqual(entry["sha256"], hashlib.sha256(content).hexdigest())

        bundle = APP.joinpath("data/classification-data.js").read_text(encoding="utf-8")
        match = re.search(r"window\.EOCE_DATA_MANIFEST\s*=\s*(\{.*?\});", bundle)
        self.assertIsNotNone(match)
        embedded = json.loads(match.group(1))
        self.assertEqual(manifest["mode"], embedded["mode"])
        self.assertEqual(manifest["fileCount"], embedded["fileCount"])
        expected = {(entry["path"], entry["items"], entry["sha256"]) for entry in manifest["files"]}
        actual = {(entry["path"], entry["items"], entry["sha256"]) for entry in embedded["files"]}
        self.assertEqual(expected, actual)

        history_text = APP.joinpath("data/history-data.js").read_text(encoding="utf-8")
        history = json.loads(re.search(r"window\.EOCE_HISTORY\s*=\s*(\{.*\});", history_text).group(1))
        notification_text = APP.joinpath("data/notification-data.js").read_text(encoding="utf-8")
        notification = json.loads(re.search(r"window\.EOCE_NOTIFICATION_DATA\s*=\s*(\{.*\});", notification_text).group(1))
        self.assertEqual(history["notification"], notification["notification"])
        for source_key in notification["notification"]["sourceKeys"]:
            self.assertEqual(history["sources"][source_key]["commits"][-1], notification["sources"][source_key]["commits"][0])


if __name__ == "__main__":
    unittest.main()
