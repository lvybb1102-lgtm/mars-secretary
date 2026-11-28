#!/usr/bin/env python3
"""v1.4 증빙 컷 — 홈 목록(사진 N장) · 복원된 사진 카드 · 바로발행 전송 후"""
import json, sys
from playwright.sync_api import sync_playwright

CHROME = '/workspace/.pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://lvybb1102-lgtm.github.io/mars-secretary/field-studio/'
IMG = ['/workspace/work/ink1fs/testimg/shot_a.jpg', '/workspace/work/ink1fs/testimg/shot_b.jpg',
       '/workspace/work/ink1fs/testimg/shot_c.jpg']
MOCK = """[TOPIC] 복합기 급지
[TITLE1] 복합기 양면 인쇄만 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사
[TITLE2] 복합기 용지 걸림이 반복될 때 무엇을 보나요? /아싸렌탈수원지사
[TITLE3] 성서공단 사무실 복합기 AS 현장 /아싸렌탈수원지사
[BLOG] <h2>접수한 증상</h2><p>사무실 복합기에서 양면 인쇄만 걸린다는 연락을 받고 방문했습니다.</p><h2>원인 진단</h2><p>급지롤러 마모가 원인이었습니다.</p><h2>현장 조치</h2><ul><li>급지롤러·픽업롤러 교체</li><li>카세트 먼지 제거</li></ul><h2>상담 안내</h2><p>잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065</p>
[TAGS] #수원복합기 #복합기수리 #급지롤러 #아싸렌탈
[THREADS] 복합기에서 양면만 걸린다면 급지롤러를 먼저 봅니다.
[SHORTS] 0-3초|양면만 걸린다면 급지롤러|단면은 되는데 양면만 멈춘다면
[INSTA] 수원 사무실 복합기 양면 걸림, 급지롤러 교체로 해결했습니다.
[YT_TITLE] 복합기 양면 걸림, 급지롤러 교체로 끝났습니다
[YT_DESC] 급지롤러 마모가 원인이었습니다."""
ACAO = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}


def gh(route):
    req = route.request
    path = req.url.split('api.github.com', 1)[1]
    if req.method == 'OPTIONS':
        route.fulfill(status=204, headers=ACAO, body='')
        return
    if req.method == 'GET' and '/contents/' not in path:
        route.fulfill(status=200, headers=ACAO, body=json.dumps(
            {"full_name": "lvybb1102-lgtm/ink1-publish-queue", "private": True,
             "permissions": {"push": True}}))
        return
    if req.method == 'GET':
        route.fulfill(status=404, headers=ACAO, body='{"message":"Not Found"}')
        return
    route.fulfill(status=201, headers=ACAO, body=json.dumps(
        {"content": {"html_url": "https://github.com/lvybb1102-lgtm/ink1-publish-queue/blob/main/queue/"}}))


with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 430, 'height': 932}, device_scale_factor=2,
                        is_mobile=True, has_touch=True,
                        user_agent='Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 '
                                   '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')
    ctx.add_init_script(
        "localStorage.setItem('ink1fs_gemini_key_v1','TEST_KEY');"
        "localStorage.setItem('ink1fs_gh_repo_v1','lvybb1102-lgtm/ink1-publish-queue');"
        "localStorage.setItem('ink1fs_gh_token_v1','github_pat_TESTTOKEN123');")
    pg = ctx.new_page()
    pg.on('dialog', lambda d: d.accept())
    pg.route('**/generativelanguage.googleapis.com/**', lambda r: r.fulfill(
        status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
        body=json.dumps({"candidates": [{"content": {"parts": [{"text": MOCK}]}}]})))
    pg.route('**://api.github.com/**', gh)

    pg.goto(URL, wait_until='load')
    pg.wait_for_timeout(1300)
    pg.click('#tabs .tab[data-v=write]')
    pg.wait_for_timeout(250)
    pg.click('#cats .cat[data-c="AS"]')
    pg.set_input_files('#fileInput', IMG)
    pg.wait_for_timeout(2400)
    pg.fill('#memo', '성서공단 사무실, 양면만 걸림. 급지롤러 교체하고 양면 20매 시험 출력.')
    pg.click('#makeBtn')
    pg.wait_for_function("() => !document.querySelector('#resultBody').classList.contains('hidden')", timeout=20000)
    pg.wait_for_timeout(3000)   # 토스트 사라질 때까지

    pg.reload(wait_until='load')
    pg.wait_for_timeout(1500)
    pg.screenshot(path='/workspace/downloads/잉크원_st_AI_사진보관_홈.png')
    pg.click('#histList .hitem')
    pg.wait_for_function("() => document.querySelectorAll('#resThumbs img').length === 3", timeout=15000)
    pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelector('#resPhotoCard').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(600)
    pg.screenshot(path='/workspace/downloads/잉크원_st_AI_사진보관_복원.png')
    pg.evaluate("document.querySelector('#ghSend').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(400)
    pg.click('#ghSend')
    pg.wait_for_function("() => (document.querySelector('#ghProg').textContent||'').indexOf('완료!') === 0", timeout=20000)
    pg.wait_for_timeout(2600)
    pg.evaluate("document.querySelector('#ghSend').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(500)
    pg.screenshot(path='/workspace/downloads/잉크원_st_AI_사진보관_전송.png')
    print('ok')
    b.close()
