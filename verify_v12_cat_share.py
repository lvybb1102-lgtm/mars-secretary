#!/usr/bin/env python3
"""잉크원_st_AI v1.2 검증 — 4대 카테고리 · 사진 선택 3종 · share_target

사용: python3 verify_v12_cat_share.py            # 로컬(127.0.0.1) 서빙해 검증
      python3 verify_v12_cat_share.py <배포URL>   # 배포 URL 그대로 검증

Gemini 응답은 mock. 430x932 모바일 뷰포트.
"""
import json, pathlib, sys, threading, http.server, functools, time

from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
ROOT = pathlib.Path('/workspace/work/mars_secretary_pages')
SHOT = '/workspace/downloads/잉크원_st_AI_카테고리_사진선택.png'
SHOT2 = '/workspace/downloads/잉크원_st_AI_공유받기.png'
PHOTO = '/workspace/work/ink1fs/testimg/shot_a.jpg'
APP = '잉크원_st_AI'

BLOG = ('<h2>설치 현장에서 먼저 보는 것</h2>'
        '<p>복합기를 새로 들이는 사무실은 대부분 전원과 네트워크 위치를 미리 정해 두지 않습니다. 그래서 설치 당일 책상 배치를 다시 손보는 일이 생깁니다. '
        '현장에 도착하면 먼저 기계가 들어갈 자리와 콘센트, 랜 포트부터 확인합니다.</p>'
        '<h2>설치 장비와 구성</h2>'
        '<ul><li>복합기 본체와 급지 카세트</li><li>토너와 폐토너통</li><li>전원 케이블과 랜 케이블</li>'
        '<li>드라이버 설치용 PC 한 대</li></ul>'
        '<p>구성품은 현장에서 한 번 더 세어 봅니다. 카세트가 빠진 채로 두면 나중에 급지 문제로 이어집니다.</p>'
        '<h2>초기 세팅</h2>'
        '<p>PC에 드라이버를 설치하고 IP를 고정합니다. 스캔 폴더와 팩스 수신 번호를 넣은 뒤, 양면과 컬러를 각각 한 장씩 시험 출력합니다. '
        '스캔은 PDF로 한 부 떠서 저장 위치까지 확인합니다.</p>'
        '<h2>테스트 출력 결과</h2>'
        '<p>양면 20매를 돌려 걸림이 없는지, 스캔에 세로줄이 없는지 봅니다. 여기까지 확인해야 설치가 끝난 것입니다.</p>'
        '<h2>자주 묻는 질문</h2>'
        '<p><b>Q. 설치에 얼마나 걸리나요?</b> 기존 장비 철수까지 포함하면 한 시간 안팎입니다.</p>'
        '<p><b>Q. 랜선이 없으면 어떻게 하나요?</b> 무선 연결로 잡아 드리고 비밀번호를 알려 드립니다.</p>'
        '<h2>상담 안내</h2>'
        '<p>잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · 톡톡 문의 · https://ink1.kr/</p>'
        '<p>경기 수원시 권선구 경수대로235번길 62-26 1층</p>'
        '<p>#수원복합기 #복합기설치 #프린터설치 #복합기임대 #수원사무기기 #설치후기 #아싸렌탈 #잉크원</p>')

MOCK = """[TOPIC] 수원 사무실 복합기 설치, 이것만은 확인하세요
[TITLE1] 수원 사무실 복합기 설치, 전원·랜·시험 출력까지 /아싸렌탈수원지사
[TITLE2] 복합기 설치할 때 무엇을 확인하나요? 수원 출장 기사가 알려드립니다 /아싸렌탈수원지사
[TITLE3] 성서공단 사무실 복합기 설치 현장, 이렇게 마쳤습니다 /아싸렌탈수원지사
[BLOG] """ + BLOG + """
[TAGS] #수원복합기 #복합기설치 #프린터설치 #복합기임대 #수원사무기기 #설치후기 #아싸렌탈 #잉크원
[THREADS] 복합기 설치는 기계를 놓는 일이 아니라 자리를 먼저 정하는 일입니다. 전원과 랜 포트 위치를 확인하고, 카세트와 토너를 세어 본 뒤 드라이버와 고정 IP를 잡습니다. 양면 20매와 스캔 한 장을 시험해서 걸림과 세로줄이 없어야 설치가 끝납니다. 자세한 순서는 블로그에 정리해 두었습니다. https://blog.naver.com/lvyhs621
[SHORTS] 0-3초|복합기 설치는 자리부터|설치 전에 전원·랜부터 봅니다
[SHORTS] 3-9초|카세트·토너 확인, 드라이버·IP 설정|구성품 세고 고정 IP 잡기
[SHORTS] 9-15초|양면 20매 시험 출력|잉크원·아싸렌탈, 1544-4065
[INSTA] 수원 사무실 복합기 설치, 자리부터 정합니다.
전원과 랜, 카세트와 토너를 확인하고 드라이버와 고정 IP를 잡습니다.
━━━━━━━━━━━━━━━━━━━━
🏢 잉크원 · 아싸렌탈 수원지사
📍 경기남부
📞 1544-4065
📝 blog.naver.com/lvyhs621
🌐 https://ink1.kr/
#수원복합기 #복합기설치 #프린터설치 #복합기임대 #수원사무기기 #설치후기
[YT_TITLE] 수원 사무실 복합기 설치 현장, 전원부터 시험 출력까지
[YT_DESC] 복합기 설치할 때 전원과 랜 포트를 먼저 봅니다.
자리 확인, 구성품 확인, 드라이버와 IP 설정 순서로 진행합니다."""

stat = {'pass': 0}
fails = []


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


def main():
    srv = None
    url = sys.argv[1] if len(sys.argv) > 1 else None
    if not url:
        srv, url = serve()
        time.sleep(0.4)
    print('대상:', url)

    gemini_reqs = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2,
                            has_touch=True, is_mobile=True,
                            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 '
                                       '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')
        ctx.add_init_script("localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');")
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)

        def g_mock(route):
            try:
                gemini_reqs.append(json.loads(route.request.post_data))
            except Exception:
                gemini_reqs.append({})
            route.fulfill(status=200, content_type='application/json',
                          headers={'Access-Control-Allow-Origin': '*'},
                          body=json.dumps({"candidates": [{"content": {"parts": [{"text": MOCK}]},
                                                          "finishReason": "STOP"}],
                                           "usageMetadata": {"totalTokenCount": 1200}}))

        pg.route('**/generativelanguage.googleapis.com/**', g_mock)

        pg.goto(url, wait_until='load')
        pg.wait_for_timeout(1200)
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(300)

        # ── 1. 4대 카테고리 UI
        cats = pg.eval_on_selector_all('#cats .cat', 'els => els.map(e => e.dataset.c)')
        ok(cats == ['설치', '교체', 'AS', '수리'], '4대 카테고리 순서·개수: %s' % cats)
        boxes = pg.eval_on_selector_all('#cats .cat', 'els => els.map(e => {const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)];})')
        ok(all(w >= 150 and h >= 70 for w, h in boxes), '카테고리 카드가 큼직(폭150·높이70 이상): %s' % boxes)
        ok(pg.eval_on_selector('#typeCard', 'e => !!e && e.offsetTop < document.querySelector("#photoCard").offsetTop'),
           '카테고리 카드가 쓰기 탭 상단(사진 카드 위)에 배치')
        extra = pg.eval_on_selector_all('#types .chip', 'els => els.map(e => e.textContent)')
        ok(extra == ['정기점검', '상담', '견적', '철수'], '보조 칩 유지: %s' % extra)
        ok(pg.inner_text('#catNote').find('접수 증상') >= 0, '기본 선택(AS) 안내 문구: ' + pg.inner_text('#catNote'))

        # ── 2. 사진 선택 3종 + 꿀팁
        ok(pg.is_visible('#pickGallery') and pg.is_visible('#pickFiles') and pg.is_visible('#pickCamera'),
           '사진 선택 버튼 3종 표시')
        labels = pg.eval_on_selector_all('.pick3 .pickbtn b', 'els => els.map(e => e.textContent)')
        ok(labels == ['사진·앨범', '폴더·드라이브', '바로 촬영'], '버튼 이름: %s' % labels)
        a1 = pg.get_attribute('#fileInput', 'accept')
        a2 = pg.get_attribute('#fileInputAll', 'accept')
        a3 = pg.get_attribute('#cameraInput', 'accept')
        c3 = pg.get_attribute('#cameraInput', 'capture')
        m1 = pg.eval_on_selector('#fileInput', 'e => e.multiple')
        ok(a1 == 'image/*' and m1, '사진·앨범 input: accept=image/* multiple')
        ok('.jpg' in a2 and '.heic' in a2, '폴더·드라이브 input 확장자 지정: ' + a2)
        ok(a3 == 'image/*' and c3 == 'environment', '바로 촬영 input: accept=image/* capture=environment')
        tip = pg.inner_text('#shareTip')
        ok('≡ → 갤러리' in tip and '공유 → 잉크원_st_AI' in tip, '꿀팁 한 줄 안내 문구')
        # 3버튼이 실제로 해당 input을 연다
        for btn, inp in [('#pickGallery', '#fileInput'), ('#pickFiles', '#fileInputAll'), ('#pickCamera', '#cameraInput')]:
            with pg.expect_file_chooser() as fc:
                pg.click(btn)
            ok(fc.value.element.get_attribute('id') == inp[1:], '%s → %s 연결' % (btn, inp))

        # ── 3. 카테고리별 프롬프트 전개 구조
        FLOW = {'설치': '현장 환경', '교체': '교체 전후 비교', 'AS': '재발 방지 팁', '수리': '정상 작동 확인'}
        pg.fill('#memo', '성서공단 사무실, 복합기 신규 설치. 양면 20매 시험 출력까지.')
        for c in ['설치', '교체', 'AS', '수리']:
            pg.click('#cats .cat[data-c="%s"]' % c)
            pg.wait_for_timeout(150)
            on = pg.eval_on_selector('#cats .cat[data-c="%s"]' % c, 'e => e.classList.contains("on")')
            note = pg.inner_text('#catNote')
            ok(on and FLOW[c] in note, '%s 선택 → 카드 활성·안내 «%s»' % (c, FLOW[c]))
            before = len(gemini_reqs)
            pg.click('#makeBtn')
            pg.wait_for_selector('#resultBody:not(.hidden)', timeout=30000)
            pg.wait_for_timeout(250)
            req = gemini_reqs[-1] if len(gemini_reqs) > before else {}
            sys_txt = ''
            try:
                sys_txt = req['systemInstruction']['parts'][0]['text']
            except Exception:
                pass
            usr_txt = ''
            try:
                usr_txt = req['contents'][0]['parts'][0]['text']
            except Exception:
                pass
            ok(('[작업 종류 — %s' % c) in sys_txt and FLOW[c] in sys_txt,
               '%s 프롬프트: 시스템 지침에 전개 구조 반영' % c)
            ok(('작업 종류: %s' % c) in usr_txt and FLOW[c] in usr_txt,
               '%s 프롬프트: 사용자 지시에 작업 종류·전개' % c)
            ok(pg.inner_text('#titleList').strip() != '', '%s 생성 결과 정상' % c)
            pg.click('#tabs .tab[data-v=write]')
            pg.wait_for_timeout(200)

        # 다른 카테고리 문구가 섞여 있지 않은지(교체 글에 설치 구조가 남지 않음)
        try:
            sys_last = req['systemInstruction']['parts'][0]['text']
            ok('수리: ①결론' in sys_last or '수리 현장' in sys_last or '고장 원인 정밀 점검' in sys_last,
               '마지막 요청은 수리 구조만 담는다')
        except Exception:
            pass

        # ── 4. 보조 칩(정기점검) 선택 시 기본 순서
        pg.click('#types .chip:nth-child(1)')
        pg.wait_for_timeout(150)
        ok('기본 순서' in pg.inner_text('#catNote'), '보조 칩(정기점검) → 기본 순서 안내')

        # ── 5. manifest share_target / sw.js
        man = pg.evaluate("""async () => { const r = await fetch('./manifest.webmanifest', {cache:'no-store'}); return await r.json(); }""")
        st = man.get('share_target') or {}
        ok(st.get('method') == 'POST' and st.get('enctype') == 'multipart/form-data',
           'manifest share_target: POST multipart/form-data')
        ok(st.get('action') == './?share-target=1', 'share_target action: ' + str(st.get('action')))
        files = ((st.get('params') or {}).get('files') or [])
        ok(bool(files) and files[0].get('name') == 'files' and 'image/jpeg' in files[0].get('accept', []),
           'share_target files 필드·accept: %s' % (files[:1],))

        sww = pg.evaluate("""async () => { const r = await fetch('./sw.js', {cache:'no-store'}); return await r.text(); }""")
        ok("ink1-field-studio-v5" in sww and "receiveShare" in sww and "__share__" in sww,
           'sw.js: 캐시 v5 · 공유 수신 핸들러')
        try:
            keys = pg.evaluate("async () => 'serviceWorker' in navigator ? await caches.keys() : []")
        except Exception:
            keys = []
        ok('ink1-field-studio-v5' in keys, '서비스워커 v5 캐시 활성: %s' % keys)

        # ── 6. 공유받기 실제 동작 (POST multipart → sw.js → 앱 사진 목록)
        res = pg.evaluate("""async () => {
            const blob = await (await fetch('./apple-touch-icon.png')).blob();
            const f = new File([blob], '갤러리공유.png', {type: 'image/png'});
            const fd = new FormData();
            fd.append('files', f);
            fd.append('text', '성서공단 사무실, 복합기 급지롤러 교체');
            fd.append('title', '잉크원_st_AI');
            const r = await fetch('./?share-target=1', {method:'POST', body: fd});
            const meta = await fetch('./__share__/meta', {cache:'no-store'});
            return {status: r.status, url: r.url, meta: meta.ok ? await meta.json() : null};
        }""")
        ok(res.get('status') == 200 and 'shared=1' in (res.get('url') or ''), '공유 POST → 303 후 ?shared=1 로 이동: %s' % (res.get('url'),))
        ok(bool(res.get('meta')) and res['meta'].get('count') == 1, 'SW가 공유 사진 1장 보관: %s' % (res.get('meta'),))
        pg.goto(url + '?shared=1&n=1', wait_until='load')
        pg.wait_for_timeout(2500)
        ok(pg.inner_text('#photoMeta').startswith('1/'), '공유받은 사진이 사진 목록에 자동 추가: ' + pg.inner_text('#photoMeta'))
        ok(pg.eval_on_selector_all('#thumbs .thumb', 'e => e.length') == 1, '썸네일 1장 표시')
        ok('급지롤러' in pg.input_value('#memo'), '공유받은 글을 메모에 반영')
        pg.screenshot(path=SHOT2)
        meta2 = pg.evaluate("""async () => { const r = await fetch('./__share__/meta', {cache:'no-store'}); return await r.json(); }""")
        ok(meta2.get('count') == 0, '공유함 비움(다음 공유와 섞이지 않음): %s' % (meta2,))

        # ── 7. 사진 선택 3종으로 직접 추가 (갤러리 input)
        pg.set_input_files('#fileInputAll', [PHOTO])
        pg.wait_for_timeout(1200)
        ok(pg.eval_on_selector_all('#thumbs .thumb', 'e => e.length') >= 2, '폴더·드라이브 input으로 사진 추가')

        # ── 8. 회귀: 3모드
        modes = pg.eval_on_selector_all('#modeTabs .modecard', 'els => els.map(e => e.dataset.m)')
        ok(modes == ['field', 'topic', 'random'], '쓰기 3모드 유지: %s' % modes)
        pg.click('#modeTabs .modecard[data-m=topic]')
        pg.wait_for_timeout(200)
        ok(pg.is_visible('#topicCard') and not pg.is_visible('#typeCard'), '정보성·지정 모드: 주제 카드 표시·카테고리 숨김')
        ok(pg.inner_text('#photoTitle').startswith('2.'), '정보성 모드 사진 번호 유지: ' + pg.inner_text('#photoTitle'))
        pg.fill('#topicInput', '복합기 종이 걸림, 현장에서 바로 빼는 순서')
        pg.click('#makeBtn')
        pg.wait_for_selector('#resultBody:not(.hidden)', timeout=30000)
        pg.wait_for_timeout(300)
        ok(pg.is_visible('#resTopicCard') and pg.inner_text('#resTopic').strip() != '', '정보성·지정 결과: 이번 주제 카드')
        pg.click('#modeTabs .modecard[data-m=random]') if pg.is_visible('#modeTabs .modecard[data-m=random]') else None
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(200)
        pg.click('#modeTabs .modecard[data-m=random]')
        pg.wait_for_timeout(200)
        ok(pg.is_visible('#randomCard'), '정보성·랜덤 모드: 주제 뽑기 카드')
        pg.click('#rollBtn')
        pg.wait_for_timeout(200)
        ok('🎲' in pg.inner_text('#pickedBox'), '랜덤 주제 뽑기 동작')

        # ── 9. 회귀: P2 발행 어댑터
        pg.click('#tabs .tab[data-v=result]')
        pg.wait_for_timeout(300)
        rows = pg.eval_on_selector_all('#chList .chrow', 'e => e.length')
        ok(rows == 5, 'P2 채널 5개 유지: %d' % rows)
        before = pg.inner_text('#chList .chstatus')
        pg.click('#chList .chstatus')
        pg.wait_for_timeout(200)
        ok(pg.inner_text('#chList .chstatus') != before, 'P2 상태 배지 순환: %s → %s' % (before, pg.inner_text('#chList .chstatus')))
        ok(pg.is_visible('#naverSafeBtn') and pg.is_visible('#bgSend') and pg.is_visible('#packCopy') and pg.is_visible('#bridgeSend'),
           'P2 4경로 버튼 유지')
        pg.click('#seg button[data-p=threads]')
        pg.wait_for_timeout(200)
        ok(len(pg.inner_text('#threadsBox')) > 150, '결과 탭(스레드) 정상')
        pg.click('#seg button[data-p=blog]')
        pg.wait_for_timeout(150)
        ok(len(pg.inner_text('#blogPreview')) > 600, '블로그 미리보기 정상')
        ok(pg.eval_on_selector_all('#tagList .chip', 'e => e.length') == 8, '해시태그 8개(상한 유지)')
        pg.click('#brandBtn')
        pg.wait_for_timeout(300)
        ok(pg.eval_on_selector_all('.sheet:not(.hidden) .stack button', 'e => e.length') == 3, '브랜드 프리셋 3개 유지')
        pg.click('.sheet:not(.hidden) .hd button')
        pg.wait_for_timeout(200)

        # ── 10. 가로 스크롤 0 · 콘솔 오류 0
        for v in ['write', 'result', 'settings', 'home']:
            pg.click('#tabs .tab[data-v=%s]' % v)
            pg.wait_for_timeout(200)
            hs = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            ok(hs == 0, '%s 탭 가로 스크롤 %dpx' % (v, hs))

        # ── 11. 스크린샷 (카테고리 + 사진 선택 3종) — 두 화면을 세로로 이어 붙인다
        pg.click('#tabs .tab[data-v=write]')
        pg.wait_for_timeout(200)
        pg.click('#modeTabs .modecard[data-m=field]')
        pg.wait_for_timeout(150)
        pg.click('#cats .cat[data-c="교체"]')
        pg.wait_for_timeout(2800)          # 토스트가 사라진 뒤
        pg.eval_on_selector('#view', 'e => e.scrollTop = 0')
        pg.wait_for_timeout(400)
        pg.screenshot(path=SHOT + '.a.png')
        y_photo = pg.evaluate('document.querySelector("#photoCard").getBoundingClientRect().top')
        pg.eval_on_selector('#photoCard', 'e => e.scrollIntoView({block:"center"})')
        pg.wait_for_timeout(500)
        rect = pg.evaluate('(() => { const r = document.querySelector("#photoCard").getBoundingClientRect(); return [r.top, r.height]; })()')
        pg.screenshot(path=SHOT + '.b.png')
        from PIL import Image
        a = Image.open(SHOT + '.a.png')
        bfull = Image.open(SHOT + '.b.png')
        cut = max(200, int(y_photo * 2) - 12)
        a = a.crop((0, 0, a.width, min(a.height, cut)))
        bb = bfull.crop((0, max(0, int(rect[0] * 2) - 6), bfull.width, min(bfull.height, int((rect[0] + rect[1]) * 2) + 6)))
        gap = 14
        out = Image.new('RGB', (max(a.width, bb.width), a.height + gap + bb.height), (238, 243, 240))
        out.paste(a, (0, 0))
        out.paste(bb, (0, a.height + gap))
        out.save(SHOT)
        import os
        os.remove(SHOT + '.a.png')
        os.remove(SHOT + '.b.png')
        pg.eval_on_selector('#view', 'e => e.scrollTop = 0')
        pg.wait_for_timeout(200)
        pg.screenshot(path='/workspace/downloads/잉크원_st_AI_카테고리_사진선택_전체.png', full_page=True)
        pg.locator('#typeCard').screenshot(path='/workspace/downloads/잉크원_st_AI_카테고리_카드.png')
        pg.locator('#photoCard').screenshot(path='/workspace/downloads/잉크원_st_AI_사진선택_카드.png')

        ok(not errs, '콘솔·페이지 오류 0건' + (': ' + '; '.join(errs[:4]) if errs else ''))
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
