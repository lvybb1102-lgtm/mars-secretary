#!/usr/bin/env python3
"""잉크원_st_AI v1.4 검증 — 원고 사진 자동 보존 (IndexedDB)

사용: python3 verify_v14_idb_photos.py            # 로컬(127.0.0.1) 서빙해 검증
      python3 verify_v14_idb_photos.py <배포URL>   # 배포 URL 그대로 검증

무엇을 보는가
  1) 원고를 만들면 S.photos 전체(가리기 반영본 disp · name · takenAt · edited · width · height · bytes)가
     IndexedDB(ink1_field_studio_db / photos_by_result)에 원고 ID로 저장된다.
  2) 페이지를 새로고침해도 홈 [열기]로 원고를 열면 사진이 복원되고 '📷 사진 N장 포함됨'이 뜬다.
  3) 그 상태에서 [⚡ 니케에게 바로발행 전송]을 누르면 사진 0장 확인창 없이 사진 PUT까지 실행된다(mock).
  4) 사진 삭제가 보관본에도 반영되고, 최근 20건만 유지(오래된 것 자동 정리),
     기록을 지우면 보관 사진도 함께 지워진다.
Gemini·GitHub 응답은 mock. 430x932 모바일 뷰포트.
"""
import base64, functools, http.server, json, pathlib, sys, threading, time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
ROOT = pathlib.Path('/workspace/work/mars_secretary_pages')
SHOT = '/workspace/downloads/잉크원_st_AI_사진보관_복원.png'
SHOT_HOME = '/workspace/downloads/잉크원_st_AI_사진보관_홈.png'
IMG = [ROOT.parent / 'ink1fs/testimg/shot_a.jpg', ROOT.parent / 'ink1fs/testimg/shot_b.jpg',
       ROOT.parent / 'ink1fs/testimg/shot_c.jpg']

BLOG = ('<h2>접수한 증상</h2><p>사무실 복합기에서 양면 인쇄만 걸린다는 연락을 받고 방문했습니다.</p>'
        '<h2>원인 진단</h2><p>급지롤러 마모가 원인이었습니다. 롤러 표면이 매끈해져 종이를 제대로 끌어올리지 못했습니다.</p>'
        '<h2>현장 조치</h2><ul><li>급지롤러·픽업롤러 교체</li><li>카세트 먼지 제거</li></ul>'
        '<h2>상담 안내</h2><p>잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · https://ink1.kr/</p>'
        '<p>#수원복합기 #복합기수리 #급지롤러 #아싸렌탈</p>')

MOCK = """[TOPIC] 복합기 급지 걸림, 급지롤러 마모가 원인입니다
[TITLE1] 복합기 양면 인쇄만 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사
[TITLE2] 복합기 용지 걸림이 반복될 때 무엇을 보나요? /아싸렌탈수원지사
[TITLE3] 성서공단 사무실 복합기 AS 현장 /아싸렌탈수원지사
[BLOG] """ + BLOG + """
[TAGS] #수원복합기 #복합기수리 #급지롤러 #아싸렌탈
[THREADS] 복합기에서 양면만 걸린다면 급지롤러를 먼저 봅니다. 롤러 표면이 닳으면 종이를 끌어올리는 힘이 달라져 양면 경로에서 자주 멈춥니다. 급지롤러를 교체하고 양면 20매를 시험 출력해 확인했습니다.
[SHORTS] 0-3초|양면만 걸린다면 급지롤러|단면은 되는데 양면만 멈춘다면
[SHORTS] 3-9초|급지롤러 마모 확인|롤러 교체·픽업롤러 청소
[SHORTS] 9-15초|양면 20매 시험 출력|잉크원·아싸렌탈, 1544-4065
[INSTA] 수원 사무실 복합기 양면 걸림, 급지롤러 교체로 해결했습니다.
━━━━━━━━━━━━━━━━━━━━
🏢 잉크원 · 아싸렌탈 수원지사
📞 1544-4065
#수원복합기 #복합기수리
[YT_TITLE] 복합기 양면 걸림, 급지롤러 교체로 끝났습니다
[YT_DESC] 급지롤러 마모가 원인이었습니다."""

stat = {'pass': 0}
fails = []
GH = {'calls': []}


def ok(cond, label, extra=''):
    if cond:
        stat['pass'] += 1
        print('  ✓ ' + label)
    else:
        fails.append(label + ((' — ' + extra) if extra else ''))
        print('  ✗ ' + label + ((' — ' + extra) if extra else ''))


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, 'http://127.0.0.1:%d/field-studio/' % srv.server_address[1]


ACAO = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, accept, x-github-api-version',
    'Content-Type': 'application/json',
}
REPO = {"full_name": "lvybb1102-lgtm/ink1-publish-queue", "private": True,
        "default_branch": "main", "permissions": {"admin": True, "push": True, "pull": True}}


def gh_handler(route):
    req = route.request
    path = req.url.split('api.github.com', 1)[1]
    if req.method == 'OPTIONS':
        route.fulfill(status=204, headers=ACAO, body='')
        return
    body = None
    if req.method == 'PUT':
        try:
            body = json.loads(req.post_data)
        except Exception:
            body = {}
    GH['calls'].append({'method': req.method, 'path': path, 'body': body})
    if req.method == 'GET' and '/contents/' not in path:
        route.fulfill(status=200, headers=ACAO, body=json.dumps(REPO))
        return
    if req.method == 'GET':
        route.fulfill(status=404, headers=ACAO, body=json.dumps({"message": "Not Found"}))
        return
    if req.method == 'PUT':
        route.fulfill(status=201, headers=ACAO, body=json.dumps({
            "content": {"path": path.split('/contents/')[-1],
                        "html_url": "https://github.com/lvybb1102-lgtm/ink1-publish-queue/blob/main/" +
                                    path.split('/contents/')[-1]},
            "commit": {"sha": "c0ffee"}}))
        return
    route.fulfill(status=200, headers=ACAO, body='{}')


def puts():
    return [c for c in GH['calls'] if c['method'] == 'PUT']


def put_path(c):
    return urlparse('https://api.github.com' + c['path']).path.split('/contents/', 1)[1]


def put_json(c):
    return json.loads(base64.b64decode(c['body']['content']).decode('utf-8'))


IDB_DUMP = """() => new Promise((res) => {
  const rq = indexedDB.open('ink1_field_studio_db');
  rq.onsuccess = () => {
    const db = rq.result;
    if (!db.objectStoreNames.contains('photos_by_result')) { res({ok: false, recs: []}); return; }
    const tx = db.transaction(['photos_by_result', 'results_meta'], 'readonly');
    const a = tx.objectStore('photos_by_result').getAll();
    const b = tx.objectStore('results_meta').getAll();
    tx.oncomplete = () => res({ok: true, recs: a.result || [], metas: b.result || []});
    tx.onerror = () => res({ok: false, recs: [], metas: []});
  };
  rq.onerror = () => res({ok: false, recs: [], metas: []});
})"""


def idb(pg):
    return pg.evaluate(IDB_DUMP)


def idb_seed(pg, n=24, base=1700000000000):
    """오래된 원고 보관본 n건을 심는다(용량 정리 검사용)."""
    pg.evaluate("""(args) => new Promise((res) => {
      const [n, base] = args;
      const rq = indexedDB.open('ink1_field_studio_db');
      rq.onsuccess = () => {
        const db = rq.result;
        const tx = db.transaction(['photos_by_result', 'results_meta'], 'readwrite');
        const sp = tx.objectStore('photos_by_result');
        const sm = tx.objectStore('results_meta');
        for (let i = 1; i <= n; i++) {
          const id = 'seed_' + i;
          const at = base + i * 1000;
          sp.put({ id: id, at: at, photos: [{ id: 'p' + i, name: 'old' + i + '.jpg', original: 'old' + i + '.jpg',
                   takenAt: '', edited: false, width: 100, height: 80, bytes: 1000,
                   disp: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
                   mini: ''}] });
          sm.put({ id: id, at: at, count: 1, bytes: 1000 });
        }
        tx.oncomplete = () => res(1);
        tx.onerror = () => res(0);
      };
      rq.onerror = () => res(0);
    })""", [n, base])


def main():
    srv = None
    url = sys.argv[1] if len(sys.argv) > 1 else None
    if not url:
        srv, url = serve()
        time.sleep(0.4)
    print('대상:', url)

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2,
                            has_touch=True, is_mobile=True,
                            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 '
                                       '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')
        ctx.add_init_script(
            "localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');"
            "localStorage.setItem('ink1fs_gh_repo_v1','lvybb1102-lgtm/ink1-publish-queue');"
            "localStorage.setItem('ink1fs_gh_token_v1','github_pat_TESTTOKEN123');")
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))

        def on_console(m):
            if m.type != 'error':
                return
            loc = (m.location or {}).get('url', '')
            if 'Failed to load resource' in m.text:
                return
            errs.append('console.error: ' + m.text + ' @' + loc)

        pg.on('console', on_console)
        DIALOG = {'seen': 0, 'text': []}

        def on_dialog(d):
            DIALOG['seen'] += 1
            DIALOG['text'].append(d.message)
            try:
                d.accept()
            except Exception:
                pass

        pg.on('dialog', on_dialog)

        pg.route('**/generativelanguage.googleapis.com/**', lambda r: r.fulfill(
            status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
            body=json.dumps({"candidates": [{"content": {"parts": [{"text": MOCK}]}, "finishReason": "STOP"}],
                             "usageMetadata": {"totalTokenCount": 1200}})))
        pg.route('**://api.github.com/**', gh_handler)

        pg.goto(url, wait_until='load')
        pg.wait_for_timeout(1400)

        # ── 1. 사진 3장으로 원고 만들기
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(300)
        pg.click('#cats .cat[data-c="AS"]')
        pg.wait_for_timeout(150)
        pg.set_input_files('#fileInput', [str(p) for p in IMG])
        pg.wait_for_timeout(2600)
        ok(pg.inner_text('#photoMeta').startswith('3/'), '사진 3장 추가: ' + pg.inner_text('#photoMeta'))
        pg.fill('#memo', '성서공단 사무실, 양면만 걸림. 급지롤러 교체하고 양면 20매 시험 출력.')
        pg.click('#makeBtn')
        pg.wait_for_function("() => !document.querySelector('#resultBody').classList.contains('hidden')", timeout=20000)
        pg.wait_for_timeout(800)
        ok('3장' in pg.inner_text('#resPhotoMeta'), '결과 화면 사진 3장: ' + pg.inner_text('#resPhotoMeta'))

        rid = pg.evaluate("JSON.parse(localStorage.getItem('ink1fs_history_v1'))[0].id")
        ok(bool(rid), '기록 ID: ' + str(rid))

        # ── 2. IndexedDB 저장 내용
        pg.wait_for_function("""() => new Promise((res) => {
          const rq = indexedDB.open('ink1_field_studio_db');
          rq.onsuccess = () => {
            const db = rq.result;
            if (!db.objectStoreNames.contains('photos_by_result')) { res(false); return; }
            const tx = db.transaction('photos_by_result', 'readonly');
            const g = tx.objectStore('photos_by_result').get('""" + rid + """');
            g.onsuccess = () => res(!!(g.result && g.result.photos && g.result.photos.length === 3));
            g.onerror = () => res(false);
          };
          rq.onerror = () => res(false);
        })""", timeout=15000)
        dump = idb(pg)
        rec = [r for r in dump['recs'] if r['id'] == rid]
        ok(len(rec) == 1, 'IndexedDB(photos_by_result)에 원고 ID 키로 저장: %s' % ([r['id'] for r in dump['recs']][:3]))
        ph = (rec[0]['photos'] if rec else [])
        ok(len(ph) == 3, '사진 3장 저장: %d' % len(ph))
        keys = sorted(ph[0].keys()) if ph else []
        want = ['bytes', 'dateKey', 'disp', 'edited', 'height', 'id', 'mini', 'name', 'original', 'takenAt', 'width']
        ok(all(k in keys for k in ['name', 'original', 'takenAt', 'edited', 'disp', 'width', 'height', 'bytes']),
           '사진 레코드 필드(name·original·takenAt·edited·disp·width·height·bytes): %s' % keys)
        ok(all(str(x['disp']).startswith('data:image/jpeg;base64,') and len(x['disp']) > 20000 for x in ph),
           'disp가 1280px JPEG dataURL (%.0f~%.0fKB)' % (min(len(x['disp']) for x in ph) / 1024,
                                                          max(len(x['disp']) for x in ph) / 1024))
        ok(all((x['width'] or 0) >= 200 and (x['height'] or 0) >= 200 and
               max(x['width'] or 0, x['height'] or 0) <= 1280 for x in ph),
           '가로·세로 크기 기록(1280px 이하 원본 유지): %s' % [(x['width'], x['height']) for x in ph])
        ok(all((x['bytes'] or 0) > 20000 for x in ph), 'bytes 기록: %s' % [x['bytes'] for x in ph][:3])
        ok(all(x['original'] and x['name'] == x['original'] for x in ph),
           '원본 파일명 보존: %s' % [x['original'] for x in ph][:3])
        metas = [m for m in dump.get('metas', []) if m['id'] == rid]
        ok(len(metas) == 1 and metas[0]['count'] == 3 and metas[0]['bytes'] > 60000,
           'results_meta(건수·용량): %s' % (metas[0] if metas else '없음'))
        ls_size = pg.evaluate("() => (localStorage.getItem('ink1fs_history_v1') || '').length")
        ok(ls_size < 20000, 'localStorage 기록은 썸네일 1장만(%.1fKB) — 사진은 IndexedDB로 분리' % (ls_size / 1024))

        # ── 3. 새로고침 → 홈 [열기] → 사진 복원
        pg.reload(wait_until='load')
        pg.wait_for_timeout(1400)
        pg.click('#tabs .tab[data-v=home]')
        pg.wait_for_timeout(400)
        home_txt = pg.inner_text('#histList')
        ok('사진 3장' in home_txt, '홈 최근 원고에 «사진 3장» 표시: ' + home_txt.replace('\n', ' / ')[:120])
        pg.screenshot(path=SHOT_HOME)
        pg.click('#histList .hitem')
        pg.wait_for_function("() => document.querySelectorAll('#resThumbs img').length === 3", timeout=15000)
        pg.wait_for_timeout(500)
        imgs = pg.eval_on_selector_all('#resThumbs img', 'els => els.map(e => e.getAttribute("src"))')
        ok(len(imgs) == 3, '새로고침 후 [열기] → 사진 3장 복원: %d장' % len(imgs))
        ok(all(i.startswith('data:image/jpeg;base64,') and len(i) > 20000 for i in imgs),
           '복원된 사진이 실제 JPEG dataURL')
        ok('📷 사진 3장 포함됨' in pg.inner_text('#resPhotoMeta'),
           '결과 화면 표시: ' + pg.inner_text('#resPhotoMeta'))
        ok('사진 3장' in pg.inner_text('#ghState'), '큐 상태 줄도 사진 3장: ' + pg.inner_text('#ghState').replace('\n', ' '))
        pg.screenshot(path=SHOT)

        # ── 4. 복원된 사진으로 바로발행 전송(mock) — 사진 0장 확인창 없이 사진 PUT
        DIALOG['seen'] = 0
        DIALOG['text'] = []
        GH['calls'].clear()
        pg.click('#ghSend')
        pg.wait_for_timeout(3200)
        ps = puts()
        paths = [put_path(c) for c in ps]
        ok(len(ps) == 5, 'PUT 5회(사진 3 + pack + ready): %d' % len(ps))
        ok(paths[:3] == ['queue/%s/photos/%s' % (paths[0].split('/')[1], n) for n in
                         ['01_shot_a.jpg', '02_shot_b.jpg', '03_shot_c.jpg']],
           '복원한 사진이 순서대로 업로드: %s' % [p.split('/')[-1] for p in paths[:3]])
        jpg = base64.b64decode(ps[0]['body']['content']) if ps else b''
        ok(jpg[:2] == b'\xff\xd8' and len(jpg) > 20000,
           '업로드 본문이 실제 JPEG (%.0fKB)' % (len(jpg) / 1024))
        ok(not any('사진이 없습니다' in t for t in DIALOG['text']),
           '«사진 0장» 확인창이 뜨지 않음: %s' % DIALOG['text'])
        pack = put_json(ps[3]) if len(ps) > 3 else {}
        ok(len(pack.get('photos', [])) == 3, 'pack.json 사진 3장')
        ok(all(x['edited'] is False and x['original'] == 'shot_%s.jpg' % ch for x, ch in
               zip(pack.get('photos', []), 'abc')),
           'pack.json 사진 메타(원본 이름·가리기 여부) 보존: %s'
           % [(x.get('original'), x.get('edited')) for x in pack.get('photos', [])])

        # ── 5. 사진 삭제가 보관본에 반영 → 다시 열면 2장
        pg.click('#goHist')
        pg.wait_for_timeout(300)
        pg.click('#histList .hitem')
        pg.wait_for_function("() => document.querySelectorAll('#resThumbs img').length === 3", timeout=15000)
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(400)
        ok(pg.eval_on_selector_all('#thumbs .thumb', 'els => els.length') == 3,
           '쓰기 탭 사진 격자도 복원된 3장을 그대로 보여준다(숨은 사진 없음)')
        pg.eval_on_selector('#thumbs .thumb button[data-act=del]', 'e => e.click()')
        pg.wait_for_timeout(900)
        ok(pg.eval_on_selector_all('#thumbs .thumb', 'els => els.length') == 2, '사진 1장 삭제 → 2장')
        pg.wait_for_timeout(700)
        rec = [r for r in idb(pg)['recs'] if r['id'] == rid]
        ok(rec and len(rec[0]['photos']) == 2, '삭제가 IndexedDB 보관본에도 반영: %d장'
           % (len(rec[0]['photos']) if rec else -1))
        pg.reload(wait_until='load')
        pg.wait_for_timeout(1400)
        pg.click('#tabs .tab[data-v=home]')
        pg.wait_for_timeout(300)
        pg.click('#histList .hitem')
        pg.wait_for_function("() => document.querySelectorAll('#resThumbs img').length === 2", timeout=15000)
        ok(True, '새로고침 후 [열기] → 삭제 반영된 사진 2장')

        # ── 6. 최근 20건만 유지 — 오래된 보관본 자동 정리
        idb_seed(pg, 24)
        seeded = len(idb(pg)['recs'])
        ok(seeded == 25, '검사용으로 오래된 보관본 24건 심음(총 %d건)' % seeded)
        GH['calls'].clear()
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(300)
        pg.click('#cats .cat[data-c="AS"]')
        pg.set_input_files('#fileInput', [str(IMG[0])])
        pg.wait_for_timeout(1800)
        pg.fill('#memo', '두 번째 현장 — 보관 개수 정리 검사.')
        pg.click('#makeBtn')
        pg.wait_for_function("() => !document.querySelector('#resultBody').classList.contains('hidden')", timeout=20000)
        pg.wait_for_timeout(1200)
        pg.wait_for_function("""() => new Promise((res) => {
          const rq = indexedDB.open('ink1_field_studio_db');
          rq.onsuccess = () => {
            const tx = rq.result.transaction('results_meta', 'readonly');
            const g = tx.objectStore('results_meta').getAllKeys();
            g.onsuccess = () => res(g.result.length <= 20);
            g.onerror = () => res(false);
          };
          rq.onerror = () => res(false);
        })""", timeout=15000)
        dump2 = idb(pg)
        n_now = len(dump2['metas'])
        ids_now = [m['id'] for m in dump2['metas']]
        ok(n_now == 20, '보관본이 20건으로 정리됨: %d건' % n_now)
        ok('seed_1' not in ids_now and 'seed_5' not in ids_now,
           '오래된 것부터 삭제(seed_1~5 사라짐): seed_1=%s seed_5=%s' % ('seed_1' in ids_now, 'seed_5' in ids_now))
        ok('seed_24' in ids_now, '최근 것(seed_24)은 유지')
        ok(len([m for m in dump2['recs'] if m['id'] == rid]) == 1, '방금 만든 원고의 사진도 남아 있음')

        # ── 7. 기록 지우기 → 보관 사진도 함께 삭제
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('#clearHistBtn').scrollIntoView({block:'center'})")
        pg.wait_for_timeout(300)
        ok('사진 보관' in pg.inner_text('#lsUse'), '설정에 사진 보관 현황 표시: ' + pg.inner_text('#lsUse'))
        DIALOG['text'] = []
        pg.click('#clearHistBtn')
        pg.wait_for_timeout(1200)
        ok(any('사진' in t for t in DIALOG['text']), '기록 삭제 확인창이 사진도 지운다고 안내: %s' % DIALOG['text'])
        pg.wait_for_function("""() => new Promise((res) => {
          const rq = indexedDB.open('ink1_field_studio_db');
          rq.onsuccess = () => {
            const tx = rq.result.transaction(['photos_by_result', 'results_meta'], 'readonly');
            const a = tx.objectStore('photos_by_result').count();
            const b = tx.objectStore('results_meta').count();
            tx.oncomplete = () => res(a.result === 0 && b.result === 0);
            tx.onerror = () => res(false);
          };
          rq.onerror = () => res(false);
        })""", timeout=15000)
        ok(True, '기록 삭제 → IndexedDB 사진·메타 0건')

        # ── 8. 서비스워커 v6 · 가로 스크롤 0 · 콘솔 오류 0
        pg.wait_for_timeout(800)
        ck = pg.evaluate("caches.keys()")
        ok('ink1-field-studio-v6' in ck, '서비스워커 v6 캐시 활성: %s' % ck)
        for v in ['write', 'result', 'settings', 'home']:
            pg.click('#tabs .tab[data-v=%s]' % v)
            pg.wait_for_timeout(200)
            hs = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            ok(hs == 0, '%s 탭 가로 스크롤 %dpx' % (v, hs))
        ok(not errs, '콘솔·페이지 오류 0건' + (': ' + '; '.join(errs[:4]) if errs else ''))
        b.close()
    if srv:
        srv.shutdown()

    print('\n=== 결과: %d 통과 / 실패 %d ===' % (stat['pass'], len(fails)))
    if fails:
        for f in fails:
            print(' - ' + f)
        return 1
    print('전부 통과 · 스크린샷:', SHOT, '/', SHOT_HOME)
    return 0


if __name__ == '__main__':
    sys.exit(main())
