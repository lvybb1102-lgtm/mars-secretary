# 잉크원_st_AI (잉크원 필드 스튜디오) — v1.4 원고 사진 자동 보존

현장 사진 + 한 줄 메모 → **제목 3안 · 네이버 블로그 본문(서식 HTML) · 스레드 · 15초 쇼츠 대본 · 인스타 캡션 · 해시태그**를 한 번에 만들고,
**⚡ 비공개 GitHub 큐 바로발행 · 네이버 안전모드 · 구글 블로그(Blogger) API · 니케 발행팩 · 로컬 PC 브릿지** 5경로로 내보내는 모바일 퍼스트 PWA입니다.

- 앱 이름: **잉크원_st_AI** (2026-11-28 마르스 님 지정) · 경로는 `/field-studio/` 그대로
- 접속: **https://lvybb1102-lgtm.github.io/mars-secretary/field-studio/**
- 단독 파일: `downloads/잉크원_필드스튜디오_프로토타입.html` (PC·폰에서 파일로 열어도 동작 · `build_field_single.py`로 재생성)
- 로컬 브릿지 샘플: `downloads/field_studio_bridge_sample.py`
- 이 폴더는 `mars-secretary` 저장소의 하위 경로입니다. 같은 주소(lvybb1102-lgtm.github.io)라 **마르스 비서실에 저장한 Gemini 키를 그대로 가져올 수 있습니다**. (`설정 → 비서실 키 가져오기`)

## v1.4 (2026-11-28) — 원고 사진 자동 보존 (IndexedDB)

**증상**: 원고를 만들고 브라우저를 닫았다가 홈 **최근 원고 [열기]**로 다시 열면 사진이 0장이 되어,
**[⚡ 니케에게 바로발행 전송]**에서 `사진 0장` 확인창이 떴습니다.
**원인**: `localStorage`(약 5MB) 한도 때문에 기록(`ink1fs_history_v1`)에는 대표 `thumb` 1장만 넣고
`S.photos` 전체(1~10장 · 가리기 반영본)는 저장하지 않았습니다.

### 저장 구조

| 저장소 | 무엇을 | 한도 |
|---|---|---|
| `localStorage` `ink1fs_history_v1` | 원고 본문·제목·태그 + 대표 썸네일 1장(약 13KB/건) | 최근 20건 |
| **IndexedDB** `ink1_field_studio_db` → `photos_by_result` | 사진 배열 통째로(`disp` 1280px JPEG dataURL · `mini` 260px, `name`·`original`·`takenAt`·`edited`·`width`·`height`·`bytes`)를 **원고 ID 키**로 | 최근 20건 · 60MB |
| **IndexedDB** 같은 DB → `results_meta` | `{id, at, count, bytes}` — 정리(prune)용 가벼운 메타 | 위와 동일 |

- 저장 시점: **원고 생성 직후**, **모자이크(가리기) 저장**, **사진 삭제** 때마다 그 원고 ID로 다시 씁니다.
- AI용 800px(`ai`)는 보관하지 않고 **복원할 때 원본에서 다시 만듭니다**(용량 절반, 화질 손실 없음).
- `[열기]`(`openHistory(id)`) → `photos_by_result`에서 불러와 `S.photos` 복원 → 결과 화면에
  **`📷 사진 N장 포함됨 · 눌러서 저장`** 표시, 홈 목록에도 `· 사진 N장` 표시. 그대로 바로발행 전송하면 사진이 함께 PUT 됩니다.
- 사진이 없는 기기(다른 폰·시크릿 창)에서 열면 예전처럼 원고만 열리고 `사진 0장` 확인창이 뜹니다.
- 정리: 최근 **20건 · 60MB**만 유지(넘으면 오래된 `at`부터 자동 삭제). 기록에서 밀려난 원고(`saveHistory`에서 pop)와
  **기록 전체 삭제(설정)** 시 그 원고의 보관 사진도 함께 삭제됩니다. 설정 화면에 `사진 보관 N건 X.XMB` 표시.
- `file://` 단독 HTML에서도 IndexedDB가 동작합니다(막힌 브라우저에서는 조용히 원고만 열림).

### 검증

- `python3 verify_v14_idb_photos.py` (로컬) / `python3 verify_v14_idb_photos.py <배포URL>` — **41항목**
  저장 필드·복원·바로발행 사진 PUT·삭제 반영·20건 정리·기록 삭제 시 함께 삭제·SW v6·오류 0
- `python3 verify_v13_gh_queue.py` — v1.3 회귀 **72항목** 통과(캐시 기대값만 v6로 수정)
- `python3 verify_v12_cat_share.py` — v1.2 회귀 **62항목** 통과
- `python3 check_single_idb.py` — 단독 HTML(`file://`) 스모크: 보관 2장 → 새로고침 → 복원 2장

## v1.3 (2026-11-28) — ⚡ 원클릭 바로발행 큐 (비공개 GitHub 저장소)

발행팩 복사는 **텍스트만** 가서 사진이 빠졌습니다. 그 구멍을 메우는 경로입니다.
결과 화면 **「🚀 P2 발행 어댑터」 맨 위 주 버튼**을 한 번 누르면 **사진(가리기 반영) + 원고 + 채널 설정**이 비공개 저장소 큐로 올라가고, 니케가 그 큐를 보고 5채널 발행을 진행합니다.

### 설정(⚙) → 「⚡ 원클릭 바로발행 큐 (GitHub)」

| 항목 | 내용 |
|---|---|
| 저장소 (owner/repo) | placeholder `lvybb1102-lgtm/ink1-publish-queue` · `localStorage` 키 **`ink1fs_gh_repo_v1`** |
| GitHub 토큰 (PAT) | `type=password` · `localStorage` 키 **`ink1fs_gh_token_v1`** · 권한은 그 저장소의 **Contents: Read and write** 하나 |
| [연결 테스트] | `GET https://api.github.com/repos/{owner}/{repo}` → `private` 여부 · `permissions.push` 확인, 배지 `연결됨 / 읽기만 / 미연결`, 실패 시 401·403·404별 안내 문구 |

토큰은 **브라우저 localStorage에만** 두고 GitHub API 업로드에만 씁니다. 코드·저장소에는 들어가지 않습니다.

### 업로드 경로 규약 (순서가 핵심)

감시 스크립트가 **미완성 건을 집지 않도록** 완료 표시를 맨 마지막에 올립니다.

```
queue/{request_id}/photos/01_원본이름.jpg     ← 1) 사진부터 순차 업로드 (base64, 가리기 반영 1280px)
queue/{request_id}/photos/02_…
queue/{request_id}/pack.json                  ← 2) 원고·채널·설정 메타 (사진은 경로만 참조, base64 없음)
queue/{request_id}/ready.json                 ← 3) 완료 마커 — 이 파일이 있어야 감시가 집는다
```

- `request_id` 형식: `ink1_YYYYMMDD_HHMMSS_xxxx`(초 단위 + 랜덤 4자). 같은 ID 폴더가 이미 있으면 `-2`, `-3` 접미사를 붙여 충돌을 피합니다(`GET contents/queue/{id}`로 확인).
- `PUT /repos/{owner}/{repo}/contents/{path}` · 커밋 메시지 `ink1 queue {request_id} · 사진 1/5` 처럼 단계가 남습니다. 같은 경로가 이미 있으면 `422` → `sha` 조회 후 덮어쓰기로 자동 재시도합니다.
- **`ready.json` (정확히 이 7개 키)**

```json
{
  "request_id": "ink1_20261128_121256_h9o",
  "title": "복합기 양면 인쇄만 걸림, 급지롤러 교체로 해결 /아싸렌탈수원지사",
  "brand": "ink1",
  "channels": ["naver", "blogger", "youtube", "instagram", "threads"],
  "photo_count": 3,
  "created_at": "2026-11-28T03:12:56.000Z",
  "status": "pending"
}
```

- **`pack.json`**: 기존 `buildPack()` 산출물 그대로(제목 3안·본문 HTML/텍스트·태그·스레드·쇼츠·인스타·유튜브·채널 상태·지킬 것)에 아래를 더합니다.
  - `requestId` = 큐 요청 ID(앱 기록 ID는 `appResultId`로 보존)
  - `photos[]` = `{index, name, original, path, takenAt, edited, bytes, width, height}` — **base64 없음** (사진은 `path` 참조)
  - `queue` = `{request_id, repo, base_path, photos_dir, pack_path, ready_path, order, watcher}` — 감시 스크립트가 바로 읽을 수 있게 경로를 명시
- 진행 표시: `사진 1/3 올리는 중…` → `사진 3/3 올리는 중…` → `원고 올리는 중…` → `완료! 5분 안에 니케가 자동 발행합니다` (진행 바 + 결과 줄에 요청 ID·GitHub 링크)
- 성공하면 채널 상태가 `대기 → 발행요청`으로 바뀌고, **발행 로그에 `⚡ GitHub 큐`** 항목이 남습니다. 이미 보낸 원고는 다시 누를 때 확인창으로 한 번 막습니다(중복 발행 방지).
- 실패(토큰 없음·403·404·네트워크)는 버튼 옆에 그대로 안내하고, **ready.json을 올리지 않으므로** 반쯤 올라간 건은 감시가 집지 않습니다. 토큰이 없으면 업로드 시도 자체를 하지 않습니다.

### 니케 쪽(감시) 규약

- `ready.json`이 있는 `queue/{request_id}/`만 처리 대상. `status: pending` → 처리 후 `published`/`error`로 바꾸거나 `done.json`을 남기는 방식은 감시 스크립트 몫입니다.
- 사진은 `queue/{request_id}/photos/` 아래 실제 파일이므로, 발행 시 사진 업로드가 필요한 채널(네이버·인스타·유튜브)은 이 파일을 그대로 쓰면 됩니다.
- 같은 요청을 두 번 처리하지 않도록 `ready.json`의 `request_id`로 중복을 막습니다.

### 오프라인·단독 파일

- `sw.js` 캐시 **v5**(`ink1-field-studio-v5`)로 올렸습니다. (v1.4에서 **v6**로 올림)
- `downloads/잉크원_필드스튜디오_프로토타입.html`도 `python3 build_field_single.py`로 최신 소스와 맞춰 재생성했습니다(설정·결과 화면 포함, 파일로 열어도 GitHub 업로드 동작).

## v1.2 (2026-11-28) — 작업 카테고리 4종 · 사진 선택 3종 · 공유받기

### 1) 설치 · 교체 · AS · 수리 — 4대 카테고리 카드

쓰기 탭 **맨 위(1번)** 에 2×2 큰 카드로 놓았습니다. 고르면 그 아래 안내선이 바뀝니다.

| 카테고리 | 전개 구조 |
|---|---|
| 🖨️ **설치** | 현장 환경 → 설치 장비 → 초기 세팅 → 테스트 출력 |
| 🔄 **교체** | 기존 문제·노후 상태 → 교체 부품(드럼/롤러/헤드 등) → 교체 전후 비교 |
| 🛠️ **AS** | 고객 접수 증상 → 원인 진단 → 현장 조치 → 재발 방지 팁 |
| 🔧 **수리** | 고장 원인 정밀 점검 → 분해·수리 과정 → 테스트 정상 작동 확인 |

- 기존 `정기점검 · 상담 · 견적 · 철수`는 카드 아래 **보조 칩**으로 유지(고르면 기존 결론→원인→조치→확인→FAQ 순서).
- 프롬프트: 시스템 지침 끝에 `catRule(type)` 블록이 붙어 **소제목 구성까지** 카테고리별로 고정됩니다(`[작업 종류 — 교체 · 이 종류는 아래 전개 구조를 따른다]`). 결론 3줄·CTA는 그대로 두고 중간 전개만 바뀝니다.
- 사용자 지시에도 `작업 종류: 교체 — 기존 문제·노후 상태 → 교체 부품 …` 줄이 들어갑니다.

### 2) 사진 선택 3종 + 공유받기

| 버튼 | 파일 입력 | 쓰는 곳 |
|---|---|---|
| 🖼️ **사진·앨범** | `accept="image/*" multiple` | 포토피커·갤러리 |
| 📁 **폴더·드라이브** | `accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.gif" multiple` | 내 파일·Google Drive·OneDrive·SD카드 |
| 📸 **바로 촬영** | `accept="image/*" capture="environment"` | 카메라 즉시 촬영 |

- 폴더·드라이브용은 `image/*`를 **일부러 넣지 않았습니다.** `image/*`가 있으면 크롬이 다시 포토피커로 보내서 목적(드라이브·폴더 접근)이 사라집니다. 확장자만 지정해야 문서 선택기가 열립니다.
- 사진 영역 아래 꿀팁: *"안드로이드에서 **최근 파일**만 뜨면 왼쪽 위 **≡ → 갤러리**를 누르거나, 갤러리 앨범에서 사진 선택 후 **[공유 → 잉크원_st_AI]**로 바로 보낼 수 있어요."*
- **공유받기(share_target)**: `manifest.webmanifest`에 `share_target`(POST · multipart/form-data · files 필드 `files`, jpeg/png/webp/heic) → `sw.js`가 POST를 받아 Cache Storage(`ink1-field-studio-share-v1`)에 사진 10장까지 보관 → `303` 리다이렉트(`?shared=1&n=`) → 앱이 `./__share__/meta`·`./__share__/f0…`으로 꺼내 **사진 목록에 자동 추가**하고 공유한 글은 메모에 넣습니다. 꺼낸 뒤 공유함은 비웁니다.
- `sw.js` 캐시 버전 **v3 → v4**(`ink1-field-studio-v4`). 기존 네트워크 우선·오프라인 폴백 그대로, 외부(Gemini) 요청은 건드리지 않습니다.
- **설치된 PWA에는 한 번 반영이 늦을 수 있습니다.** 홈 화면 앱을 지우고 다시 추가하거나 Chrome에서 앱을 한 번 열어 두면 `share_target`이 등록됩니다. 안 보이면 재설치가 가장 확실합니다.

## P2 발행 어댑터 (2026-11-28 추가 / v1.3에서 바로발행 큐 추가)

결과 화면 아래 **「🚀 P2 발행 어댑터」** 카드에서 내보냅니다. 맨 위 주 버튼이 **⚡ 비공개 GitHub 큐 바로발행**(위 v1.3 항목)입니다.

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
| 입력 | 작업 종류 **4대 카드(설치·교체·AS·수리)** + 보조 칩(정기점검·상담·견적·철수) + 브랜드 프리셋 3벌 + 한 줄 메모(음성 입력 지원) | `CATS` / `catRule` / `BRANDS` |
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
| `manifest.webmanifest` | 홈 화면 추가(PWA) — name/short_name `잉크원_st_AI` · `share_target`(공유받기) |
| `sw.js` | 오프라인 껍데기 캐시(`/field-studio` 범위만, **v5**) + 공유받기 POST 수신 |
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
- **v1.2 검증**(430×932, 로컬·배포 공용 스크립트 `verify_v12_cat_share.py`, 62항목 전부 통과): 4대 카드(182×83px) 순서·상단 배치, 카테고리별 프롬프트 4종(시스템·사용자 양쪽), 사진 선택 3종 input 속성·파일 선택기 연결, 꿀팁 문구, share_target 매니페스트·sw v4, **공유 POST → 303 → 사진 1장 자동 추가·메모 반영·공유함 비움**, 쓰기 3모드·P2 5채널·4경로 회귀, 가로 스크롤 0·콘솔 0.

## 다음 단계

- YouTube Data API(쇼츠 업로드), Instagram/Threads Graph API 는 앱 심사·토큰 절차가 필요해 다음 단계로 남깁니다.
- 네이버는 공식 글쓰기 API 가 없어 **안전모드(복사 + 1탭)** 를 유지합니다.
