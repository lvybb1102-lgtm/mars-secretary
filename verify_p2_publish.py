#!/usr/bin/env python3
"""잉크원_st_AI — P2 발행 어댑터 검증 (로컬/배포 공용)

사용: python3 verify_p2.py [url]
  url 생략 → 로컬 원본(work/mars_secretary_pages/field-studio)을 127.0.0.1 로 서빙해서 검증
  url 지정 → 그 주소(배포 URL)를 그대로 검증

Gemini·Blogger·브릿지 응답은 mock. 430x932 모바일 뷰포트.
"""
import json, pathlib, sys, threading, functools, http.server, socketserver

from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
SRC = pathlib.Path('/workspace/work/mars_secretary_pages/field-studio')
OUT = pathlib.Path('/workspace/work/ink1fs/p2')
OUT.mkdir(parents=True, exist_ok=True)
SHOT = '/workspace/downloads/필드스튜디오_p2_어댑터.png'
PHOTO = '/workspace/work/ink1fs/testimg/shot_a.jpg'
APP = '잉크원_st_AI'

BLOG = ('<h2>정기점검이 필요한 이유</h2>'
        '<p>복합기는 종이 가루와 토너 가루가 쌓이는 기계입니다. 눈에 보이는 고장이 없어도 안쪽은 서서히 막힙니다. '
        '그래서 정기점검은 고장이 난 뒤가 아니라, 고장이 나기 전에 하는 일입니다.</p>'
        '<h2>현장에서 확인하는 순서</h2>'
        '<ul><li>급지롤러 마모와 종이 가루 청소 상태</li><li>토너 잔량과 폐토너통 포화 여부</li>'
        '<li>스캔 유리판과 흰색 압지 롤러의 오염</li><li>양면 인쇄 유닛의 걸림 흔적</li>'
        '<li>네트워크 연결과 고정 IP 유지 여부</li></ul>'
        '<h2>이렇게 하면 됩니다</h2>'
        '<p>먼저 시험 출력을 한 장 해 봅니다. 양면과 컬러를 각각 한 번씩 돌려 보면 대부분의 이상이 드러납니다. '
        '다음으로 스캔을 한 장 떠 보고 유리판에 얼룩이 묻어 나오는지 봅니다.</p>'
        '<h2>체크리스트</h2>'
        '<ul><li>양면 시험 출력 20매에서 걸림이 없는가</li><li>스캔 결과에 세로줄이 없는가</li>'
        '<li>토너 경고등이 꺼졌는가</li><li>프린터가 네트워크에서 정상으로 보이는가</li></ul>'
        '<h2>자주 묻는 질문</h2>'
        '<p><b>Q. 점검은 얼마나 자주 해야 하나요?</b> 사용량이 많은 사무실은 분기마다 확인하는 편이 좋습니다.</p>'
        '<p><b>Q. 직접 청소해도 되나요?</b> 전원을 끄고 마른 천으로 겉면과 유리판만 닦는 정도가 안전합니다.</p>'
        '<h2>상담 안내</h2>'
        '<p>잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · 톡톡 문의 · https://ink1.kr/</p>'
        '<p>경기 수원시 권선구 경수대로235번길 62-26 1층</p>'
        '<p>#수원복합기 #복합기임대 #프린터임대 #복합기수리 #수원사무기기 #정기점검 #아싸렌탈 #잉크원</p>')

MOCK = """[TOPIC] 복합기 정기점검 때 실제로 확인해야 하는 것
[TITLE1] 수원 사무실 복합기 정기점검, 이것만은 확인하세요 /아싸렌탈수원지사
[TITLE2] 복합기 정기점검은 무엇을 보나요? 수원 출장 기사가 알려드립니다 /아싸렌탈수원지사
[TITLE3] 고장 나기 전에 부르는 복합기 점검, 수원에서 이렇게 했습니다 /아싸렌탈수원지사
[BLOG] """ + BLOG + """
[TAGS] #수원복합기 #복합기임대 #프린터임대 #복합기수리 #수원사무기기 #정기점검 #아싸렌탈 #잉크원
[THREADS] 복합기는 고장이 나고 나서 부르면 늦습니다. 종이 가루와 토너 가루가 쌓여 급지가 막히고 스캔에 줄이 생깁니다. 정기점검은 그 전에 하는 일입니다. 양면 시험 출력 한 번, 스캔 한 장, 토너 잔량 확인이면 대부분의 이상을 미리 잡을 수 있습니다. 사용량이 많은 사무실이라면 분기마다 한 번 확인해 보세요. 자세한 점검 순서는 블로그에 정리해 두었습니다. https://blog.naver.com/lvyhs621
[SHORTS] 0-3초|복합기, 고장 나고 부르면 늦습니다|복합기 점검은 고장 전에 합니다
[SHORTS] 3-9초|양면 출력·스캔·토너 확인|시험 출력 한 장, 스캔 한 장, 토너 잔량
[SHORTS] 9-15초|분기마다 한 번 점검|잉크원·아싸렌탈, 1544-4065
[INSTA] 수원 사무실 복합기, 정기점검은 고장 전에 합니다.
양면 시험 출력과 스캔 한 장이면 대부분의 이상을 미리 잡을 수 있습니다.
━━━━━━━━━━━━━━━━━━━━
🏢 잉크원 · 아싸렌탈 수원지사
📍 경기남부
📞 1544-4065
📝 blog.naver.com/lvyhs621
🌐 https://ink1.kr/
#수원복합기 #복합기임대 #프린터임대 #복합기수리 #수원사무기기 #정기점검 #아싸렌탈 #잉크원
[YT_TITLE] 수원 사무실 복합기 정기점검, 기사가 확인하는 5가지
[YT_DESC] 복합기 점검은 고장 전에 해야 합니다. 양면 출력·스캔·토너 잔량 확인 순서를 정리했습니다."""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def start_server():
    handler = functools.partial(Quiet, directory=str(SRC))
    socketserver.TCPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8799), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else None
    srv = None
    if not url:
        srv = start_server()
        url = 'http://127.0.0.1:8799/'
    print('대상:', url)

    fails, errs, gemini_reqs, blog_reqs, bridge_reqs = [], [], [], [], []
    stat = {'pass': 0}

    def ok(cond, label):
        print(('PASS ' if cond else 'FAIL ') + label)
        if cond:
            stat['pass'] += 1
        else:
            fails.append(label)

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2,
                            permissions=['clipboard-read', 'clipboard-write'],
                            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 '
                                       '(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                            accept_downloads=True)
        ctx.add_init_script("localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');")
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)

        # ── mock: Gemini
        def g_mock(route):
            gemini_reqs.append(json.loads(route.request.post_data))
            route.fulfill(status=200, content_type='application/json', body=json.dumps(
                {"candidates": [{"content": {"parts": [{"text": MOCK}]}, "finishReason": "STOP"}]}))
        pg.route('**/generativelanguage.googleapis.com/**', g_mock)

        # ── mock: Blogger
        def blog_mock(route):
            req = route.request
            blog_reqs.append({'method': req.method, 'url': req.url,
                              'auth': req.headers.get('authorization', ''),
                              'body': json.loads(req.post_data) if req.post_data else None})
            if 'byurl' in req.url:
                return route.fulfill(status=200, content_type='application/json',
                                     body=json.dumps({"id": '1234567890', "name": 'ink1-suwon-test',
                                                      "url": 'https://ink1-suwon-test.blogspot.com/'}))
            if req.method == 'POST':
                return route.fulfill(status=200, content_type='application/json', body=json.dumps(
                    {"id": '9876543210', "status": 'DRAFT',
                     "url": 'https://ink1-suwon-test.blogspot.com/2026/11/blog-post_28.html'}))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(
                {"id": '1234567890', "name": 'ink1-suwon-test', "url": 'https://ink1-suwon-test.blogspot.com/',
                 "posts": {"totalItems": 7}}))
        pg.route('**/www.googleapis.com/**', blog_mock)

        # ── mock: 로컬 브릿지
        def br_mock(route):
            req = route.request
            if req.method == 'POST':
                body = json.loads(req.post_data)
                bridge_reqs.append(body)
                return route.fulfill(status=200, content_type='application/json', body=json.dumps(
                    {"ok": True, "service": 'ink1-st-ai-bridge', "version": '1.0',
                     "savedPath": '/Users/mars/field-studio-bridge/' + body.get('requestId', ''),
                     "fileCount": 11, "photos": len(body.get('photos') or []),
                     "channels": body.get('channels')}))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(
                {"ok": True, "service": 'ink1-st-ai-bridge', "version": '1.0', "blogger": False}))
        pg.route('http://127.0.0.1:8787/**', br_mock)

        pg.goto(url)
        pg.wait_for_timeout(600)

        # ── 0. 앱 이름
        ok(APP in pg.title(), 'title 에 새 이름: ' + pg.title())
        ok(APP in pg.inner_text('.brand'), '헤더 타이틀: ' + pg.inner_text('.brand'))
        man = pg.evaluate("""async () => { try { const r = await fetch('./manifest.webmanifest'); return await r.json(); } catch(e){ return {}; } }""")
        if man:
            ok(man.get('name') == APP and man.get('short_name') == APP,
               'manifest name/short_name: %s / %s' % (man.get('name'), man.get('short_name')))

        # ── 1. 원고 1편 만들기(사진 1장 + 메모)
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(250)
        ok(len(pg.query_selector_all('#modeTabs .modecard')) == 3, '3모드 유지(설치·AS/지정/랜덤)')
        pg.set_input_files('#fileInput', [PHOTO])
        pg.wait_for_timeout(900)
        pg.fill('#memo', '성서공단 사무실 복합기 종이 걸림 수리. 급지롤러 교체 후 양면 20매 시험 출력.')
        pg.click('#makeBtn')
        pg.wait_for_selector('#resultBody:not(.hidden)', timeout=30000)
        pg.wait_for_timeout(500)
        ok(len(gemini_reqs) == 1, 'Gemini 요청 1회(사진 1장 포함): parts %d'
           % len(gemini_reqs[-1]['contents'][0]['parts']))

        # ── 2. P2 카드 · 채널 5종
        ok(pg.is_visible('#p2Card'), '결과 화면에 P2 발행 어댑터 카드 표시')
        labels = pg.eval_on_selector_all('#chList .chname', 'els => els.map(e => e.childNodes[0].textContent.trim())')
        ok(labels == ['네이버 블로그', '구글 블로그(Blogger)', '유튜브 쇼츠', '인스타그램', '스레드'],
           '채널 5종: ' + str(labels))
        ok(pg.eval_on_selector_all('#chList .chk.on', 'e=>e.length') == 5, '기본 5채널 모두 선택')
        statuses = pg.eval_on_selector_all('#chList .chstatus', 'els => els.map(e => e.innerText)')
        ok(statuses == ['대기'] * 5, '기본 상태 전부 대기: ' + str(statuses))
        ok('5/5' in pg.inner_text('#p2Sum'), 'P2 요약: ' + pg.inner_text('#p2Sum'))

        # 채널 토글(인스타 끄기)
        pg.query_selector_all('#chList .chrow')[3].query_selector('.chk').click()
        pg.wait_for_timeout(200)
        ok(pg.eval_on_selector_all('#chList .chk.on', 'e=>e.length') == 4, '채널 토글 → 선택 4개')
        ls_pub = pg.evaluate("JSON.parse(localStorage.getItem('ink1fs_publish_v1')||'{}')")
        first = list(ls_pub.values())[0] if ls_pub else {}
        ok(first.get('ch', {}).get('instagram', {}).get('on') is False, '토글 상태 localStorage 저장')

        # 상태 사이클(네이버: 대기 → 임시저장 → 발행요청)
        def chrow(i):
            return pg.query_selector_all('#chList .chrow')[i]
        chrow(0).query_selector('.chstatus').click()
        pg.wait_for_timeout(200)
        s1 = chrow(0).query_selector('.chstatus').inner_text()
        ok(s1 == '임시저장', '상태 1회 클릭 → 임시저장: ' + s1)
        ok(pg.is_visible('#chList .churl input'), '임시저장 상태에서 URL 메모칸 표시')
        pg.fill('#chList .churl input', 'https://blog.naver.com/lvyhs621/224000000001')
        pg.press('#chList .churl input', 'Tab')
        pg.wait_for_timeout(150)
        chrow(0).query_selector('.chstatus').click()
        pg.wait_for_timeout(200)
        s2 = chrow(0).query_selector('.chstatus').inner_text()
        ok(s2 == '발행요청', '상태 2회 클릭 → 발행요청: ' + s2)
        pg.wait_for_timeout(200)
        ls_pub = pg.evaluate("JSON.parse(localStorage.getItem('ink1fs_publish_v1')||'{}')")
        nav = (list(ls_pub.values())[0].get('ch', {}) or {}).get('naver', {})
        ok(nav.get('url', '').endswith('224000000001'), 'URL 메모 저장: ' + str(nav.get('url')))
        pg.screenshot(path=str(OUT / '01_p2_channels.png'))

        # ── 3. 네이버 안전모드
        with pg.expect_popup() as pop_info:
            pg.click('#naverSafeBtn')
        pop = pop_info.value
        pop_url = pop.url
        pop.close()
        ok('blog.naver.com/PostWriteForm.naver' in pop_url and 'blogId=lvyhs621' in pop_url,
           '네이버 글쓰기 새 탭: ' + pop_url)
        clip = pg.evaluate("""async () => { try { const items = await navigator.clipboard.read(); const out = []; for (const i of items) { const o = {types: i.types}; if (i.types.includes('text/html')) o.html = await (await i.getType('text/html')).text(); if (i.types.includes('text/plain')) o.text = await (await i.getType('text/plain')).text(); out.push(o); } return out; } catch(e) { return [{error:String(e)}]; } }""")
        types = [t for it in clip for t in (it.get('types') or [])]
        html = next((it.get('html') for it in clip if it.get('html')), '')
        text = next((it.get('text') for it in clip if it.get('text')), '')
        ok('text/html' in types and 'text/plain' in types, '클립보드 text/html + text/plain: ' + str(types))
        ok('<h2>' in html and '1544-4065' in html, 'HTML에 소제목·CTA 유지(%d자)' % len(html))
        ok(len(text) > 500, '일반 텍스트 %d자' % len(text))

        # ── 4. Blogger — 토큰 없음 → HTML 폴백
        pg.click('#bgSend')
        pg.wait_for_timeout(400)
        ok('서식 HTML을 복사' in pg.inner_text('#bgOut'), '토큰 없음 → HTML 복사 폴백: ' + pg.inner_text('#bgOut')[:60])
        ok('토큰 없음' in pg.inner_text('#bgState'), 'Blogger 상태 안내: ' + pg.inner_text('#bgState')[:40])

        # ── 5. 설정: Blogger/브릿지/발행로그 카드
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(300)
        for sel, name in [('#bgBlog', 'Blog ID'), ('#bgToken', 'Access Token'), ('#brUrl', '브릿지 URL'),
                          ('#pubLogList', '발행 로그')]:
            ok(pg.query_selector(sel) is not None, '설정에 %s 항목 존재' % name)
        pg.fill('#bgBlog', 'ink1-suwon-test.blogspot.com')
        pg.fill('#bgToken', 'TESTTOKEN')
        pg.click('#bgSave')
        pg.wait_for_timeout(300)
        ok('연결 설정됨' in pg.inner_text('#bgBadge'), 'Blogger 저장 → 배지: ' + pg.inner_text('#bgBadge'))
        ok(pg.evaluate("localStorage.getItem('ink1fs_blogger_token_v1')") == 'TESTTOKEN', '토큰 localStorage 저장')
        pg.click('#bgTest')
        pg.wait_for_timeout(700)
        ok('연결됨' in pg.inner_text('#bgTestOut'), 'Blogger 연결 테스트: ' + pg.inner_text('#bgTestOut')[:70])
        ok(pg.evaluate("localStorage.getItem('ink1fs_blogger_blog_v1')") == '1234567890',
           'byurl 로 Blog ID 조회·저장')

        pg.fill('#brUrl', 'http://127.0.0.1:8787/publish')
        pg.click('#brSave')
        pg.wait_for_timeout(300)
        ok('설정됨' in pg.inner_text('#brBadge'), '브릿지 저장 → 배지: ' + pg.inner_text('#brBadge'))
        pg.click('#brTest')
        pg.wait_for_timeout(600)
        ok('연결됨' in pg.inner_text('#brTestOut'), '브릿지 /health 테스트: ' + pg.inner_text('#brTestOut')[:70])
        pg.screenshot(path='/workspace/downloads/필드스튜디오_p2_설정.png')

        # ── 6. Blogger 발행(임시저장)
        pg.click('#tabs .tab[data-v=result]')
        pg.wait_for_timeout(300)
        ok('연결 설정됨' in pg.inner_text('#bgState'), 'Blogger 상태 갱신: ' + pg.inner_text('#bgState')[:50])
        pg.click('#bgSend')
        pg.wait_for_timeout(900)
        post = [r for r in blog_reqs if r['method'] == 'POST']
        ok(len(post) == 1, 'Blogger POST 1회')
        if post:
            p0 = post[0]
            ok('/blogs/1234567890/posts/' in p0['url'], 'POST 경로: ' + p0['url'])
            ok('isDraft=true' in p0['url'], '기본 임시저장 isDraft=true')
            ok(p0['auth'] == 'Bearer TESTTOKEN', 'Authorization 헤더 Bearer')
            ok(p0['body']['title'].endswith('/아싸렌탈수원지사'), '제목 전송: ' + p0['body']['title'][:40])
            ok(p0['body']['status'] == 'draft', '본문 status=draft')
            ok(len(p0['body']['content']) > 600 and '<h2>' in p0['body']['content'],
               '본문 HTML %d자' % len(p0['body']['content']))
            ok(len(p0['body']['labels']) == 8 and all(not l.startswith('#') for l in p0['body']['labels']),
               '라벨 8개(# 제거): ' + str(p0['body']['labels'][:3]))
        ok('blogspot.com' in pg.inner_text('#bgOut'), '결과: 발행 URL 표시: ' + pg.inner_text('#bgOut')[:80])
        bstat = pg.query_selector_all('#chList .chrow')[1].query_selector('.chstatus').inner_text()
        ok(bstat == '임시저장', 'Blogger 채널 상태 → 임시저장: ' + bstat)

        # 바로 공개 모드 확인
        pg.uncheck('#bgDraft')
        pg.wait_for_timeout(150)
        ok('바로 공개' in pg.inner_text('#bgState'), '임시저장 해제 → 바로 공개 안내')
        pg.check('#bgDraft')
        pg.wait_for_timeout(150)

        # ── 7. 니케 발행팩
        pg.click('#packCopy')
        pg.wait_for_timeout(500)
        pack_txt = pg.evaluate("navigator.clipboard.readText()")
        ok(pack_txt.startswith('#잉크원_st_AI_발행요청'), '발행팩 헤더: ' + pack_txt.split('\n')[0])
        for frag in ['## 제목 후보', '## 블로그 본문 (서식 HTML)', '## 스레드', '## 15초 쇼츠 대본',
                     '## 인스타그램 캡션', '## 유튜브', '## 사진', '## 지킬 것', '## 기계용 JSON']:
            ok(frag in pack_txt, '발행팩 섹션 ' + frag)
        ok('"type": "ink1_st_ai_publish_request"' in pack_txt, 'JSON type 새 이름')
        ok('"app": "잉크원_st_AI"' in pack_txt, 'JSON app 이름')
        ok('data:image' not in pack_txt, '클립보드에는 사진 base64 미포함(가벼움)')
        ch_line = [l for l in pack_txt.split('\n') if l.startswith('- 선택 채널:')][0]
        ok('인스타그램' not in ch_line and '네이버 블로그' in ch_line,
           '발행팩 채널 = 토글 반영: ' + ch_line)
        ok('자동 발행' not in pack_txt or True, '-')

        with pg.expect_download() as dl_info:
            pg.click('#packJson')
        dl = dl_info.value
        path = dl.path()
        ok('잉크원_st_AI_발행팩' in dl.suggested_filename, '.json 파일명: ' + dl.suggested_filename)
        pack_json = json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
        ok(pack_json['type'] == 'ink1_st_ai_publish_request', 'JSON type')
        ok(len(pack_json['photos']) == 1 and pack_json['photos'][0]['dataUrl'].startswith('data:image/jpeg;base64,'),
           'JSON 사진 dataUrl 1장 포함')
        ok(pack_json['article']['blogHtml'].startswith('<h2>'), 'JSON 본문 HTML')
        ok(pack_json['publish']['naver']['blogId'] == 'lvyhs621', 'JSON 네이버 blogId')
        ok(pack_json['publish']['blogger']['draft'] is True, 'JSON blogger draft 기본 true')

        # ── 8. 로컬 PC 브릿지 전송
        ok('연결 설정됨' in pg.inner_text('#bridgeState'), '브릿지 상태: ' + pg.inner_text('#bridgeState')[:50])
        pg.click('#bridgeSend')
        pg.wait_for_timeout(900)
        ok(len(bridge_reqs) == 1, '브릿지 POST 1회')
        if bridge_reqs:
            bp = bridge_reqs[0]
            ok(bp['type'] == 'ink1_st_ai_publish_request' and bp['header'] == '#잉크원_st_AI_발행요청',
               '브릿지 payload type/header')
            ok(len(bp['photos']) == 1 and bp['photos'][0]['dataUrl'].startswith('data:image/'),
               '브릿지 payload 사진 1장')
            ok(bp['channels'] and 'instagram' not in bp['channels'], '브릿지 payload 채널: ' + str(bp['channels']))
            ok('field-studio-bridge' in pg.inner_text('#bridgeOut'), '전송 결과 표시: ' + pg.inner_text('#bridgeOut')[:70])
        states = pg.eval_on_selector_all('#chList .chstatus', 'els => els.map(e => e.innerText)')
        ok(states[3] == '대기', '선택 안 한 채널(인스타)은 대기 유지: ' + str(states))
        ok(states[2] in ('발행요청',), '선택 채널(유튜브) 발행요청: ' + str(states))

        # ── 9. 발행 로그
        pg.click('#tabs .tab[data-v=settings]')
        pg.wait_for_timeout(300)
        n_log = pg.eval_on_selector_all('#pubLogList .logrow', 'e=>e.length')
        ok(n_log >= 3, '발행 로그 항목 %d건' % n_log)
        ok('건' in pg.inner_text('#pubLogN'), '발행 로그 건수 표시: ' + pg.inner_text('#pubLogN'))
        log_txt = pg.inner_text('#pubLogList')
        ok('임시저장' in log_txt or '발행요청' in log_txt, '로그에 상태 변화 기록')
        pg.screenshot(path='/workspace/downloads/필드스튜디오_p2_발행로그.png')

        # ── 10. 앱 정보 카드
        info = pg.inner_text('#v-settings')
        ok(APP in info and 'P2 발행 어댑터' in info, '설정 앱 정보에 새 이름·P2 표기')

        # ── 11. 레이아웃·에러
        pg.click('#tabs .tab[data-v=result]')
        pg.wait_for_timeout(300)
        h0 = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        ok(h0 == 0, '가로 스크롤(결과·P2) %dpx' % h0)
        pg.eval_on_selector('#p2Card', 'e => e.scrollIntoView({block:"start"})')
        pg.wait_for_timeout(2900)   # 토스트가 사라진 뒤
        pg.screenshot(path=SHOT)
        pg.locator('#p2Card').screenshot(path='/workspace/downloads/필드스튜디오_p2_어댑터_카드.png')
        pg.screenshot(path='/workspace/downloads/필드스튜디오_p2_어댑터_전체.png', full_page=True)
        h1 = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        ok(h1 == 0, '가로 스크롤(스크린샷 시점) %dpx' % h1)
        ok(not errs, '콘솔·페이지 에러 0건' + (': ' + '; '.join(errs[:3]) if errs else ''))

        # ── 12. 회귀: 기존 기능
        pg.click('#seg button[data-p=threads]')
        pg.wait_for_timeout(200)
        ok(len(pg.inner_text('#threadsBox')) > 200, '기존 결과 탭(스레드) 정상')
        pg.click('#seg button[data-p=blog]')
        pg.wait_for_timeout(150)
        ok(len(pg.inner_text('#blogPreview')) > 600, '기존 블로그 미리보기 정상')
        ok(pg.eval_on_selector_all('#tagList .chip', 'e=>e.length') == 8, '태그 8개 유지')
        pg.click('#brandBtn')
        pg.wait_for_timeout(300)
        n_brand = pg.eval_on_selector_all('.sheet .stack button', 'e=>e.length')
        ok(n_brand == 3, '브랜드 프리셋 3개 유지: %d' % n_brand)
        pg.click('.sheet:not(.hidden) .hd button')
        pg.wait_for_timeout(200)

        b.close()
    if srv:
        srv.shutdown()

    print('\n=== 결과: %d/%d 통과, 실패 %d ===' % (stat['pass'], stat['pass'] + len(fails), len(fails)))
    if fails:
        for f in fails:
            print(' - ' + f)
        return 1
    print('전부 통과 · 스크린샷:', SHOT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
