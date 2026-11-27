import json
from playwright.sync_api import sync_playwright

URL = 'https://lvybb1102-lgtm.github.io/mars-secretary/'
CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2,
                        user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36')
    pg = ctx.new_page()
    errs, cerrs = [], []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: cerrs.append(m.text) if m.type == 'error' else None)

    pg.goto(URL, wait_until='load')
    pg.wait_for_timeout(1500)
    res = {}
    res['title'] = pg.title()
    res['http_ok'] = True
    res['manifest'] = pg.evaluate("fetch('./manifest.webmanifest').then(r=>r.json()).then(m=>({name:m.name,short:m.short_name,display:m.display,theme:m.theme_color,bg:m.background_color,icons:m.icons.length}))")
    res['sw'] = pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.active&&x.active.state))")
    res['hscroll'] = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    res['fontOk'] = pg.evaluate("getComputedStyle(document.body).fontFamily.slice(0,40)")
    res['icon_status'] = pg.evaluate("Promise.all(['./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./sw.js'].map(u=>fetch(u).then(r=>[u,r.status])))")

    # @all instruction
    pg.fill('#input', '@all 오늘 세금계산서 발행 건 정리하고 홍보 글 소재 뽑아줘')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(4000)
    body = pg.inner_text('body')
    res['replies_executing'] = body.count('실행하겠습니다')
    res['task_tab'] = pg.inner_text('[role=tablist]')
    pg.screenshot(path='/workspace/downloads/2026-11-27_마르스_비서실_배포_회의실.png')

    # 작업실
    pg.click('text=📋')
    pg.wait_for_timeout(800)
    res['tasks_text'] = pg.inner_text('main')[:400].replace('\n', ' / ')
    pg.screenshot(path='/workspace/downloads/2026-11-27_마르스_비서실_배포_작업실.png')

    # reload → persistence
    pg.click('text=💬')
    pg.wait_for_timeout(300)
    pg.reload(wait_until='load')
    pg.wait_for_timeout(1500)
    body2 = pg.inner_text('body')
    res['persisted_after_reload'] = '세금계산서 발행 건 정리하고' in body2
    res['bubble_after_reload'] = body2.count('실행하겠습니다')

    # settings sheet opens (AI key field)
    pg.click('button[aria-label=설정]')
    pg.wait_for_timeout(800)
    res['settings_has_key_field'] = pg.locator('#setApiKey').count() > 0
    pg.screenshot(path='/workspace/downloads/2026-11-27_마르스_비서실_배포_설정.png')

    res['pageerrors'] = errs
    res['console_errors'] = cerrs[:5]
    print(json.dumps(res, ensure_ascii=False, indent=1))
    b.close()
