"""자비스 HUD 배포본(GitHub Pages) 실측 — 렌더·자산 200·프리셋·계획·모바일·콘솔 오류 0.
   결과: downloads/마르스_자비스_HUD.png (배포본 대표 컷)
"""
import json
import os
import subprocess
import sys

REPO = "/workspace/work/mars_secretary_pages"
OUT = "/workspace/downloads"
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/workspace/.pw-browsers")
from playwright.sync_api import sync_playwright  # noqa: E402

SHA = subprocess.check_output(["git", "-C", REPO, "rev-parse", "--short", "HEAD"]).decode().strip()
BASE = "https://lvybb1102-lgtm.github.io/mars-secretary/jarvis-hud/"
URL = BASE + "?v=" + SHA

results = {"sha": SHA, "url": BASE, "checks": [], "errors": [], "assets": {}}
ok = True


def check(name, cond, detail=""):
    global ok
    results["checks"].append({"name": name, "pass": bool(cond), "detail": str(detail)[:240]})
    if not cond:
        ok = False


with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    c = b.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=2,
                      locale="ko-KR", timezone_id="Asia/Seoul")
    pg = c.new_page()
    pg.on("console", lambda m: results["errors"].append("console:" + m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: results["errors"].append("pageerror:" + str(e)))
    pg.on("response", lambda r: results["assets"].update({r.url.split("jarvis-hud/")[-1][:40]: r.status}) if "jarvis-hud/" in r.url else None)
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(1800)

    check("title", "자비스" in pg.title(), pg.title())
    check("hud booted", pg.evaluate("() => typeof window.__marsHud") == "object")
    check("state idle", pg.evaluate("() => document.body.dataset.state") == "idle")
    check("canvas painted", pg.evaluate(
        """() => { const c=document.querySelector('#hudCanvas'); const g=c.getContext('2d');
             const d=g.getImageData(0,0,c.width,c.height).data; let n=0;
             for (let i=3;i<d.length;i+=4*97) if (d[i]>8) n++; return n; }""") > 40)
    keys = {"index.html": 0, "style.css": 0, "app.js": 0}
    check("presets 4", pg.locator(".preset").count() == 4)

    pg.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    pg.locator(".preset").first.evaluate("el => el.click()")
    pg.wait_for_timeout(6200)
    pg.evaluate("() => { const t=document.querySelector('#toast'); if (t) t.hidden = true; }")
    check("plan 4 from live", pg.inner_text("#planCount").strip() == "4", pg.inner_text("#planCount"))
    check("answer rendered", len(pg.inner_text("#subText")) > 80)
    pg.screenshot(path=OUT + "/마르스_자비스_HUD.png")

    # 모바일 배포본
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True,
                      has_touch=True, locale="ko-KR", timezone_id="Asia/Seoul")
    mp = m.new_page()
    mp.on("pageerror", lambda e: results["errors"].append("mobile-pageerror:" + str(e)))
    mp.goto(URL, wait_until="networkidle")
    mp.wait_for_timeout(1500)
    check("mobile overflow 0", mp.evaluate("() => document.documentElement.scrollWidth") <= 392)
    check("mobile hud painted", mp.evaluate("() => typeof window.__marsHud") == "object")
    m.close()
    c.close()
    b.close()

results["assets_200"] = all(v == 200 for v in results["assets"].values()) if results["assets"] else False
check("assets http 200", results["assets_200"], results["assets"])
results["ok"] = ok
print(json.dumps(results, ensure_ascii=False, indent=1))
sys.exit(0 if ok else 1)
