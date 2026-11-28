# 잉크원_st_AI (잉크원 필드 스튜디오) — P2 발행 어댑터

현장 사진 + 한 줄 메모 → **제목 3안 · 네이버 블로그 본문(서식 HTML) · 스레드 · 15초 쇼츠 대본 · 인스타 캡션 · 해시태그**를 한 번에 만들고,
**네이버 안전모드 · 구글 블로그(Blogger) API · 니케 발행팩 · 로컬 PC 브릿지** 4경로로 내보내는 모바일 퍼스트 PWA입니다.

- 앱 이름: **잉크원_st_AI** (2026-11-28 마르스 님 지정) · 경로는 `/field-studio/` 그대로
- 접속: **https://lvybb1102-lgtm.github.io/mars-secretary/field-studio/**
- 단독 파일: `downloads/잉크원_필드스튜디오_프로토타입.html` (PC·폰에서 파일로 열어도 동작)
- 로컬 브릿지 샘플: `downloads/field_studio_bridge_sample.py`
- 이 폴더는 `mars-secretary` 저장소의 하위 경로입니다. 같은 주소(lvybb1102-lgtm.github.io)라 **마르스 비서실에 저장한 Gemini 키를 그대로 가져올 수 있습니다**. (`설정 → 비서실 키 가져오기`)

## P2 발행 어댑터 (2026-11-28 추가)

결과 화면 아래 **「🚀 P2 발행 어댑터」** 카드에서 4경로로 내보냅니다.

| 경로 | 버튼 | 실제 동작 |
|---|---|---|
| **(A) 채널·상태** | 채널 5종 체크 + 상태 배지 | `네이버 블로그 / 구글 블로그(Blogger) / 유튜브 쇼츠 / 인스타그램 / 스레드`. 배지를 누르면 `대기 → 임시저장 → 발행요청 → 발행완료` 순환, 채널별 URL 메모. 글 ID별로 `localStorage`(`ink1fs_publish_v1`)에 저장하고 설정의 **발행 로그**에 시간순으로 남김 |
| **(B) 네이버 안전모드** | `📋 서식 HTML 복사 + 네이버 글쓰기 열기` | `text/html`+`text/plain` 클립보드 복사 후 `https://blog.naver.com/PostWriteForm.naver?blogId=<브랜드 블로그>` 새 탭. 붙여넣고 [발행]만 누르면 됨 |
| **(C) Blogger 공식 API** | `🌐 구글 블로그로 바로 임시저장/발행` | `POST /blogger/v3/blogs/{blogId}/posts/?isDraft=true|false` (`Bearer` 토큰, 본문 `status: draft|live`, `labels`는 `#` 제거). 기본 **임시저장** |
| **(D) 니케 위임 + 로컬 브릿지** | `🤖 발행팩 복사` / `.json 내려받기` / `⚡ 로컬 PC 브릿지로 전송` | `#잉크원_st_AI_발행요청` 마크다운(사람용 섹션 + 기계용 JSON)을 복사. 브릿지 URL이 있으면 사진 base64까지 포함해 `POST` |

### 설정(⚙)에 추가된 항목

- **구글 블로그(Blogger) 설정**: `Blog ID 또는 주소`(예 `ink1-suwon-test.blogspot.com`) + `Google OAuth Access Token`(localStorage 전용, scope `https://www.googleapis.com/auth/blogger`) + **연결 테스트**(`blogs/byurl` → `GET blogs/{id}`). 주소를 넣으면 byurl 로 숫자 ID를 조회해 저장.
- **로컬 PC 브릿지**: `브릿지 URL`(예 `http://192.168.0.12:8787/publish`) + **연결 테스트**(`GET /health`).
- **발행 로그**: 상태 변화 이력(채널·시각·`이전 → 이후`·URL) + JSON 내보내기·지우기.

### 발행팩 헤더

```
#잉크원_st_AI_발행요청
```

사람이 읽는 섹션(제목 후보·본문 HTML·텍스트·태그·스레드·쇼츠·인스타·유튜브·사진·지킬 것) 뒤에 `## 기계용 JSON`(`type: ink1_st_ai_publish_request`)이 붙습니다. 클립보드에는 사진 base64를 넣지 않고(가벼움), `.json` 내려받기와 브릿지 전송에는 넣습니다.

### 로컬 브릿지 샘플

```bash
python3 downloads/field_studio_bridge_sample.py                  # 127.0.0.1:8787
python3 downloads/field_studio_bridge_sample.py --host 0.0.0.0   # 같은 와이파이의 폰에서 접속
python3 downloads/field_studio_bridge_sample.py --host 0.0.0.0 --token ya29.… --blog 1234567890
```

- `GET /health` → `{ok, service, version, blogger}` · `POST /publish` → 원고 9종 + 사진을 `./field-studio-bridge/<요청ID>/`에 저장, 토큰이 있으면 Blogger에도 임시저장.
- CORS·OPTIONS·`Access-Control-Allow-Private-Network` 헤더 포함(폰 브라우저에서 사설망 호출 허용).
- **폰에서 `127.0.0.1` 은 폰 자신**입니다. PC의 LAN IP 또는 터널 주소를 넣어야 합니다.

## 쓰기 3모드 (2026-11-28 추가)

| 모드 | 입력 | 내용 |
|---|---|---|
| 🔧 **설치·AS 후기** | 사진 1~10장 + 한 줄 메모 | 기존 흐름 그대로. 현장 후기 원고 |
| 📝 **정보성 지정 주제** | 주제 1줄(추천 칩 5개) + 사진·메모는 선택 | 그 주제로 정보성 글. **사진 없이 생성 가능** |
| 🎲 **정보성 랜덤 주제** | 없음(주제를 비우면 AI가 선택) | 최근 글 제목을 프롬프트에 넘겨 중복 회피. `다른 주제 뽑기`로 주제만 먼저 굴려볼 수 있음 |

- 랜덤 주제 범위: 잉크원·구글 블로그 = 사무기기(복합기·프린터 임대/수리·유지관리·스캔·네트워크), **swo621 = 일반·생활 정보**. 주제 풀은 잉크원 15개·swo621 12개(가격 없는 주제만).
- 정보성 결과에는 **이번 주제 카드**가 붙고, 홈 기록에는 `정보성·지정 / 정보성·랜덤`으로 표시됩니다.
- 정보성 모드 프롬프트: `INFO_INK` / `INFO_SWO` / `INFO_BLOG`를 기존 `SYS_*` 뒤에 붙임. 사진이 없으면 사진·목격을 언급하지 말고, 없는 상담 사례·수치·오류코드를 짓지 않도록 못박음.
- 해시태그는 코드에서 **10개 상한** 강제(지침 '10개 초과 금지' 보장), 주제에 제목 꼬리표가 붙어 오면 제거.

## 무엇이 실제로 동작하나

| 단계 | 동작 | 구현 |
|---|---|---|
| 사진 | 1~10장, **EXIF 촬영시각 자동 정렬**, 1280px(보관)·800px(AI 입력) 두 벌 리사이즈 (정보성 모드에서는 선택) | `app.js` `exifFromJpeg` / `resize` |
| 가리기 | 손가락·마우스로 **모자이크/블러 브러시**(굵기 조절·되돌리기). 적용하면 AI에도 가린 상태로 전달 | `openMosaic` / `dab` |
| 입력 | 작업 종류 7칩(설치·AS/수리·정기점검·정보글·상담·견적·철수) + 브랜드 프리셋 3벌 + 한 줄 메모(음성 입력 지원) | `TYPES` / `BRANDS` |
| 생성 | **Gemini 실제 호출**(비전: 사진 inlineData). 시스템 프롬프트에 잉크원 지침 내장 | `SYS_INK` / `callModel` |
| 결과 | 제목 3안 선택, 네이버 스마트에디터용 **서식 HTML 복사**(text/html+text/plain), 일반 텍스트·스레드·대본·캡션·태그 복사 | `copyRich` |
| 저장 | 사진+원고 **ZIP 저장**, 원고 HTML 저장, 최근 원고 localStorage 기록(홈 목록) | `makeZip` / `saveToHistory` |

## 지침이 들어 있는 곳

- 제목 끝 ` /아싸렌탈수원지사`, 앞 15자에 지역·기종·증상
- 본문 1,600~1,900자, 결론(3줄)→원인→조치→확인→FAQ→CTA
- CTA `1544-4065`·`https://ink1.kr/`·주소 고정, **가격·임대료 숫자 금지**
- 해시태그 8~10개(지역2·업종2·기종2·서비스), 10개 초과 금지
- 쇼츠 15초: 훅(0~3초)→조치 3단계(3~9초)→엔딩(9~15초), 마지막 음성 `잉크원·아싸렌탈, 1544-4065`
- 스레드 250~350자, 인스타 첫 줄 `수원` 시작·스마트박스·**위치 태그 없음**

## 파일

| 파일 | 설명 |
|---|---|
| `index.html` | 화면 |
| `style.css` | 스타일 |
| `app.js` | 앱 로직(EXIF·모자이크·Gemini·ZIP·기록·P2 발행 어댑터) |
| `manifest.webmanifest` | 홈 화면 추가(PWA) — name/short_name `잉크원_st_AI` |
| `sw.js` | 오프라인 껍데기 캐시(`/field-studio` 범위만, **v3**) |
| `icon-*.png` | 앱 아이콘 |

## 키·보안

- Gemini 키·Blogger 토큰은 **브라우저 localStorage**에만 저장합니다. 코드·저장소에 없습니다.
- 호출은 브라우저 → Google API 직접이라 키가 다른 서버를 거치지 않습니다.
- 사진은 기기 브라우저 안에서만 줄이고, 생성 시에만 Gemini로 전송합니다. 서버 저장 없음(로컬 브릿지는 본인 PC).

## 실측 (2026-11-28)

- 생성 1회 **11.4초**, 실제 모델 `gemini-3.6-flash`, 사진 3장 포함 요청 1회.
- 결과: 본문 1,808자, 태그 8개, 스레드 283자, 쇼츠 3줄, CTA·해시태그 포함.
- 390×844 · 430×932에서 가로 스크롤 0px, 콘솔 오류 0건.
- **정보성 모드 실측**(430×932, 사진 0장, gemini-3.6-flash): 랜덤 8.8~16.2초 · 지정 10~20.3초. 표본 본문 1,531~2,182자(대부분 1,800~2,100), 태그 8~10(10개 상한), 스레드 193~329자, 쇼츠 3줄·엔딩 멘트 고정.
- **P2 발행 어댑터 검증**(430×932, 84항목 전부 통과): 채널 5종·상태 순환·URL 저장, 네이버 새 탭 URL/클립보드 `text/html`+`text/plain`, Blogger POST payload(`isDraft`, `Bearer`, `labels` 8, `status:draft`), 발행팩 마크다운/JSON, 브릿지 payload·/health, 발행 로그, 콘솔 0·가로 스크롤 0.
- **브릿지 실동작**: `/health` 200, `/publish` → 원고 9종 + 사진 원본 저장, `type` 불일치 400, OPTIONS CORS/PNA 헤더 확인.

## 다음 단계

- YouTube Data API(쇼츠 업로드), Instagram/Threads Graph API 는 앱 심사·토큰 절차가 필요해 다음 단계로 남깁니다.
- 네이버는 공식 글쓰기 API 가 없어 **안전모드(복사 + 1탭)** 를 유지합니다.
