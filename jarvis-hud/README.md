# 마르스 자비스 HUD (Jarvis HUD)

마르스 님(수우전산 · 잉크원 대표)을 위한 **원형 자비스 HUD 웹앱**입니다.
브라우저만 있으면 PC·스마트폰에서 바로 열리고, 한국어 음성으로 대화합니다.

- 주소: **https://lvybb1102-lgtm.github.io/mars-secretary/jarvis-hud/**
- 단독 파일: `downloads/마르스_자비스_HUD.html` (파일 하나로 열림 · PC `file://` 가능)
- 대표 화면: `downloads/마르스_자비스_HUD.png`

## 무엇이 들어 있나

| 항목 | 내용 |
|---|---|
| 원형 HUD | HTML5 Canvas 다중 링 · 궤도 입자 · 스캔 스윕 · 코어 글로우 |
| 4가지 상태 | `IDLE`(잔잔한 호흡) · `LISTENING`(마이크 파형·골드 링) · `THINKING`(빠른 회전·스윕) · `SPEAKING`(음성 리듬 파형) |
| 음성 대화 | Web Speech API `ko-KR` 마이크 버튼 → 말하면 바로 전송 · 하단 텍스트 입력도 지원 |
| 음성 출력 | `speechSynthesis` 한국어 TTS · 문장 단위 분할 읽기 · 속도·목소리 선택 · 음소거 토글 |
| AI | Google AI Studio `gemini-3.6-flash` 기본, 실패 시 `3.8 → 3.5 → flash-latest → 3.1-flash-lite` 자동 대체 |
| 페르소나 | '니케' — 수우전산·잉크원 맥락, 결론→근거→다음 액션 3문장 보고 |
| BUILD PLAN | 응답에 포함된 계획 JSON을 카드로 파싱해 패널에 단계별 표시(누르면 완료 표시·복사) |
| 빠른 실행 | 오늘 업무 브리핑 · 잉크원 홍보 문구 · A/S 응대 초안 · 사업 아이디어 (키 없이 맛보기 응답) |

## API 키

- 설정(⚙) → **Google AI Studio API 키**를 붙여넣고 저장. 키는 **그 브라우저의 localStorage에만** 저장되고 이 저장소·화면에는 들어가지 않습니다.
- 기존 앱 키가 같은 주소에 있으면 자동으로 찾아 **가져오기** 버튼을 보여 줍니다(`필드 스튜디오` `ink1fs_gemini_key_v1`, `마르스 비서실` `mars_secretary_mobile_gemini_v1`).
- 이 앱의 키 이름은 `marshud_gemini_key_v1`(독립 저장). 최근 대화는 `marshud_history_v1`(최대 10턴)에만 남습니다.
- **연결 테스트** 버튼은 키를 저장하지 않고 그 자리에서 1회 호출로 확인합니다(약 64토큰, 사실상 무료).
- 음성 인식·마이크는 HTTPS(GitHub Pages)에서 동작합니다. `file://` 단독 파일은 음성 인식이 막힐 수 있어 자막에 안내가 뜹니다.

## 파일

| 파일 | 설명 |
|---|---|
| `index.html` | 화면 구조 (HUD 캔버스 · 자막 · 계획 · 설정 모달) |
| `style.css` | 다크 사이버네틱 테마(`#050b14` · 시안 `#00e5ff` · 골드 `#ffc65c`), 데스크톱·모바일 반응형 |
| `app.js` | 캔버스 렌더러 · 상태 머신 · 음성 인식/TTS · Gemini 호출 · 계획 파싱 · 설정 저장 |
| `build_jarvis_single.py` | 단독 HTML 빌드 → `downloads/마르스_자비스_HUD.html` |
| `verify_jarvis_local.py` | 로컬 서버 + Chromium 헤드리스 검증(22항목, 콘솔 오류 0) |
| `shots_jarvis.py` | 대표 스크린샷 생성(데스크톱·모바일) |
| `verify_jarvis_live.py` | 배포본(GitHub Pages) 실측 |

## 검증

```bash
export LD_LIBRARY_PATH=/workspace/.chromelibs/lib:/workspace/.chromelibs/root/usr/lib/x86_64-linux-gnu
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.pw-browsers
python3 verify_jarvis_local.py      # 로컬 22항목
python3 shots_jarvis.py             # 대표 컷
python3 build_jarvis_single.py      # 단독 파일
python3 verify_jarvis_live.py       # 배포 후 실측
```

수정 후 이 폴더를 `main`에 푸시하면 1분 안팎으로 반영됩니다.
