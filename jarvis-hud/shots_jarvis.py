"""자비스 HUD 대표 스크린샷 — 데스크톱(계획 4단계) + 모바일.
   결과: downloads/마르스_자비스_HUD.png, downloads/마르스_자비스_HUD_모바일.png
"""
import functools
import http.server
import os
import socketserver
import threading

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = "/workspace/downloads"
PORT = 8781
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
from playwright.sync_api import sync_playwright  # noqa: E402


http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{PORT}/index.html"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])

    # 데스크톱 대표 컷
    c = b.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=2,
                      locale="ko-KR", timezone_id="Asia/Seoul")
    pg = c.new_page()
    pg.goto(url, wait_until="networkidle")
    pg.wait_for_timeout(1200)
    pg.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    pg.locator(".preset").first.evaluate("el => el.click()")
    pg.wait_for_timeout(6200)
    pg.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    pg.screenshot(path=OUT + "/마르스_자비스_HUD.png")
    print("desktop:", pg.inner_text("#planCount"), "steps /", len(pg.inner_text("#subText")), "chars")

    # 리스닝 상태 컷(코어 애니메이션 증빙)
    pg.evaluate("() => window.__marsHud.setState('listening', '듣는 중 · 말씀하세요')")
    pg.wait_for_timeout(1400)
    pg.screenshot(path=OUT + "/_local_state_listening.png", clip={"x": 20, "y": 60, "width": 700, "height": 760})
    c.close()

    # 모바일 대표 컷
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True,
                      has_touch=True, locale="ko-KR", timezone_id="Asia/Seoul")
    mp = m.new_page()
    mp.goto(url, wait_until="networkidle")
    mp.wait_for_timeout(1200)
    mp.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    mp.locator(".preset").nth(3).evaluate("el => el.click()")
    mp.wait_for_timeout(6000)
    mp.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    mp.evaluate("() => window.scrollTo(0, 0)")
    mp.screenshot(path=OUT + "/마르스_자비스_HUD_모바일.png")
    m.close()
    b.close()

httpd.shutdown()
print("saved")
