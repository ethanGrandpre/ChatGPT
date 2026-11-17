import asyncio
import unittest

from aiohttp import ClientSession, WSMsgType, web
from aiohttp.client_exceptions import WSServerHandshakeError

from . import server as server_module
from .server import BrowserService, public_address, resolve_public, target


class AddressAndNavigationTests(unittest.IsolatedAsyncioTestCase):
    def test_public_address_blocks_private_and_special_networks(self):
        for address in ("127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"):
            self.assertFalse(public_address(address), address)
        self.assertTrue(public_address("8.8.8.8"))
        self.assertTrue(public_address("2606:4700:4700::1111"))

    async def test_dns_rejects_a_mixed_public_and_private_result(self):
        async def mixed(*args, **kwargs):
            return [(2, 1, 6, "", ("8.8.8.8", 443)), (2, 1, 6, "", ("127.0.0.1", 443))]
        with self.assertRaises(ValueError):
            await resolve_public("example.com", mixed)

    def test_navigation_only_accepts_https_or_searches_google(self):
        self.assertEqual(target("google.com"), "https://google.com/")
        self.assertEqual(target("hello world"), "https://www.google.com/search?q=hello%20world")
        for address in ("http://example.com", "file:///etc/passwd", "javascript:alert(1)", "https://user:pass@example.com"):
            with self.assertRaises(ValueError):
                target(address)


class BrowserStreamTests(unittest.IsolatedAsyncioTestCase):
    def install_fake_playwright(self):
        class Page:
            def __init__(self):
                self.viewport_size = {"width": 1200, "height": 760}
                self.url = "about:blank"
                self.main_frame = object()
                self.events = {}
                self.mouse = type("Mouse", (), {"click": lambda *_args, **_kwargs: asyncio.sleep(0), "wheel": lambda *_args, **_kwargs: asyncio.sleep(0)})()
                self.keyboard = type("Keyboard", (), {"insert_text": lambda *_args, **_kwargs: asyncio.sleep(0), "press": lambda *_args, **_kwargs: asyncio.sleep(0)})()
            async def set_viewport_size(self, size): self.viewport_size = dict(size)
            async def title(self): return "Test page"
            async def screenshot(self, **_kwargs): return b"jpeg-frame"
            async def goto(self, address, **_kwargs): self.url = address
            async def go_back(self, **_kwargs): pass
            async def go_forward(self, **_kwargs): pass
            async def reload(self, **_kwargs): pass
            async def close(self): pass
            def on(self, name, callback): self.events[name] = callback
        class Context:
            def __init__(self): self.pages = []
            async def route(self, *_args): pass
            async def new_page(self):
                page = Page(); self.pages.append(page); return page
            async def close(self): pass
        class Browser:
            def __init__(self): self.contexts = []
            async def new_context(self, **_kwargs):
                context = Context(); self.contexts.append(context); return context
            async def close(self): pass
        class Playwright:
            def __init__(self): self.chromium = self; self.browser = Browser()
            async def start(self): return self
            async def launch(self, **_kwargs): return self.browser
            async def stop(self): pass
        def fake_playwright(): return Playwright()
        server_module.async_playwright = fake_playwright

    async def asyncSetUp(self):
        self.install_fake_playwright()
        self.service = BrowserService("x" * 48, "https://dock.example")
        await self.service.start(None)
        self.app = web.Application(client_max_size=32768)
        self.app.router.add_get("/health", self.service.health)
        self.app.router.add_get("/stream", self.service.socket)
        self.runner = web.AppRunner(self.app, access_log=None)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, "127.0.0.1", 0)
        await self.site.start()
        port = self.site._server.sockets[0].getsockname()[1]
        self.base = f"http://127.0.0.1:{port}"
        self.client = ClientSession()

    async def asyncTearDown(self):
        await self.client.close()
        await self.runner.cleanup()
        await self.service.close(None)

    async def next_json(self, socket):
        while True:
            message = await socket.receive(timeout=20)
            if message.type == WSMsgType.TEXT:
                return message.json()
            if message.type == WSMsgType.BINARY:
                await socket.send_json({"type": "ack"})
            if message.type in (WSMsgType.CLOSED, WSMsgType.ERROR):
                self.fail("Browser stream closed before state arrived")

    async def test_private_auth_stream_controls_and_safe_egress(self):
        proxy_port = self.service.proxy.sockets[0].getsockname()[1]
        reader, writer = await asyncio.open_connection("127.0.0.1", proxy_port)
        writer.write(b"CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n")
        await writer.drain()
        self.assertTrue((await reader.readuntil(b"\r\n\r\n")).startswith(b"HTTP/1.1 403"))
        writer.close()
        await writer.wait_closed()
        response = await self.client.get(self.base + "/health")
        self.assertEqual(response.status, 200)
        self.assertEqual(await response.text(), "Dock browser server online")
        with self.assertRaises(WSServerHandshakeError):
            await self.client.ws_connect(self.base + "/stream", headers={"Origin": "https://dock.example", "Authorization": "Bearer wrong"})
        with self.assertRaises(WSServerHandshakeError):
            await self.client.ws_connect(self.base + "/stream", headers={"Origin": "https://other.example", "Authorization": "Bearer " + "x" * 48})
        socket = await self.client.ws_connect(self.base + "/stream", headers={"Origin": "https://dock.example", "Authorization": "Bearer " + "x" * 48})
        try:
            state = await self.next_json(socket)
            self.assertEqual(state["type"], "state")
            self.assertEqual(len(state["tabs"]), 1)
            await socket.send_json({"type": "resize", "width": 640, "height": 480})
            state = await self.next_json(socket)
            self.assertEqual(state["type"], "state")
            self.assertEqual(self.service.browser.contexts[0].pages[0].viewport_size, {"width": 640, "height": 480})
            await socket.send_json({"type": "new"})
            state = await self.next_json(socket)
            self.assertEqual(len(state["tabs"]), 2)
            await socket.send_json({"type": "navigate", "value": "http://example.com"})
            error = await self.next_json(socket)
            while error["type"] != "error":
                error = await self.next_json(socket)
            self.assertEqual(error["type"], "error")
            image = await socket.receive(timeout=10)
            self.assertEqual(image.type, WSMsgType.BINARY)
        finally:
            await socket.close()


if __name__ == "__main__":
    unittest.main()
