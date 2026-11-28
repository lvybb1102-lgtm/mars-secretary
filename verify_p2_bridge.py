#!/usr/bin/env python3
"""로컬 PC 브릿지 샘플 실동작 검증 — 실제 HTTP 서버를 띄워 /health · /publish 를 호출한다."""
import base64, json, pathlib, subprocess, sys, time, urllib.request, urllib.error, shutil

BRIDGE = '/workspace/downloads/field_studio_bridge_sample.py'
OUT = pathlib.Path('/workspace/work/ink1fs/p2/bridge_out')
PORT = 8787
BASE = 'http://127.0.0.1:%d' % PORT
fails = []


def ok(cond, label):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond:
        fails.append(label)


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return r.status, json.loads(r.read().decode())


def post(path, obj):
    req = urllib.request.Request(BASE + path, data=json.dumps(obj).encode(),
                                 headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    # 2x2 픽셀짜리 진짜 JPEG 대신, 앱이 보내는 것과 같은 data URL 형식의 작은 JPEG 사용
    jpg = pathlib.Path('/workspace/work/ink1fs/testimg/shot_a.jpg').read_bytes()[:40000]
    data_url = 'data:image/jpeg;base64,' + base64.b64encode(jpg).decode()

    log = open('/workspace/work/ink1fs/p2/bridge_server.log', 'w', encoding='utf-8')
    proc = subprocess.Popen([sys.executable, BRIDGE, '--port', str(PORT), '--out', str(OUT)],
                            stdout=log, stderr=subprocess.STDOUT, text=True)
    try:
        for _ in range(40):
            try:
                st, health = get('/health')
                break
            except Exception:
                time.sleep(0.25)
        else:
            print('브릿지가 뜨지 않음'); return 1
        ok(st == 200, 'GET /health 200')
        ok(health.get('service') == 'ink1-st-ai-bridge' and health.get('version') == '1.0',
           'health 응답: %s' % json.dumps({k: health.get(k) for k in ('service', 'version', 'blogger')}, ensure_ascii=False))

        st, bad = post('/publish', {'type': 'wrong'})
        ok(st == 400 and not bad.get('ok'), 'type 불일치 → 400')

        pack = {
            'header': '#잉크원_st_AI_발행요청', 'app': '잉크원_st_AI',
            'type': 'ink1_st_ai_publish_request', 'version': 'P2.0', 'requestId': 'rTEST123',
            'requestedAt': '2026-11-28T09:30:00.000Z',
            'brand': {'id': 'ink1', 'name': '잉크원', 'blog': 'lvyhs621', 'label': '잉크원 · lvyhs621'},
            'mode': 'field', 'modeLabel': '설치·AS 후기', 'topic': '', 'workType': 'AS/수리',
            'title': '수원 복합기 종이 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사',
            'article': {
                'title': '수원 복합기 종이 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사',
                'blogHtml': '<h2>결론</h2><p>급지롤러 마모였습니다. 1544-4065</p>',
                'blogText': '결론 급지롤러 마모였습니다.',
                'tags': ['#수원복합기', '#복합기수리', '#급지롤러'],
                'threads': '스레드 본문입니다.',
                'shorts': [{'time': '0-3초', 'screen': '종이 걸림', 'voice': '급지롤러부터 봅니다'},
                           {'time': '9-15초', 'screen': '문의', 'voice': '잉크원·아싸렌탈, 1544-4065'}],
                'insta': '수원 사무실 복합기 종이 걸림은 급지롤러부터 봅니다.',
                'ytTitle': '수원 복합기 종이 걸림 해결', 'ytDesc': '급지롤러 교체 과정'
            },
            'photos': [{'name': '01_현장.jpg', 'takenAt': '11-28 09:20', 'dataUrl': data_url}],
            'channels': ['naver', 'blogger', 'youtube', 'threads'],
            'channelStates': {},
            'publish': {'blogger': {'draft': True, 'blogId': ''}},
            'guardrails': ['가격 금지']
        }
        st, res = post('/publish', pack)
        ok(st == 200 and res.get('ok'), 'POST /publish 200')
        root = pathlib.Path(res.get('savedPath', ''))
        ok(root.exists(), '저장 폴더 생성: %s' % root)
        names = sorted(p.name for p in root.glob('*'))
        ok(all(n in names for n in ['제목.txt', '본문.html', '본문_텍스트.txt', '해시태그.txt', '스레드.txt',
                                    '쇼츠대본.txt', '인스타캡션.txt', '유튜브.txt', '발행팩.json', '사진']),
           '원고 파일 9종 + 사진 폴더: %s' % names)
        ok((root / '제목.txt').read_text(encoding='utf-8').endswith('/아싸렌탈수원지사'), '제목.txt 내용')
        ok('1544-4065' in (root / '본문.html').read_text(encoding='utf-8'), '본문.html CTA')
        ph = list((root / '사진').glob('*'))
        ok(len(ph) == 1 and ph[0].stat().st_size == len(jpg), '사진 1장 원본 바이트 그대로 저장(%d B)' % (ph[0].stat().st_size if ph else 0))
        meta = json.loads((root / '발행팩.json').read_text(encoding='utf-8'))
        ok('dataUrl' not in json.dumps(meta), '발행팩.json 에는 base64 미포함')
        ok(res.get('photos') == 1 and res.get('fileCount') >= 10, '응답 photos=%s fileCount=%s' % (res.get('photos'), res.get('fileCount')))
        ok('blogger' not in res, '토큰 없으면 Blogger 호출 생략')
        log.flush()
        print('--- 브릿지 로그(끝 6줄) ---')
        print('\n'.join(pathlib.Path('/workspace/work/ink1fs/p2/bridge_server.log').read_text(encoding='utf-8').strip().splitlines()[-6:]))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

    # CORS·프리플라이트 헤더 확인
    proc = subprocess.Popen([sys.executable, BRIDGE, '--port', str(PORT), '--out', str(OUT)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, text=True)
    try:
        time.sleep(1.2)
        req = urllib.request.Request(BASE + '/publish', method='OPTIONS')
        with urllib.request.urlopen(req, timeout=5) as r:
            hdrs = {k.lower(): v for k, v in r.headers.items()}
        ok(hdrs.get('access-control-allow-origin') == '*', 'OPTIONS CORS Allow-Origin *')
        ok('POST' in (hdrs.get('access-control-allow-methods') or ''), 'OPTIONS Allow-Methods 에 POST')
        ok(hdrs.get('access-control-allow-private-network') == 'true', 'Private Network Access 헤더')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

    print('\n=== 브릿지: %d 실패 ===' % len(fails))
    for f in fails:
        print(' - ' + f)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
