#!/usr/bin/env python3
"""단독 HTML(downloads/잉크원_필드스튜디오_프로토타입.html) 스모크 — file:// 에서 사진 보관 동작 확인"""
import json, sys
from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
URL = 'file:///workspace/downloads/%EC%9E%89%ED%81%AC%EC%9B%90_%ED%95%84%EB%93%9C%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4_%ED%94%84%EB%A1%9C%ED%86%A0%ED%83%80%EC%9E%85.html'
IMG = ['/workspace/work/ink1fs/testimg/shot_a.jpg', '/workspace/work/ink1fs/testimg/shot_b.jpg']
MOCK = """[TOPIC] 복합기 급지
[TITLE1] 복합기 급지 걸림 해결 /아싸렌탈수원지사
[TITLE2] 복합기 용지 걸림? /아싸렌탈수원지사
[TITLE3] 성서공단 AS 현장 /아싸렌탈수원지사
[BLOG] <h2>결론</h2><p>급지롤러 교체로 해결했습니다.</p>
[TAGS] #수원복합기 #복합기수리
[THREADS] 급지롤러를 교체했습니다.
[SHORTS] 0-3초|급지롤러|양면만 걸린다면
[INSTA] 수원 복합기 수리했습니다.
[YT_TITLE] 복합기 급지
[YT_DESC] 급지롤러 교체"""

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 430, 'height': 932}, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.route('**/generativelanguage.googleapis.com/**', lambda r: r.fulfill(
        status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
        body=json.dumps({"candidates": [{"content": {"parts": [{"text": MOCK}]}}]})))
    pg.goto(URL, wait_until='load')
    pg.wait_for_timeout(800)
    idb_ok = pg.evaluate("""() => new Promise((res) => {
      try {
        const rq = indexedDB.open('smoke_probe', 1);
        rq.onsuccess = () => res(true);
        rq.onerror = () => res(false);
        setTimeout(() => res(false), 3000);
      } catch (e) { res(false); }
    })""")
    pg.click('#tabs .tab[data-v=write]')
    pg.wait_for_timeout(250)
    pg.click('#cats .cat[data-c="AS"]')
    pg.set_input_files('#fileInput', IMG)
    pg.wait_for_timeout(2000)
    pg.fill('#memo', 'file:// 스모크 테스트')
    pg.click('#makeBtn')
    pg.wait_for_function("() => !document.querySelector('#resultBody').classList.contains('hidden')", timeout=20000)
    pg.wait_for_timeout(1200)
    rid = pg.evaluate("JSON.parse(localStorage.getItem('ink1fs_history_v1'))[0].id")
    rec = pg.evaluate("""(rid) => new Promise((res) => {
      const rq = indexedDB.open('ink1_field_studio_db');
      rq.onsuccess = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('photos_by_result')) { res(-1); return; }
        const g = db.transaction('photos_by_result', 'readonly').objectStore('photos_by_result').get(rid);
        g.onsuccess = () => res(g.result && g.result.photos ? g.result.photos.length : 0);
        g.onerror = () => res(-2);
      };
      rq.onerror = () => res(-3);
    })""", rid)
    before = pg.evaluate("({h: localStorage.getItem('ink1fs_history_v1')||'', rid: location.href})")
    pg.reload(wait_until='load')
    pg.wait_for_timeout(1200)
    pg.click('#tabs .tab[data-v=home]')
    pg.wait_for_timeout(400)
    after = pg.evaluate("({h: localStorage.getItem('ink1fs_history_v1')||'', list: document.querySelector('#histList').innerHTML.slice(0,200)})")
    print('before:', before['h'][:80], 'rid=', rid)
    print('after :', after['h'][:80])
    print('list  :', after['list'])
    if pg.eval_on_selector_all('#histList .hitem', 'e => e.length'):
        pg.click('#histList .hitem')
        pg.wait_for_timeout(1800)
    n = pg.eval_on_selector_all('#resThumbs img', 'els => els.length')
    print(json.dumps({'indexeddb_available': idb_ok, 'stored_photos': rec, 'restored_photos': n,
                      'meta': pg.inner_text('#resPhotoMeta'), 'errors': errs[:5]},
                     ensure_ascii=False, indent=1))
    b.close()
