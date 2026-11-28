"""자비스 HUD 로컬 검증 — 로컬 서버 + Playwright(Chromium) 헤드리스.
   · 콘솔/페이지 오류 수집
   · 데스크톱·모바일 렌더 스크린샷
   · 프리셋(맛보기) 동작, 계획 패널, 설정 모달, 상태 애니메이션 확인
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = "/workspace/downloads"
PORT = 8765

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
from playwright.sync_api import sync_playwright  # noqa: E402


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def main():
    httpd = serve()
    url = f"http://127.0.0.1:{PORT}/index.html"
    results = {"url": url, "errors": [], "checks": []}
    ok = True

    def check(name, cond, detail=""):
        nonlocal ok
        results["checks"].append({"name": name, "pass": bool(cond), "detail": str(detail)[:300]})
        if not cond:
            ok = False

    try:
        run(url, results, check)
    except Exception as e:  # 검증 도중 예외도 결과에 남긴다
        ok = False
        results["exception"] = repr(e)[:600]
    finally:
        httpd.shutdown()
    results["ok"] = ok
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if ok else 1


def run(url, results, check):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2,
                                  locale="ko-KR", timezone_id="Asia/Seoul")
        page = ctx.new_page()
        page.on("console", lambda m: results["errors"].append("console:" + m.type + ":" + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: results["errors"].append("pageerror:" + str(e)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1800)

        check("title", "자비스" in page.title(), page.title())
        check("canvas size", page.evaluate("() => { const c=document.querySelector('#hudCanvas'); return [c.width>0, c.height>0]; }"))
        check("initial state idle", page.evaluate("() => document.body.dataset.state") == "idle")
        check("key banner visible (no key)", page.is_visible("#keyBanner"))
        check("key meta OFF", page.inner_text("#metaKey").strip() == "OFF")
        check("presets 4", page.locator(".preset").count() == 4)
        check("plan empty", page.is_visible("#planEmpty"))

        # 캔버스에 실제로 그려졌는지(비어있지 않은 픽셀 비율)
        painted = page.evaluate(
            """() => { const c = document.querySelector('#hudCanvas');
                const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data;
                let n=0; for (let i=3;i<d.length;i+=4*97) { if (d[i]>8) n++; }
                return n; }"""
        )
        check("canvas painted", painted > 50, painted)

        # 데스크톱 기본 화면 (idle)
        page.screenshot(path=OUT + "/_local_desktop_idle.png")

        # 상태 애니메이션 4종 캡처
        for st, f in [("listening", "listening"), ("thinking", "thinking"), ("speaking", "speaking")]:
            page.evaluate(f"() => window.__marsHud.setState('{st}')")
            page.wait_for_timeout(700)
            page.screenshot(path=OUT + f"/_local_state_{f}.png", clip={"x": 20, "y": 70, "width": 780, "height": 720})
        page.evaluate("() => window.__marsHud.setState('idle')")

        # 프리셋 1 (오늘 업무 브리핑, 맛보기)
        page.locator(".preset").first.click()
        page.wait_for_timeout(2400)
        plan_count = page.inner_text("#planCount").strip()
        sub = page.inner_text("#subText")
        check("preset plan count 4", plan_count == "4", plan_count)
        check("preset subtitle text", len(sub) > 40, sub[:80])
        check("state back to idle", page.evaluate("() => document.body.dataset.state") == "idle")
        page.screenshot(path=OUT + "/_local_desktop_preset.png")

        # 계획 복사(클립보드 권한 없이 예외 없이 동작하는지)
        page.click("#btnPlanCopy")
        page.wait_for_timeout(400)

        # 설정 모달
        page.click("#btnSettings")
        page.wait_for_timeout(500)
        check("settings open", page.is_visible("#settings"))
        check("model select default auto", page.input_value("#modelSel") == "auto")
        page.screenshot(path=OUT + "/_local_settings.png")
        page.click("#btnCloseSettings2")
        page.wait_for_timeout(300)
        check("settings closed", not page.is_visible("#settings"))

        # 텍스트 입력 전송 (키 없음 → 안내)
        page.fill("#cmd", "안녕")
        page.press("#cmd", "Enter")
        page.wait_for_timeout(700)
        check("no-key guidance", "키" in page.inner_text("#subText"))

        # 모바일
        m = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True,
                                has_touch=True, locale="ko-KR", timezone_id="Asia/Seoul")
        mp = m.new_page()
        mp.on("pageerror", lambda e: results["errors"].append("mobile-pageerror:" + str(e)))
        mp.goto(url, wait_until="networkidle")
        mp.wait_for_timeout(1600)
        mp.screenshot(path=OUT + "/_local_mobile.png", full_page=True)
        mw = mp.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        check("mobile no horizontal overflow", mw[0] <= mw[1] + 2, mw)
        check("mobile mic visible", mp.is_visible("#btnMic"))
        mp.locator(".preset").nth(3).evaluate("el => el.click()")
        mp.wait_for_timeout(2400)
        check("mobile plan after preset", mp.inner_text("#planCount").strip() == "4")
        mp.screenshot(path=OUT + "/_local_mobile_preset.png", full_page=True)
        m.close()

        # 가짜 키 → 실제 엔드포인트 호출 경로·오류 안내 확인 (비용 0)
        k = browser.new_context(viewport={"width": 1280, "height": 860}, device_scale_factor=1, locale="ko-KR")
        k.add_init_script("try{localStorage.setItem('marshud_gemini_key_v1','AIzaTEST-not-a-real-key-0123456789');}catch(e){}")
        kp = k.new_page()
        kp.on("pageerror", lambda e: results["errors"].append("key-pageerror:" + str(e)))
        calls = []
        kp.on("request", lambda r: calls.append(r.url) if "generativelanguage.googleapis.com" in r.url else None)
        kp.goto(url, wait_until="networkidle")
        kp.wait_for_timeout(1200)
        check("key meta ON with key", kp.inner_text("#metaKey").strip() == "ON")
        check("banner hidden with key", not kp.is_visible("#keyBanner"))
        kp.fill("#cmd", "핑")
        kp.press("#cmd", "Enter")
        kp.wait_for_timeout(9000)
        sub = kp.inner_text("#subtitleBody")
        check("live endpoint called", len(calls) > 0, calls[:1])
        check("invalid key friendly error", "API 키" in sub or "키" in sub, sub[:160])
        kp.screenshot(path=OUT + "/_local_key_error.png")
        k.close()

        ctx.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
