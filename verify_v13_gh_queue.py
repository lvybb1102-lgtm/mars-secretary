#!/usr/bin/env python3
"""잉크원_st_AI v1.3 검증 — ⚡ 원클릭 바로발행 큐 (비공개 GitHub 저장소)

사용: python3 verify_v13_gh_queue.py            # 로컬(127.0.0.1) 서빙해 검증
      python3 verify_v13_gh_queue.py <배포URL>   # 배포 URL 그대로 검증

Gemini·GitHub API 응답은 mock. 430x932 모바일 뷰포트.
GitHub 큐 규약(사진 → pack.json → ready.json, pack.json 사진 base64 금지, ready.json 키 7개)을
요청 본문(base64)까지 풀어서 검사한다.
"""
import base64, functools, http.server, json, os, pathlib, sys, threading, time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
ROOT = pathlib.Path('/workspace/work/mars_secretary_pages')
SHOT = '/workspace/downloads/잉크원_st_AI_바로발행_큐.png'
SHOT_SET = '/workspace/downloads/잉크원_st_AI_바로발행_큐_설정.png'
SHOT_RES = '/workspace/downloads/잉크원_st_AI_바로발행_큐_결과.png'
IMG = [ROOT.parent / 'ink1fs/testimg/shot_a.jpg', ROOT.parent / 'ink1fs/testimg/shot_b.jpg',
       ROOT.parent / 'ink1fs/testimg/shot_c.jpg']

BLOG = ('<h2>접수한 증상</h2><p>성서공단 사무실 복합기에서 용지가 자꾸 걸린다는 연락을 받고 방문했습니다. '
        '양면 인쇄에서만 걸리고 단면은 괜찮다는 이야기였습니다. 오전에 서너 번은 걸린 종이를 빼내고 다시 돌렸는데도 같은 자리에서 반복됐고, '
        '카세트를 바꿔도 증상이 같다고 하셨습니다. 이 경우 기계 전체를 바꾸기보다 급지 경로부터 순서대로 보는 편이 빠릅니다.</p>'
        '<h2>원인 진단</h2><p>원인은 급지롤러 마모였습니다. 롤러 표면이 매끈해져 종이를 제대로 끌어올리지 못하면, '
        '단면은 급지 여유가 있어 지나가지만 양면은 한 번 돌아 나온 종이를 다시 끌어올려야 해서 같은 힘이 더 필요합니다. '
        '그래서 양면에서만 걸리는 증상이 자주 나옵니다. 롤러를 빼서 만져 보면 표면이 딱딱하고 고무의 탄력이 거의 없었습니다. '
        '카세트 안쪽에는 종이 붙음 먼지도 끼어 있었습니다.</p>'
        '<h2>현장 조치</h2><ul><li>급지롤러·픽업롤러 교체</li><li>카세트 내부 먼지와 종이 부스러기 제거</li>'
        '<li>급지 압력과 가이드 위치 확인</li><li>양면 경로 롤러 청소</li></ul>'
        '<p>부품을 바꾸고 가이드를 용지 폭에 맞춘 뒤에는 같은 자리에서 걸리지 않았습니다. '
        '급지롤러는 소모품이라 마모 정도를 눈으로 보기 어려워, 증상이 반복되면 교체 시기를 먼저 확인하는 것이 좋습니다.</p>'
        '<h2>확인</h2><p>양면 20매를 연속으로 시험 출력해 걼림과 비틀림 모두 없는 것을 확인했습니다. '
        '스캔과 복사도 한 장씩 떠서 문제가 없는지 봤고, 카세트를 넣고 빼는 과정에서도 더 이상 걸리지 않았습니다.</p>'
        '<h2>자주 묻는 질문</h2><p><b>Q. 급지롤러 교체 주기는?</b> 보통 10만 매 전후입니다. 사용량이 많으면 더 짧아집니다.</p>'
        '<p><b>Q. 단면은 괜찮은데 양면만 걸리면 롤러 문제인가요?</b> 가장 흔한 원인입니다. 다만 용지 습기나 가이드 위치도 함께 봅니다.</p>'
        '<h2>상담 안내</h2><p>잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · https://ink1.kr/</p>'
        '<p>경기 수원시 권선구 경수대로235번길 62-26 1층</p>'
        '<p>#수원복합기 #복합기수리 #급지롤러 #복합기임대 #수원사무기기 #AS후기 #아싸렌탈 #잉크원</p>')

MOCK = """[TOPIC] 복합기 급지 걸림, 급지롤러 마모가 원인입니다
[TITLE1] 복합기 양면 인쇄만 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사
[TITLE2] 복합기 용지 걸림이 반복될 때 무엇을 보나요? /아싸렌탈수원지사
[TITLE3] 성서공단 사무실 복합기 AS 현장, 이렇게 해결했습니다 /아싸렌탈수원지사
[BLOG] """ + BLOG + """
[TAGS] #수원복합기 #복합기수리 #급지롤러 #복합기임대 #수원사무기기 #AS후기 #아싸렌탈 #잉크원
[THREADS] 복합기에서 양면만 걸린다면 급지롤러를 먼저 봅니다. 롤러 표면이 닳으면 종이를 끌어올리는 힘이 달라져 양면 경로에서 자주 멈춥니다. 급지롤러를 교체하고 픽업롤러와 카세트 먼지를 정리한 뒤 양면 20매를 시험 출력해 확인했습니다. 같은 증상이 반복되면 롤러 교체 시기를 한 번 점검해 보세요.
[SHORTS] 0-3초|양면만 걸린다면 급지롤러|단면은 되는데 양면만 멈춘다면
[SHORTS] 3-9초|급지롤러 마모 확인|롤러 교체·픽업롤러 청소·카세트 먼지 제거
[SHORTS] 9-15초|양면 20매 시험 출력|잉크원·아싸렌탈, 1544-4065
[INSTA] 수원 사무실 복합기 양면 걸림, 급지롤러 교체로 해결했습니다.
급지롤러를 바꾸고 픽업롤러와 카세트 먼지를 정리한 뒤 양면 20매를 시험 출력했습니다.
━━━━━━━━━━━━━━━━━━━━
🏢 잉크원 · 아싸렌탈 수원지사
📍 경기남부
📞 1544-4065
📝 blog.naver.com/lvyhs621
🌐 https://ink1.kr/
#수원복합기 #복합기수리 #급지롤러 #복합기임대
[YT_TITLE] 복합기 양면 걸림, 급지롤러 교체로 끝났습니다
[YT_DESC] 급지롤러 마모가 원인이었습니다."""

stat = {'pass': 0}
fails = []
GH = {'mode': 'ok', 'collision': False, 'sha_once': False, 'calls': []}


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
    'Access-Control-Expose-Headers': 'ETag',
    'Content-Type': 'application/json',
}

REPO = {"full_name": "lvybb1102-lgtm/ink1-publish-queue", "private": True,
        "default_branch": "main", "permissions": {"admin": True, "push": True, "pull": True}}


def gh_handler(route):
    req = route.request
    url = req.url
    path = url.split('api.github.com', 1)[1]
    if req.method == 'OPTIONS':
        route.fulfill(status=204, headers=ACAO, body='')
        return
    body = None
    if req.method == 'PUT':
        try:
            body = json.loads(req.post_data)
        except Exception:
            body = {}
    GH['calls'].append({'method': req.method, 'url': url, 'path': path, 'body': body,
                        'auth': req.headers.get('authorization', '')})

    if GH['mode'] == 'forbidden':
        route.fulfill(status=403, headers=ACAO, body=json.dumps({"message": "Resource not accessible by integration"}))
        return
    if GH['mode'] == 'notfound':
        route.fulfill(status=404, headers=ACAO, body=json.dumps({"message": "Not Found"}))
        return

    if req.method == 'GET' and '/contents/' not in path:
        route.fulfill(status=200, headers=ACAO, body=json.dumps(REPO))
        return

    if req.method == 'GET':
        if GH['collision']:
            GH['collision'] = False
            route.fulfill(status=200, headers=ACAO, body=json.dumps([{"name": "ready.json", "type": "file", "sha": "abc"}]))
            return
        if GH['sha_once']:
            route.fulfill(status=200, headers=ACAO, body=json.dumps({"name": "x", "sha": "deadbeef", "type": "file"}))
            return
        route.fulfill(status=404, headers=ACAO, body=json.dumps({"message": "Not Found"}))
        return

    if req.method == 'PUT':
        if GH['sha_once'] and 'sha' not in (body or {}):
            route.fulfill(status=422, headers=ACAO, body=json.dumps({"message": "sha wasn't supplied"}))
            return
        GH['sha_once'] = False
        route.fulfill(status=201, headers=ACAO, body=json.dumps({
            "content": {"name": (body or {}).get('message', ''), "path": path.split('/contents/')[-1],
                        "html_url": "https://github.com/lvybb1102-lgtm/ink1-publish-queue/blob/main/" + path.split('/contents/')[-1]},
            "commit": {"sha": "c0ffee"}}))
        return
    route.fulfill(status=200, headers=ACAO, body='{}')


def puts():
    return [c for c in GH['calls'] if c['method'] == 'PUT']


def put_path(c):
    return urlparse(c['url']).path.split('/contents/', 1)[1]


def put_json(c):
    return json.loads(base64.b64decode(c['body']['content']).decode('utf-8'))


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
        ctx.add_init_script("localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');")
        pg = ctx.new_page()
        errs = []
        err_all = []
        pg.on('pageerror', lambda e: err_all.append('pageerror: ' + str(e)))

        def on_console(m):
            if m.type != 'error':
                return
            loc = (m.location or {}).get('url', '')
            err_all.append('console.error: ' + m.text + ' @' + loc)
            # 의도적으로 실패시키는 mock 응답(403·404)의 네트워크 오류는 제외
            if 'Failed to load resource' in m.text and 'api.github.com' in loc:
                return
            errs.append(m.text + ' @' + loc)

        pg.on('console', on_console)

        pg.route('**/generativelanguage.googleapis.com/**', lambda r: r.fulfill(
            status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
            body=json.dumps({"candidates": [{"content": {"parts": [{"text": MOCK}]}, "finishReason": "STOP"}],
                             "usageMetadata": {"totalTokenCount": 1200}})))
        pg.route('**://api.github.com/**', gh_handler)

        pg.goto(url, wait_until='load')
        pg.wait_for_timeout(1200)

        # ── 1. 설정(⚙) 「⚡ 원클릭 바로발행 큐 (GitHub)」 섹션
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(300)
        ok(pg.is_visible('#ghRepo') and pg.is_visible('#ghToken'), '설정 탭에 저장소·토큰 입력란 표시')
        ok(pg.get_attribute('#ghRepo', 'placeholder') == 'lvybb1102-lgtm/ink1-publish-queue',
           '저장소 플레이스홀더: ' + str(pg.get_attribute('#ghRepo', 'placeholder')))
        ok(pg.get_attribute('#ghToken', 'type') == 'password', '토큰 입력란 type=password(가림)')
        ok(pg.is_visible('#ghTest') and pg.inner_text('#ghTest').strip() == '연결 테스트', '[연결 테스트] 버튼')
        ok(pg.inner_text('#ghBadge').strip() == '미설정', '처음 상태 배지: ' + pg.inner_text('#ghBadge').strip())

        # 저장 → localStorage 키
        pg.fill('#ghRepo', 'lvybb1102-lgtm/ink1-publish-queue')
        pg.fill('#ghToken', 'github_pat_TESTTOKEN123')
        pg.click('#ghSave')
        pg.wait_for_timeout(300)
        ls = pg.evaluate("({r: localStorage.getItem('ink1fs_gh_repo_v1'), t: localStorage.getItem('ink1fs_gh_token_v1')})")
        ok(ls.get('r') == 'lvybb1102-lgtm/ink1-publish-queue', 'localStorage ink1fs_gh_repo_v1: ' + str(ls.get('r')))
        ok(ls.get('t') == 'github_pat_TESTTOKEN123', 'localStorage ink1fs_gh_token_v1 저장')
        ok(pg.inner_text('#ghBadge').strip() == '설정됨', '저장 후 배지: ' + pg.inner_text('#ghBadge').strip())

        # ── 2. 연결 테스트 (정상 · 비공개 · 쓰기 가능)
        GH['calls'].clear()
        pg.click('#ghTest')
        pg.wait_for_timeout(700)
        t = pg.inner_text('#ghTestOut')
        ok('연결됨' in t and '비공개' in t and '쓰기 가능' in t, '연결 테스트 결과 문구: ' + t.replace('\n', ' / '))
        ok(pg.inner_text('#ghBadge').strip() == '연결됨', '연결 성공 배지: ' + pg.inner_text('#ghBadge').strip())
        rep = [c for c in GH['calls'] if '/contents/' not in c['path']]
        ok(len(rep) == 1 and rep[0]['method'] == 'GET' and rep[0]['path'] == '/repos/lvybb1102-lgtm/ink1-publish-queue',
           'GET /repos/{owner}/{repo} 호출: %s' % (rep[0]['path'] if rep else '없음'))
        ok(rep and rep[0]['auth'] == 'Bearer github_pat_TESTTOKEN123', '토큰을 Bearer로 전송')

        # ── 3. 연결 테스트 실패(403) → 안내 문구
        GH['mode'] = 'forbidden'
        pg.click('#ghTest')
        pg.wait_for_timeout(600)
        t = pg.inner_text('#ghTestOut')
        ok('권한이 없습니다' in t, '403 → 권한 안내: ' + t)
        ok(pg.inner_text('#ghBadge').strip() == '미연결', '실패 배지: ' + pg.inner_text('#ghBadge').strip())
        GH['mode'] = 'ok'

        # ── 4. 원고 만들기 (사진 3장)
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(300)
        pg.click('#cats .cat[data-c="AS"]')
        pg.wait_for_timeout(150)
        pg.set_input_files('#fileInput', [str(p) for p in IMG])
        pg.wait_for_timeout(2500)
        ok(pg.inner_text('#photoMeta').startswith('3/'), '사진 3장 추가: ' + pg.inner_text('#photoMeta'))
        pg.fill('#memo', '성서공단 사무실, 양면만 걸림. 급지롤러 교체하고 양면 20매 시험 출력.')
        pg.click('#makeBtn')
        pg.wait_for_function("() => !document.querySelector('#resultBody').classList.contains('hidden')", timeout=20000)
        pg.wait_for_timeout(600)
        ok(pg.is_visible('#ghSend'), '결과 화면에 [⚡ 니케에게 바로발행 전송] 표시')
        ok('바로발행 전송' in pg.inner_text('#ghSend') and '사진+원고' in pg.inner_text('#ghSend'),
           '버튼 이름: ' + pg.inner_text('#ghSend'))
        ok(pg.eval_on_selector('#ghSend', 'e => e.classList.contains("btn")'), '주 버튼 스타일(btn)')
        ok(pg.eval_on_selector('#p2Card', 'e => e.offsetTop < document.querySelector("#chList").offsetTop'),
           'P2 카드 맨 위(채널 목록 위)에 배치')
        ok('큐' in pg.inner_text('#ghState') and 'ink1-publish-queue' in pg.inner_text('#ghState'),
           '큐 상태 줄: ' + pg.inner_text('#ghState').replace('\n', ' '))

        # ── 5. 전송 성공 흐름 (mock) — 순서·본문 규약
        pg.evaluate("""() => {
          window.__gh = [];
          const t = document.querySelector('#ghProg');
          new MutationObserver(() => {
            const v = t.textContent;
            if (v && window.__gh[window.__gh.length - 1] !== v) window.__gh.push(v);
          }).observe(t, {childList: true, characterData: true, subtree: true});
        }""")
        GH['calls'].clear()
        GH['collision'] = False
        pg.click('#ghSend')
        pg.wait_for_function("() => window.__gh && window.__gh.length && window.__gh[window.__gh.length-1].indexOf('완료!') === 0",
                             timeout=20000)
        pg.wait_for_timeout(400)
        seq = pg.evaluate('window.__gh')
        ps = puts()
        paths = [put_path(c) for c in ps]
        ok(len(ps) == 5, 'PUT 5회(사진 3 + pack + ready): %d' % len(ps))
        ok([p.split('/')[-1] for p in paths[:3]] == ['01_shot_a.jpg', '02_shot_b.jpg', '03_shot_c.jpg'],
           '사진 경로 규약 queue/{id}/photos/{idx}_{이름}: %s' % [p.split('/')[-1] for p in paths[:3]])
        rid = paths[0].split('/')[1]
        ok(paths[0] == 'queue/%s/photos/01_shot_a.jpg' % rid, '첫 업로드 경로: ' + paths[0])
        ok(paths[3] == 'queue/%s/pack.json' % rid and paths[4] == 'queue/%s/ready.json' % rid,
           'pack.json → ready.json 순서(마지막이 ready): %s' % [p.split('/')[-1] for p in paths])
        ok(all(c['url'].startswith('https://api.github.com/repos/lvybb1102-lgtm/ink1-publish-queue/contents/') for c in ps),
           'PUT 대상: /repos/{owner}/{repo}/contents/…')
        ok(all(c['auth'] == 'Bearer github_pat_TESTTOKEN123' for c in ps), '모든 업로드에 토큰 헤더')

        jpg = base64.b64decode(ps[0]['body']['content'])
        ok(jpg[:2] == b'\xff\xd8' and len(jpg) > 3000, '사진 본문이 실제 JPEG base64 (%.1fKB)' % (len(jpg) / 1024))
        ok('ink1 queue ' + rid in ps[0]['body']['message'], '커밋 메시지에 요청 ID: ' + ps[0]['body']['message'])

        pack = put_json(ps[3])
        ok(len(pack.get('photos', [])) == 3, 'pack.json 사진 목록 3장')
        ok(all(x.get('path', '').startswith('queue/%s/photos/' % rid) for x in pack['photos']),
           'pack.json 사진은 경로만 참조: %s' % [x.get('path') for x in pack['photos']])
        raw_pack = json.dumps(pack)
        ok('dataUrl' not in raw_pack and 'base64,' not in raw_pack, 'pack.json 안에 사진 base64 없음(중복 용량 방지)')
        ok(pack['queue']['ready_path'] == 'queue/%s/ready.json' % rid, 'pack.json에 ready 경로 명시')
        ok(pack['requestId'] == rid, 'pack.json requestId = %s' % pack.get('requestId'))
        ok(len(pack['article']['blogHtml']) > 500 and len(pack['article']['blogText']) > 200, '원고 본문 포함')
        ok(len(pack['channels']) == 5 and 'naver' in pack['channels'], '선택 채널 5개: %s' % pack['channels'])
        ok(pack['article']['title'].endswith('/아싸렌탈수원지사'), '선택한 제목 그대로: ' + pack['article']['title'])

        ready = put_json(ps[4])
        keys = sorted(ready.keys())
        want = sorted(['request_id', 'title', 'brand', 'channels', 'photo_count', 'created_at', 'status'])
        ok(keys == want, 'ready.json 키 규약 정확히 일치: %s' % keys)
        ok(ready['request_id'] == rid and ready['status'] == 'pending', 'ready.json request_id·status=pending')
        ok(ready['photo_count'] == 3 and ready['brand'] == 'ink1', 'ready.json photo_count=3 · brand=ink1')
        ok(ready['channels'] == pack['channels'], 'ready.json channels = pack.json channels')
        ok(ready['title'] == pack['article']['title'], 'ready.json title = 선택 제목')
        ok(len(ready['created_at']) >= 19 and ready['created_at'][4] == '-', 'created_at ISO: ' + ready['created_at'])

        # 진행률 문구
        ok(any('사진 1/3 올리는 중' in s for s in seq), '진행률 «사진 1/3 올리는 중…»: %s' % seq[:3])
        ok(any('사진 3/3 올리는 중' in s for s in seq), '진행률 «사진 3/3 올리는 중…»')
        ok(any('원고 올리는 중' in s for s in seq), '진행률 «원고 올리는 중…»')
        ok(seq[-1].startswith('완료!') and '5분' in seq[-1], '완료 문구: ' + seq[-1])
        out = pg.inner_text('#ghOut')
        ok(rid in out and '전송 완료' in out, '결과 문구에 요청 ID·전송 완료: ' + out.replace('\n', ' / '))
        ok(pg.eval_on_selector('#ghBar', 'e => getComputedStyle(e).width') != '0px', '진행 바 100% 표시')

        # 발행 로그 · 채널 상태
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(300)
        log = pg.inner_text('#pubLogList')
        ok('GitHub 큐' in log and '발행요청' in log, '발행 로그에 ⚡ GitHub 큐 기록')
        pg.click('#tabs .tab[data-v=result]')
        pg.wait_for_timeout(300)
        sts = pg.eval_on_selector_all('#chList .chstatus', 'els => els.map(e => e.textContent)')
        ok(sts.count('발행요청') == 5, '선택 채널 5개 상태 대기→발행요청: %s' % sts)

        # ── 스크린샷 — 성공한 그 상태(사진 3장) 그대로
        pg.wait_for_timeout(2600)              # 토스트가 사라진 뒤
        pg.evaluate("document.querySelector('#p2Card').scrollIntoView({block:'start'})")
        pg.wait_for_timeout(600)
        pg.screenshot(path=SHOT_RES)
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('#ghRepo').closest('.card').scrollIntoView({block:'start'})")
        pg.wait_for_timeout(500)
        pg.click('#ghTest')
        pg.wait_for_timeout(900)
        pg.wait_for_timeout(2600)
        pg.screenshot(path=SHOT_SET)
        from PIL import Image
        a = Image.open(SHOT_RES)
        c = Image.open(SHOT_SET)
        h = min(a.height, c.height)
        a = a.crop((0, 0, a.width, h))
        c = c.crop((0, 0, c.width, h))
        comb = Image.new('RGB', (a.width + c.width + 16, h), (238, 243, 240))
        comb.paste(a, (0, 0))
        comb.paste(c, (a.width + 16, 0))
        comb.save(SHOT)
        pg.click('#tabs .tab[data-v=result]')
        pg.wait_for_timeout(300)

        # ── 6. 같은 ID 충돌 → 접미사
        GH['calls'].clear()
        GH['collision'] = True
        pg.once('dialog', lambda d: d.accept())
        pg.click('#ghSend')
        pg.wait_for_timeout(2500)
        ps2 = puts()
        paths2 = [put_path(c) for c in ps2]
        ok(len(ps2) == 5 and paths2[0].split('/')[1].endswith('-2'),
           '같은 ID가 있으면 접미사(-2)로 충돌 회피: ' + (paths2[0].split('/')[1] if paths2 else '없음'))
        ok(paths2[-1].endswith('/ready.json'), '충돌 회피 후에도 ready.json이 마지막')

        # ── 7. 실패 처리 — 404면 ready.json 올리지 않음
        GH['calls'].clear()
        GH['mode'] = 'notfound'
        pg.once('dialog', lambda d: d.accept())
        pg.click('#ghSend')
        pg.wait_for_timeout(1600)
        ps3 = puts()
        ok(not any(put_path(c).endswith('ready.json') for c in ps3), '실패 시 ready.json 미업로드(미완성 건 안 집힘)')
        ok('찾을 수 없습니다' in pg.inner_text('#ghOut'), '404 안내 문구: ' + pg.inner_text('#ghOut'))
        GH['mode'] = 'ok'

        # ── 8. sha 덮어쓰기(422 → sha 조회 → 재시도)
        GH['calls'].clear()
        GH['sha_once'] = True
        pg.once('dialog', lambda d: d.accept())
        pg.click('#ghSend')
        pg.wait_for_timeout(2500)
        ps4 = puts()
        ok(any(c['body'].get('sha') == 'deadbeef' for c in ps4), '422 응답 시 sha 조회 후 덮어쓰기')
        ok(any(put_path(c).endswith('ready.json') for c in ps4), 'sha 재시도 후 ready.json 까지 완료')

        # ── 9. 토큰 없음 → 안내(업로드 시도 0)
        pg.evaluate("localStorage.removeItem('ink1fs_gh_token_v1')")
        pg.evaluate("localStorage.removeItem('ink1fs_publish_v1')")   # 발행 기록 초기화 → 중복 확인창 없이 검사
        pg.reload(wait_until='load')
        pg.wait_for_timeout(1000)
        GH['calls'].clear()
        pg.click('#tabs .tab[data-v=home]')
        pg.wait_for_timeout(300)
        pg.click('#histList .hitem')
        pg.wait_for_timeout(500)
        ok(pg.is_visible('#ghSend'), '기록에서 연 원고에도 버튼 표시')
        pg.click('#ghSend')
        pg.wait_for_timeout(500)
        t = pg.inner_text('#ghOut')
        ok('토큰' in t and ('없습니다' in t or '먼저' in t), '토큰 미입력 안내: ' + t)
        ok(len(puts()) == 0, '토큰 없으면 업로드 시도 0회')
        ok('미설정' in pg.inner_text('#ghState'), '상태 줄도 미설정 안내로 바뀜: ' + pg.inner_text('#ghState'))
        pg.evaluate("localStorage.setItem('ink1fs_gh_token_v1','github_pat_TESTTOKEN123')")

        # ── 9b. 사진 없는 원고(기록에서 열림) → 확인창 한 번 거친다
        pg.once('dialog', lambda d: d.dismiss())
        GH['calls'].clear()
        pg.click('#ghSend')
        pg.wait_for_timeout(500)
        ok(len(puts()) == 0, '사진 없는 원고 — 확인창에서 취소하면 업로드 0회')
        pg.once('dialog', lambda d: d.accept())
        pg.click('#ghSend')
        pg.wait_for_timeout(2600)
        ps5 = puts()
        ok(len(ps5) == 2 and put_path(ps5[0]).endswith('pack.json') and put_path(ps5[1]).endswith('ready.json'),
           '사진 0장이면 pack.json → ready.json 2회만 업로드: %s' % [put_path(c).split('/')[-1] for c in ps5])
        ok(ps5 and put_json(ps5[1])['photo_count'] == 0, 'ready.json photo_count=0 (사진 없음)')

        # ── 10. 서비스워커 v5 · 오프라인 캐시
        sw = pg.evaluate("navigator.serviceWorker.ready.then(() => true).catch(() => false)")
        ok(sw is True, '서비스워커 등록')
        ck = pg.evaluate("caches.keys()")
        ok('ink1-field-studio-v5' in ck, '서비스워커 v5 캐시 활성: %s' % ck)

        # ── 11. 실네트워크 확인 — 토큰 없이 공개 저장소 GET(진짜 api.github.com)
        ctx2 = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2, has_touch=True, is_mobile=True)
        real = ctx2.new_page()
        real_errs = []
        real.on('pageerror', lambda e: real_errs.append(str(e)))
        real.goto(url, wait_until='load')
        real.wait_for_timeout(900)
        real.click('#tabs .tab[data-v=settings]')
        real.wait_for_timeout(250)
        real.fill('#ghRepo', 'lvybb1102-lgtm/mars-secretary')
        real.fill('#ghToken', '')
        real.click('#ghSave')
        real.wait_for_timeout(200)
        real.click('#ghTest')
        real.wait_for_timeout(2500)
        rt = real.inner_text('#ghTestOut')
        ok('연결됨' in rt and '토큰 없음' in rt, '실제 api.github.com GET(토큰 없이) 성공: ' + rt.replace('\n', ' / '))
        ctx2.close()

        # ── 12. 스크린샷은 전송 직후(사진 3장 상태)에 이미 저장

        # ── 13. 가로 스크롤 0 · 콘솔 오류 0
        for v in ['write', 'result', 'settings', 'home']:
            pg.click('#tabs .tab[data-v=%s]' % v)
            pg.wait_for_timeout(200)
            hs = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            ok(hs == 0, '%s 탭 가로 스크롤 %dpx' % (v, hs))
        ok(not errs, '콘솔·페이지 오류 0건' + (': ' + '; '.join(errs[:4]) if errs else ''))
        ok(not real_errs, '실네트워크 페이지 오류 0건')
        b.close()
    if srv:
        srv.shutdown()

    print('\n=== 결과: %d 통과 / 실패 %d ===' % (stat['pass'], len(fails)))
    if fails:
        for f in fails:
            print(' - ' + f)
        return 1
    print('전부 통과 · 스크린샷:', SHOT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
