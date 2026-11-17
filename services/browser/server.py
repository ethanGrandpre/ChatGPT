"""Small, private Chromium screenshot server for Dock Browser."""
from __future__ import annotations

import asyncio
import hmac
import ipaddress
import json
import os
import re
import shutil
import socket
import time
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

from aiohttp import web
from playwright.async_api import async_playwright

HOME = "https://www.google.com/"
PORT = int(os.environ.get("PORT", "8788"))
KEYS = {"Enter", "Backspace", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete", "Home", "End", "PageUp", "PageDown", "ControlOrMeta+A"}


def load_env(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() and not key.lstrip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def chrome_path() -> str:
    configured = os.environ.get("DOCK_CHROME_PATH")
    candidates = [configured] if configured else []
    candidates += [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    ]
    candidates += [shutil.which(name) for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome")]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("Install Chrome or Chromium on this Mac, then restart. Dock will use the browser already installed; it does not download Chromium.")


def public_address(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        return address.is_global
    except ValueError:
        return False


async def resolve_public(host: str, resolver=None) -> tuple[str, int]:
    if resolver:
        infos = await resolver(host, 443, type=socket.SOCK_STREAM)
    else:
        infos = await asyncio.get_running_loop().getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not infos or any(not public_address(info[4][0]) for info in infos):
        raise ValueError("Private or special network destinations are blocked")
    family, _, _, _, sockaddr = infos[0]
    return sockaddr[0], family


def target(value: str) -> str:
    text = str(value or "").strip()
    if not text or len(text) > 4096:
        raise ValueError("Enter a shorter website address or search.")
    try:
        parsed = urlsplit(text)
        if not parsed.scheme and re.fullmatch(r"\S+\.\S+", text):
            parsed = urlsplit("https://" + text)
        elif not parsed.scheme:
            return "https://www.google.com/search?q=" + quote(text, safe="")
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Only HTTPS websites without embedded credentials are supported.")
        if parsed.port not in (None, 443):
            raise ValueError("Only standard HTTPS website ports are supported.")
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, parsed.fragment))
    except ValueError:
        raise


async def copy_stream(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    while True:
        data = await asyncio.wait_for(reader.read(65536), timeout=60)
        if not data:
            return
        writer.write(data)
        await writer.drain()


async def egress_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    upstream_writer = None
    try:
        header = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
        first = header.split(b"\r\n", 1)[0].decode("ascii", "strict").split()
        if len(first) != 3 or first[0] != "CONNECT":
            raise ValueError("HTTPS connections only")
        authority = first[1]
        if authority.startswith("["):
            host, suffix = authority[1:].split("]", 1)
            port = int(suffix.removeprefix(":"))
        else:
            host, port_text = authority.rsplit(":", 1)
            port = int(port_text)
        if not host or port != 443:
            raise ValueError("HTTPS port 443 only")
        address, family = await resolve_public(host)
        upstream_reader, upstream_writer = await asyncio.wait_for(asyncio.open_connection(address, 443, family=family), timeout=10)
        writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await writer.drain()
        directions = [asyncio.create_task(copy_stream(reader, upstream_writer)), asyncio.create_task(copy_stream(upstream_reader, writer))]
        _, pending = await asyncio.wait(directions, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*directions, return_exceptions=True)
    except Exception:
        if not writer.is_closing():
            with __import__("contextlib").suppress(Exception):
                writer.write(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n")
                await writer.drain()
    finally:
        if upstream_writer:
            upstream_writer.close()
            with __import__("contextlib").suppress(Exception):
                await upstream_writer.wait_closed()
        writer.close()
        with __import__("contextlib").suppress(Exception):
            await writer.wait_closed()


class BrowserService:
    def __init__(self, secret: str, origin: str):
        if len(secret) < 32 or not origin.startswith("https://") or urlsplit(origin).path not in ("", "/"):
            raise ValueError("Set BROWSER_SERVER_SECRET (32+ characters) and the exact HTTPS ALLOWED_ORIGIN in .env.")
        self.secret, self.origin = secret, origin.rstrip("/")
        self.proxy = None
        self.playwright = None
        self.browser = None
        self.browser_lock = asyncio.Lock()
        self.clients: set[web.WebSocketResponse] = set()
        self.starting = 0
        self.guard = asyncio.Lock()

    async def start(self, app: web.Application) -> None:
        self.proxy = await asyncio.start_server(egress_client, "127.0.0.1", 0, limit=65536)

    async def close(self, app: web.Application) -> None:
        for client in tuple(self.clients):
            await client.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        if self.proxy:
            self.proxy.close()
            await self.proxy.wait_closed()

    async def ensure_browser(self):
        async with self.browser_lock:
            if self.browser:
                return self.browser
            executable = chrome_path()
            playwright = await async_playwright().start()
            try:
                browser = await playwright.chromium.launch(
                    executable_path=executable, headless=True, chromium_sandbox=True,
                    proxy={"server": f"http://127.0.0.1:{self.proxy.sockets[0].getsockname()[1]}"},
                    args=["--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--disable-features=WebRtcHideLocalIpsWithMdns", "--proxy-bypass-list=<-loopback>"],
                )
            except Exception:
                await playwright.stop()
                raise
            self.playwright, self.browser = playwright, browser
            return browser

    async def health(self, request):
        return web.Response(text="Dock browser server online", headers={"Cache-Control": "no-store"})

    async def socket(self, request):
        if request.headers.get("Origin") != self.origin or not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + self.secret):
            raise web.HTTPForbidden()
        reserved = True
        async with self.guard:
            if len(self.clients) + self.starting >= 2:
                raise web.HTTPTooManyRequests()
            self.starting += 1
        context = None
        ws = web.WebSocketResponse(max_msg_size=32768, heartbeat=30, compress=False)
        try:
            browser = await self.ensure_browser()
            context = await browser.new_context(viewport={"width": 1200, "height": 760}, accept_downloads=False, service_workers="block", permissions=[])
            async def filter_request(route):
                if urlsplit(route.request.url).scheme in ("https", "about"):
                    await route.fallback()
                else:
                    await route.abort()
            await context.route("**/*", filter_request)
            await ws.prepare(request)
            async with self.guard:
                self.starting -= 1
                reserved = False
                self.clients.add(ws)
            await self.run_session(ws, context)
            return ws
        except Exception:
            if not ws.prepared:
                raise web.HTTPServiceUnavailable(text="Browser could not start. Install Chrome and retry.")
            await ws.close(code=1011, message=b"Browser session failed")
            return ws
        finally:
            async with self.guard:
                if reserved:
                    self.starting -= 1
                self.clients.discard(ws)
            if context:
                await context.close()

    async def run_session(self, ws, context):
        tabs, active = [], None
        sequence = 0
        messages = asyncio.Queue(maxsize=40)
        pending_frame = False
        last_frame = time.monotonic()
        last_input = time.monotonic()
        viewport = {"width": 1200, "height": 760}

        async def send(value):
            if not ws.closed:
                await ws.send_json(value)

        async def state():
            if active and not ws.closed:
                rows = []
                for tab in tabs:
                    try:
                        title = await tab["page"].title()
                    except Exception:
                        title = ""
                    rows.append({"id": tab["id"], "title": title, "url": tab["page"].url})
                await send({"type": "state", "active": active["id"], "tabs": rows})

        async def navigate(page, url):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception:
                await send({"type": "error", "message": "Page could not finish loading. Try another address or reload."})

        async def add(url=HOME):
            nonlocal active, sequence
            if len(tabs) >= 8:
                raise ValueError("Maximum of eight tabs.")
            page = await context.new_page()
            await page.set_viewport_size(viewport)
            sequence += 1
            tab = {"id": sequence, "page": page}
            tabs.append(tab)
            active = tab
            page.on("popup", lambda popup: asyncio.create_task(popup.close()))
            page.on("dialog", lambda dialog: asyncio.create_task(dialog.dismiss()))
            page.on("download", lambda download: asyncio.create_task(download.cancel()))
            page.on("framenavigated", lambda frame: asyncio.create_task(state()) if frame == page.main_frame else None)
            asyncio.create_task(navigate(page, url))
            await state()

        async def frames():
            nonlocal pending_frame, last_frame
            while not ws.closed:
                await asyncio.sleep(.18)
                if time.monotonic() - last_input > 15 * 60:
                    await ws.close(code=1000, message=b"Idle session ended")
                    return
                if pending_frame:
                    if time.monotonic() - last_frame > 15:
                        await ws.close(code=1000, message=b"Stream stalled")
                        return
                    continue
                if not active:
                    continue
                try:
                    frame = await active["page"].screenshot(type="jpeg", quality=65, timeout=5000)
                    await ws.send_bytes(frame)
                    pending_frame = True
                    last_frame = time.monotonic()
                except Exception:
                    pass

        async def actions():
            nonlocal active, viewport, pending_frame, last_input
            while not ws.closed:
                message = await messages.get()
                try:
                    action = message
                    if not isinstance(action, dict) or not isinstance(action.get("type"), str):
                        continue
                    if action["type"] == "ack":
                        pending_frame = False
                        continue
                    last_input = time.monotonic()
                    page = active["page"] if active else None
                    kind = action["type"]
                    if kind == "navigate" and page:
                        await page.goto(target(action.get("value", "")), wait_until="domcontentloaded", timeout=30000)
                    elif kind == "new":
                        await add("about:blank")
                    elif kind == "select":
                        active = next((tab for tab in tabs if tab["id"] == action.get("id")), active)
                    elif kind == "close":
                        tab = next((tab for tab in tabs if tab["id"] == action.get("id")), None)
                        if tab:
                            tabs.remove(tab)
                            await tab["page"].close()
                            if active is tab:
                                active = tabs[0] if tabs else None
                            if active is None:
                                await add("about:blank")
                    elif kind in ("back", "forward", "reload") and page:
                        await {"back": page.go_back, "forward": page.go_forward, "reload": page.reload}[kind](wait_until="domcontentloaded", timeout=15000)
                    elif kind == "resize":
                        width = round(max(360, min(1600, float(action.get("width") or 1200))))
                        height = round(max(300, min(1000, float(action.get("height") or 760))))
                        viewport = {"width": width, "height": height}
                        await asyncio.gather(*(tab["page"].set_viewport_size(viewport) for tab in tabs))
                    elif kind == "click" and page:
                        size = page.viewport_size
                        x, y = action.get("x"), action.get("y")
                        if isinstance(x, (int, float)) and isinstance(y, (int, float)) and 0 <= x <= size["width"] and 0 <= y <= size["height"]:
                            await page.mouse.click(x, y)
                    elif kind == "wheel" and page:
                        x, y = action.get("x", 0), action.get("y", 0)
                        await page.mouse.wheel(max(-1500, min(1500, float(x))), max(-1500, min(1500, float(y))))
                    elif kind == "text" and page and isinstance(action.get("value"), str) and len(action["value"]) <= 4000:
                        await page.keyboard.insert_text(action["value"])
                    elif kind == "key" and page and action.get("value") in KEYS:
                        await page.keyboard.press(action["value"])
                    await state()
                except Exception:
                    await send({"type": "error", "message": "That action could not be completed."})
                finally:
                    messages.task_done()

        async def receive():
            async for incoming in ws:
                if incoming.type == web.WSMsgType.TEXT:
                    try:
                        payload = json.loads(incoming.data)
                        messages.put_nowait(payload)
                    except (json.JSONDecodeError, asyncio.QueueFull):
                        await ws.close(code=1008, message=b"Too many or invalid input events")
                        return
                elif incoming.type == web.WSMsgType.ERROR:
                    return

        async def lifetime():
            await asyncio.sleep(30 * 60)
            if not ws.closed:
                await ws.close(code=1000, message=b"Session expired; reconnect")

        await add()
        tasks = [asyncio.create_task(receive()), asyncio.create_task(actions()), asyncio.create_task(frames()), asyncio.create_task(lifetime())]
        try:
            await tasks[0]
        finally:
            for task in tasks[1:]:
                task.cancel()
            await asyncio.gather(*tasks[1:], return_exceptions=True)


async def main():
    load_env()
    service = BrowserService(os.environ.get("BROWSER_SERVER_SECRET", ""), os.environ.get("ALLOWED_ORIGIN", ""))
    app = web.Application(client_max_size=32768)
    app.on_startup.append(service.start)
    app.on_cleanup.append(service.close)
    app.router.add_get("/health", service.health)
    app.router.add_get("/stream", service.socket)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", PORT)
    await site.start()
    print(f"Dock Browser server listening on http://127.0.0.1:{PORT}")
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
