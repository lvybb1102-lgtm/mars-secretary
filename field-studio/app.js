/* 잉크원_st_AI — 잉크원 필드 스튜디오 (P1 프로토타입 + P2 발행 어댑터)
   현장 사진 + 한 줄 메모 → Gemini 1회 호출 → 제목 3안·블로그 HTML·스레드·15초 쇼츠·인스타·해시태그
   키는 localStorage에만 저장한다(코드·저장소에 하드코딩 없음). */
(() => {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const LS = {
    key: 'ink1fs_gemini_key_v1',
    oa: 'ink1fs_openai_key_v1',
    cfg: 'ink1fs_cfg_v1',
    hist: 'ink1fs_history_v1',
    pub: 'ink1fs_publish_v1',
    bgBlog: 'ink1fs_blogger_blog_v1',
    bgToken: 'ink1fs_blogger_token_v1',
    bridge: 'ink1fs_bridge_url_v1',
    ghRepo: 'ink1fs_gh_repo_v1',
    ghToken: 'ink1fs_gh_token_v1',
    mars: 'mars_secretary_mobile_gemini_v1',
    marsOa: 'mars_secretary_mobile_openai_v1'
  };
  const API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const BLOG_URL = 'https://blog.naver.com/lvyhs621';

  /* ───────────────────────── 브랜드 프리셋 ───────────────────────── */
  const BRANDS = {
    ink1: {
      id: 'ink1', name: '잉크원', blog: 'lvyhs621',
      label: '잉크원 · lvyhs621',
      line: '잉크원 · 친근한 존댓말 · 결론→원인→조치→CTA · 태그 8~10 · 가격 미표기'
    },
    swo621: {
      id: 'swo621', name: 'swo621', blog: 'inkone_mps',
      label: 'swo621 · 세상의 궁금한 이야기',
      line: 'swo621 · 정보글 톤 · 상호·번호 없음 · 호기심 제목 · 태그 8~10'
    },
    blogger: {
      id: 'blogger', name: '구글 블로그', blog: 'ink1-suwon-test',
      label: '구글 블로그 · ink1-suwon-test',
      line: '구글 블로그 · 담백한 정보형 · 상호 최소 · 검색 키워드 중심'
    }
  };

  /* 현장 후기 4대 카테고리 — 고른 종류에 따라 글 전개 구조가 달라진다 */
  const CATS = {
    '설치': {
      icon: '🖨️', sub: '환경·장비·세팅·시험출력',
      flow: '현장 환경 → 설치 장비 → 초기 세팅 → 테스트 출력',
      sections: '①결론 ②현장 환경(공간·전원·네트워크·용지) ③설치 장비와 구성 ④초기 세팅(드라이버·IP·스캔·팩스) ⑤테스트 출력 결과 ⑥자주 묻는 질문 ⑦CTA'
    },
    '교체': {
      icon: '🔄', sub: '노후 진단·부품·전후 비교',
      flow: '기존 문제·노후 상태 → 교체 부품(드럼/롤러/헤드 등) → 교체 전후 비교',
      sections: '①결론 ②기존 문제와 노후 상태 ③교체한 부품(드럼·급지롤러·픽업롤러·정착기·헤드 등) ④교체 작업과 소요 ⑤교체 전후 비교 ⑥자주 묻는 질문 ⑦CTA'
    },
    'AS': {
      icon: '🛠️', sub: '접수 증상·진단·조치',
      flow: '고객 접수 증상 → 원인 진단 → 현장 조치 → 재발 방지 팁',
      sections: '①결론 ②고객이 접수한 증상 ③원인 진단(어디를 어떤 순서로 확인했는지) ④현장 조치 ⑤재발 방지 팁 ⑥자주 묻는 질문 ⑦CTA'
    },
    '수리': {
      icon: '🔧', sub: '정밀 점검·분해·작동 확인',
      flow: '고장 원인 정밀 점검 → 분해·수리 과정 → 테스트 정상 작동 확인',
      sections: '①결론 ②고장 원인 정밀 점검 ③분해·수리 과정 ④테스트 정상 작동 확인(출력·스캔·양면) ⑤같은 고장 예방 ⑥자주 묻는 질문 ⑦CTA'
    }
  };
  const EXTRA_TYPES = ['정기점검', '상담', '견적', '철수'];
  const TYPE_ALL = Object.keys(CATS).concat(EXTRA_TYPES);

  /* ────────────────── 쓰기 모드 (설치·AS / 정보성 지정 / 정보성 랜덤) ────────────────── */
  const MODES = {
    field: { label: '설치·AS 후기', btn: '이 현장으로 만들기', hint: '작업 종류(설치·교체·AS·수리)를 고르면 사진과 메모가 그 구조로 전개됩니다.' },
    topic: { label: '정보성 지정 주제', btn: '이 주제로 만들기', hint: '주제를 하나 정하면 그 주제로 정보성 글을 씁니다. 사진이 없어도 됩니다.' },
    random: { label: '정보성 랜덤 주제', btn: '🎲 랜덤 주제로 만들기', hint: '주제를 비우면 AI가 최근 글과 겹치지 않는 새 주제를 골라 씁니다. [다른 주제 뽑기]로 주제만 먼저 정해도 됩니다.' }
  };

  /* 지정 주제 — 누르면 바로 채우는 추천 칩 */
  const CHIPS = {
    ink1: [
      '복합기 종이 걸림, 현장에서 바로 빼는 순서',
      '복합기 스캔이 흐릴 때 확인할 3가지',
      '프린터가 오프라인으로 뜰 때 점검 순서',
      '토너 교체 후에도 경고가 남는 이유',
      '사무실 복합기 정기점검 체크리스트'
    ],
    swo621: [
      '장마철 사무실 습기 관리법',
      '겨울철 사무실 전기요금 줄이는 습관',
      '사무실 멀티탭 안전하게 쓰는 법',
      '컴퓨터가 갑자기 느려졌을 때 점검',
      '중고 가전 살 때 확인해야 할 것'
    ]
  };

  /* 랜덤 주제 풀 — '다른 주제 뽑기'(가격 없는 주제만) */
  const TOPICS = {
    ink1: [
      '복합기 종이 걸림, 급지롤러부터 확인하는 이유',
      '복합기 스캔이 흐릴 때 유리판과 롤러 점검법',
      '프린터가 자꾸 오프라인으로 뜰 때 네트워크 점검 순서',
      '토너 교체 후에도 경고가 남는 이유',
      '복합기 양면 인쇄가 한 면만 나올 때 설정 확인법',
      '장마철 복합기 용지 눌어붙음 예방법',
      '복합기 팩스가 안 나갈 때 확인하는 5가지',
      '사무실 와이파이 프린터 연결이 끊길 때 고정 IP 설정',
      '복합기 정기점검 때 실제로 확인해야 하는 것',
      '사무실 이사 후 복합기 재설치 체크리스트',
      '복합기 스캔 파일이 PDF로 저장되지 않을 때',
      '프린터 소음이 커졌을 때 의심할 부품',
      '복합기 화면에 뜨는 오류코드를 읽는 법',
      '복사기 전원이 안 켜질 때 확인 순서',
      '복합기 보안, 스캔 이력과 비밀번호 관리'
    ],
    swo621: [
      '장마철 사무실 습기와 곰팡이 관리법',
      '겨울철 사무실 전기요금을 줄이는 습관',
      '사무실 멀티탭을 안전하게 쓰는 법',
      '컴퓨터가 갑자기 느려졌을 때 3분 점검',
      '중고 가전 살 때 확인해야 할 것',
      '사무실 이사 전에 정리해야 하는 것들',
      '인쇄한 서류를 습기 없이 보관하는 방법',
      '재택근무 때 집에서 인쇄를 아끼는 법',
      '사무실 정수기·냉장고 위생 체크',
      '장거리 운전 전 차량 점검 체크리스트',
      '사무실 조명이 눈에 부담될 때 바꾸는 법',
      '겨울철 실내 적정 습도 맞추는 법'
    ]
  };

  /* ───────────────────────── 상태 ───────────────────────── */
  const S = {
    view: 'home',
    brand: 'ink1',
    mode: 'field',
    topic: '',
    pick: '',
    type: 'AS',
    photos: [],
    memo: '',
    result: null,
    selTitle: 0,
    pane: 'blog',
    history: [],
    pub: {},
    cfg: { model: 'auto' },
    busy: false
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function loadCfg() {
    try {
      const c = JSON.parse(store.get(LS.cfg) || '{}');
      if (c && c.model) S.cfg.model = c.model;
    } catch (e) {}
  }
  function saveCfg() { store.set(LS.cfg, JSON.stringify(S.cfg)); }

  function loadHistory() {
    try { S.history = JSON.parse(store.get(LS.hist) || '[]') || []; } catch (e) { S.history = []; }
  }

  function loadPublish() {
    try { S.pub = JSON.parse(store.get(LS.pub) || '{}') || {}; } catch (e) { S.pub = {}; }
  }
  function saveHistory() {
    while (S.history.length > 20) S.history.pop();
    let ok = store.set(LS.hist, JSON.stringify(S.history));
    if (!ok) {                       // 용량 초과 → 오래된 것부터 버린다
      while (S.history.length > 3 && !ok) { S.history.pop(); ok = store.set(LS.hist, JSON.stringify(S.history)); }
      if (!ok) toast('브라우저 저장 공간이 부족해 기록을 저장하지 못했습니다.', true);
    }
  }

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast' + (isErr ? ' err' : ''); }, 2600);
  }

  /* ───────────────────────── 화면 전환 ───────────────────────── */
  function go(view) {
    S.view = view;
    ['home', 'write', 'result', 'settings'].forEach((v) => {
      $('#v-' + v).classList.toggle('hidden', v !== view);
    });
    $$('#tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
    $('#view').scrollTop = 0;
  }

  function paintBrand() {
    const b = BRANDS[S.brand];
    $('#brandBtn').textContent = b.name + ' ▾';
    $('#whoLine').textContent = b.name + ' · ' + b.blog;
    $('#writePresetLabel').textContent = '· ' + b.name;
    $('#presetLine').textContent = b.line;
    $('#presetLine2').textContent = b.line;
    if (S.mode === 'topic') paintTopicChips();
    if (S.mode === 'random') paintRecentTopics();
  }

  /* 4대 카테고리 + 보조 칩 그림 */
  function paintCats() {
    const box = $('#cats');
    if (!box) return;
    box.innerHTML = '';
    Object.keys(CATS).forEach((k) => {
      const c = CATS[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat' + (S.type === k ? ' on' : '');
      b.dataset.c = k;
      b.setAttribute('aria-pressed', S.type === k ? 'true' : 'false');
      b.innerHTML = '<i>' + c.icon + '</i><b>' + k + '</b><span>' + c.sub + '</span>';
      b.addEventListener('click', () => selectType(k));
      box.appendChild(b);
    });
    const ex = $('#types');
    ex.innerHTML = '';
    EXTRA_TYPES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (S.type === t ? ' on' : '');
      b.textContent = t;
      b.addEventListener('click', () => selectType(t));
      ex.appendChild(b);
    });
    paintCatNote();
  }

  function selectType(t) {
    S.type = t;
    paintCats();
    toast(CATS[t] ? t + ' — ' + CATS[t].flow : t + ' 작업으로 기록합니다');
  }

  function paintCatNote() {
    const n = $('#catNote');
    if (!n) return;
    const c = CATS[S.type];
    n.innerHTML = c
      ? '<b>' + S.type + '</b> · ' + c.flow + ' 순서로 씁니다'
      : '<b>' + S.type + '</b> · 기본 순서(결론→원인→조치→확인→FAQ)로 씁니다';
  }

  /* ───────────────────────── 쓰기 모드 전환 ───────────────────────── */
  function setMode(m) {
    S.mode = MODES[m] ? m : 'field';
    const field = S.mode === 'field';
    $$('#modeTabs .modecard').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
    $('#modeHint').textContent = MODES[S.mode].hint;
    $('#topicCard').classList.toggle('hidden', S.mode !== 'topic');
    $('#randomCard').classList.toggle('hidden', S.mode !== 'random');
    $('#typeCard').classList.toggle('hidden', !field);
    $('#infoCard').classList.toggle('hidden', field);
    $('#memoCard').classList.toggle('hidden', S.mode === 'random');

    $('#photoTitle').textContent = field ? '2. 사진' : '2. 사진 · 선택';
    $('#memoTitle').textContent = field ? '3. 한 줄 메모' : '3. 메모 · 선택';
    $('#memoSub').textContent = field ? '기종·증상·조치' : '넣고 싶은 내용';
    $('#memo').placeholder = field
      ? '예) 성서공단 사무실, 복합기 종이 걸림 수리. 급지롤러 교체하고 양면 20매 시험 출력까지.'
      : '예) 자주 묻는 질문에 "스캔이 흐려요" 사례를 꼭 넣어 주세요. (글에 꼭 넣을 내용만)';
    $('#micHint').textContent = field ? '사진에 없는 사실을 채워 넣습니다' : '글에 꼭 넣을 내용만 적어 주세요';
    $('#makeBtn').textContent = MODES[S.mode].btn;
    $('#infoNote').innerHTML = S.mode === 'topic'
      ? '정보성 글도 <b>제목 3안 · 본문 1,600~1,900자(결론→핵심→방법→체크리스트→FAQ→CTA) · 스레드 · 15초 쇼츠 · 인스타 · 태그 8~10개</b>로 나옴니다. 가격·임대료 숫자는 넣지 않습니다.'
      : 'AI가 주제를 먼저 고르고, 최근 글 제목은 <b>중복 회피</b>를 위해 함께 넘깁니다. 형식은 정보성 글과 같습니다.';

    if (S.mode === 'topic') paintTopicChips();
    if (S.mode === 'random') { paintPick(); paintRecentTopics(); }
    paintThumbs();
  }

  function normTopic(s) {
    return String(s || '').toLowerCase().replace(/[\s·,.\-—~'"“”()\[\]]/g, '');
  }

  /* 지정 주제 추천 칩 */
  function paintTopicChips() {
    const box = $('#topicChips');
    box.innerHTML = '';
    (CHIPS[S.brand] || CHIPS.ink1).forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (S.topic.trim() === t ? ' on' : '');
      b.textContent = t;
      b.addEventListener('click', () => {
        S.topic = t;
        $('#topicInput').value = t;
        $$('#topicChips .chip').forEach((x) => x.classList.toggle('on', x.textContent === t));
      });
      box.appendChild(b);
    });
  }

  /* 랜덤 주제: 뽑기·최근 주제 */
  function paintPick() {
    const box = $('#pickedBox');
    if (S.pick) {
      box.className = 'picked';
      box.textContent = '🎲 ' + S.pick;
    } else {
      box.className = 'picked off';
      box.textContent = '아직 뽑지 않았습니다 · AI가 최근 글과 겹치지 않는 새 주제를 고릅니다';
    }
  }

  function rollTopic() {
    const pool = TOPICS[S.brand] || TOPICS.ink1;
    const seen = new Set();
    S.history.slice(0, 12).forEach((h) => {
      if (h.topic) seen.add(normTopic(h.topic));
      if (h.titles && h.titles[0]) seen.add(normTopic(h.titles[0]));
    });
    seen.add(normTopic(S.pick));
    let cand = pool.filter((t) => !seen.has(normTopic(t)));
    if (!cand.length) cand = pool.slice();
    S.pick = cand[Math.floor(Math.random() * cand.length)];
    paintPick();
    return S.pick;
  }

  function paintRecentTopics() {
    const box = $('#recentTopics');
    box.innerHTML = '';
    const items = [];
    S.history.forEach((h) => {
      const t = String(h.topic || (h.titles && h.titles[0]) || '').trim();
      if (t && items.indexOf(t) < 0) items.push(t);
    });
    if (!items.length) {
      box.innerHTML = '<span class="tiny">아직 쓴 글이 없습니다 · 이번이 첫 랜덤 주제입니다.</span>';
      return;
    }
    items.slice(0, 8).forEach((t) => {
      const s = document.createElement('span');
      s.className = 'chip tag';
      s.style.fontSize = '11px';
      s.title = t;
      s.textContent = t.length > 24 ? t.slice(0, 24) + '…' : t;
      box.appendChild(s);
    });
  }

  /* ───────────────────────── 사진: EXIF·리사이즈 ───────────────────────── */
  function exifFromJpeg(buf) {
    try {
      const dv = new DataView(buf);
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let off = 2;
      while (off < dv.byteLength - 4) {
        if (dv.getUint8(off) !== 0xFF) { off++; continue; }
        const marker = dv.getUint8(off + 1);
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { off += 2; continue; }
        const size = dv.getUint16(off + 2);
        if (marker === 0xE1 && dv.getUint32(off + 4) === 0x45786966) return readTiff(dv, off + 10);
        if (marker === 0xDA) break;
        off += 2 + size;
      }
    } catch (e) {}
    return null;
  }

  function readTiff(dv, base) {
    const little = dv.getUint16(base) === 0x4949;
    const u16 = (o) => dv.getUint16(o, little);
    const u32 = (o) => dv.getUint32(o, little);
    const ascii = (entry) => {
      const count = u32(entry + 4);
      const start = count <= 4 ? entry + 8 : base + u32(entry + 8);
      let s = '';
      for (let i = 0; i < count && i < 32; i++) {
        const c = dv.getUint8(start + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    };
    let exifPtr = 0, dt = '';
    const ifd0 = base + u32(base + 4);
    const n0 = u16(ifd0);
    for (let i = 0; i < n0; i++) {
      const e = ifd0 + 2 + i * 12;
      const tag = u16(e);
      if (tag === 0x8769) exifPtr = base + u32(e + 8);
      else if (tag === 0x0132) dt = ascii(e) || dt;
    }
    if (exifPtr) {
      const n = u16(exifPtr);
      for (let i = 0; i < n; i++) {
        const e = exifPtr + 2 + i * 12;
        if (u16(e) === 0x9003) { const v = ascii(e); if (v) dt = v; }
      }
    }
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(dt);
    if (!m) return null;
    return { key: +(m[1] + m[2] + m[3] + m[4] + m[5] + m[6]), text: m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] };
  }

  function resize(dataUrlOrBitmap, max, q) {
    return new Promise((resolve, reject) => {
      const done = (src, w, h) => {
        const r = Math.min(1, max / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * r)), ch = Math.max(1, Math.round(h * r));
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, cw, ch);
        resolve({ url: c.toDataURL('image/jpeg', q), w: cw, h: ch });
      };
      if (typeof dataUrlOrBitmap === 'string') {
        const img = new Image();
        img.onload = () => done(img, img.naturalWidth, img.naturalHeight);
        img.onerror = reject;
        img.src = dataUrlOrBitmap;
      } else {
        done(dataUrlOrBitmap, dataUrlOrBitmap.width, dataUrlOrBitmap.height);
      }
    });
  }

  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 10 - S.photos.length);
    if (!list.length) return;
    let added = 0;
    for (const f of list) {
      try {
        const buf = await f.arrayBuffer();
        const ex = exifFromJpeg(buf);
        let bmp;
        try { bmp = await createImageBitmap(new Blob([buf], { type: f.type || 'image/jpeg' }), { imageOrientation: 'from-image' }); }
        catch (e) { toast('이 사진은 브라우저에서 열 수 없습니다(HEIC 등). JPG로 저장해 주세요.', true); continue; }
        const disp = await resize(bmp, 1280, 0.86);
        const ai = await resize(bmp, 800, 0.72);
        const mini = await resize(bmp, 260, 0.6);
        S.photos.push({
          id: 'p' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: f.name || 'photo.jpg',
          dateKey: ex ? ex.key : null,
          dateText: ex ? ex.text : '',
          disp: disp.url, ai: ai.url, mini: mini.url, w: disp.w, h: disp.h, edited: false
        });
        added++;
      } catch (e) {
        toast('사진을 읽지 못했습니다: ' + (e && e.message ? e.message : e), true);
      }
    }
    sortPhotos();
    paintThumbs();
    if (added) toast(added + '장 추가 · 촬영 시각 순으로 정렬했습니다');
    if (S.photos.length >= 10) toast('사진은 10장까지입니다.');
  }

  function sortPhotos() {
    S.photos = S.photos
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const ka = a.p.dateKey, kb = b.p.dateKey;
        if (ka && kb && ka !== kb) return ka - kb;
        if (ka && !kb) return -1;
        if (!ka && kb) return 1;
        return a.i - b.i;
      })
      .map((x) => x.p);
  }

  function paintThumbs() {
    const box = $('#thumbs');
    box.innerHTML = '';
    S.photos.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'thumb';
      d.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<img alt="" src="' + p.disp + '">' +
        (p.dateText ? '<span class="stamp">' + p.dateText + '</span>' : '') +
        '<span class="acts"><button data-act="mosaic" data-id="' + p.id + '" title="모자이크" aria-label="모자이크">▨</button>' +
        '<button data-act="del" data-id="' + p.id + '" title="삭제" aria-label="삭제">✕</button></span>';
      box.appendChild(d);
    });
    const add = document.createElement('button');
    add.className = 'addbox';
    add.id = 'addPhoto';
    add.innerHTML = '<b>＋</b>사진 추가';
    add.addEventListener('click', () => $('#pickGallery').click());
    if (S.photos.length && S.photos.length < 10) box.appendChild(add);   // 남은 자리는 격자에서 바로 추가
    $('#pickWrap').classList.toggle('hidden', false);
    const full = S.photos.length >= 10;
    $$('#pickGallery,#pickFiles,#pickCamera').forEach((b) => { b.disabled = full; });
    $('#photoMeta').textContent = S.photos.length + '/10장';
    const dated = S.photos.filter((p) => p.dateKey).length;
    const info = S.mode !== 'field';
    $('#photoHint').textContent = S.photos.length
      ? (info ? '사진 ' + S.photos.length + '장 · 눌러서 가리기 · 글에는 보조 자료로만 반영'
              : '사진을 눌러 얼굴·번호 가리기 · ' + (dated ? dated + '장 촬영 시각 정렬 · ' : '') + 'AI용 800px 별도')
      : (info ? '사진 없이도 만들 수 있습니다 · 넣으면 보조 자료로 반영'
              : '촬영 시각이 있으면 순서대로 정렬합니다 · 사진을 눌러 모자이크');
  }

  /* ───────────────────────── 모자이크 편집기 ───────────────────────── */
  const M = { photo: null, canvas: null, ctx: null, size: 38, mode: 'pixel', undo: [], drawing: false, last: null };

  function openMosaic(id) {
    const p = S.photos.find((x) => x.id === id);
    if (!p) return;
    M.photo = p;
    const c = $('#mCanvas');
    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      M.canvas = c; M.ctx = x; M.undo = [];
      pushUndo();
      $('#mosaicSheet').classList.remove('hidden');
    };
    img.src = p.disp;
  }

  function pushUndo() {
    try {
      M.undo.push(M.canvas.toDataURL('image/jpeg', 0.9));
      if (M.undo.length > 6) M.undo.shift();
    } catch (e) {}
  }

  function canvasPoint(ev) {
    const c = M.canvas;
    const r = c.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (c.width / r.width);
    const py = (ev.clientY - r.top) * (c.height / r.height);
    return { x: px, y: py, scale: c.width / r.width };
  }

  function dab(x, y) {
    const ctx = M.ctx, c = M.canvas;
    const r = Math.max(6, M.size * 0.9) * (c.width / Math.max(320, c.getBoundingClientRect().width || 320));
    const rr = Math.max(10, r);
    const bx = Math.max(0, x - rr), by = Math.max(0, y - rr);
    const bw = Math.min(c.width - bx, rr * 2), bh = Math.min(c.height - by, rr * 2);
    if (bw <= 1 || bh <= 1) return;
    if (M.mode === 'blur') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = 'blur(' + Math.max(6, rr / 3) + 'px)';
      ctx.drawImage(c, bx, by, bw, bh, bx, by, bw, bh);
      ctx.restore();
    } else {
      const block = Math.max(5, rr / 4.2);
      const tw = Math.max(1, Math.round(bw / block)), th = Math.max(1, Math.round(bh / block));
      const t = document.createElement('canvas');
      t.width = tw; t.height = th;
      const tx = t.getContext('2d');
      tx.drawImage(c, bx, by, bw, bh, 0, 0, tw, th);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, tw, th, bx, by, bw, bh);
      ctx.restore();
    }
  }

  function bindCanvas() {
    const c = $('#mCanvas');
    const start = (ev) => {
      ev.preventDefault();
      M.drawing = true;
      pushUndo();
      const p = canvasPoint(ev);
      M.last = p;
      dab(p.x, p.y);
    };
    const move = (ev) => {
      if (!M.drawing) return;
      ev.preventDefault();
      const p = canvasPoint(ev);
      if (M.last) {
        const dx = p.x - M.last.x, dy = p.y - M.last.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.min(24, Math.max(1, Math.round(dist / 8)));
        for (let i = 1; i <= steps; i++) dab(M.last.x + (dx * i) / steps, M.last.y + (dy * i) / steps);
      } else dab(p.x, p.y);
      M.last = p;
    };
    const end = () => { M.drawing = false; M.last = null; };
    c.addEventListener('pointerdown', start);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', end);
    $('#mSize').addEventListener('input', (e) => { M.size = +e.target.value; });
    $('#mMode').addEventListener('click', () => {
      M.mode = M.mode === 'pixel' ? 'blur' : 'pixel';
      $('#mMode').textContent = M.mode === 'pixel' ? '모자이크' : '블러';
    });
    $('#mUndo').addEventListener('click', () => {
      const last = M.undo.pop();
      if (!last) return;
      const img = new Image();
      img.onload = () => { M.ctx.clearRect(0, 0, M.canvas.width, M.canvas.height); M.ctx.drawImage(img, 0, 0); };
      img.src = last;
    });
    $('#mCancel').addEventListener('click', () => {
      M.undo = [];
      $('#mosaicSheet').classList.add('hidden');
    });
    $('#mClose').addEventListener('click', () => $('#mosaicSheet').classList.add('hidden'));
    $('#mSave').addEventListener('click', async () => {
      if (!M.photo || !M.canvas) return;
      const edited = M.canvas.toDataURL('image/jpeg', 0.88);
      const p = M.photo;
      p.disp = edited;
      p.edited = true;
      const ai = await resize(edited, 800, 0.72);
      p.ai = ai.url;
      const mini = await resize(edited, 260, 0.6);
      p.mini = mini.url;
      paintThumbs();
      $('#mosaicSheet').classList.add('hidden');
      toast('가린 사진으로 바꿨습니다 · AI에도 가린 상태로 전달됩니다');
    });
  }

  /* ───────────────────────── Gemini 프롬프트 ───────────────────────── */
  const SYS_INK = `너는 '잉크원/아싸렌탈수원지사'(경기남부 사무기기 복사기·프린터·PC 임대와 수리) 현장 기록 담당자다.
사장님이 현장에서 찍은 사진과 한 줄 메모를 주면, 그 현장을 네이버 블로그 글 1편과 스레드·15초 쇼츠 대본·인스타 캡션으로 한 번에 정리한다.

[브랜드 고정값 — 글자 하나 바꾸지 않는다]
- 상호: 잉크원/아싸렌탈수원지사
- 지역: 수원·화성·평택·동탄·안산·용인 등 경기남부
- 대표번호: 1544-4065 (CTA 한 곳에만)
- 홈페이지: https://ink1.kr/
- 블로그: https://blog.naver.com/lvyhs621
- 주소: 경기 수원시 권선구 경수대로235번길 62-26 1층

[블로그 제목 3안]
- 각 30자 안팎, 끝에 반드시 ' /아싸렌탈수원지사'를 붙인다. 전화번호는 제목에 넣지 않는다.
- 앞 15자 안에 지역·기종·증상 중 최소 둘이 들어간다.
- 세 안은 서로 다른 방식: ① 기종+증상+해결 ② 고객이 검색창에 치는 질문형 ③ 현장 후기형.
- 고객이 실제로 검색하는 말(기종명·오류코드·증상)로 쓴다. '프린터 고장'처럼 뭉뚱그린 말은 쓰지 않는다.

[블로그 본문]
- 본문 전체 1,600~1,900자. 이보다 짧으면 실패다. 소제목 4~6개, 문단은 2~3문장으로 짧게.
- 순서: 결론(3줄 요약) → 원인 → 조치(단계별) → 확인(시험 출력·스캔) → 자주 묻는 질문 2~3개 → CTA.
- 첫 문장은 고객이 검색창에 치는 증상 문장으로 시작한다. 인사는 "안녕하세요, 잉크원·아싸렌탈 수원지사입니다."를 한 번만 쓴다.
- 사진에서 실제로 보이는 것과 메모에 적힌 사실만 쓴다. 기종명·오류코드·부품명·소요시간·출력매수는 근거가 없으면 쓰지 않는다. 모르는 값은 문장 자체를 뺀다.
- 가격·월 임대료·견적 숫자는 블로그·쇼츠·스레드·인스타 어디에도 쓰지 않는다.
- 본문은 네이버 스마트에디터에 붙여넣을 HTML로 쓴다. 태그는 <h2>, <p>, <ul>, <li>, <b> 만 사용하고 표·이미지·링크 태그는 쓰지 않는다.
- "1. "로 시작하는 문단을 만들지 않는다(스마트에디터가 자동 번호매김을 걸어 서식이 깨진다). 목록은 <ul><li>로만 쓴다.
- CTA 마지막 문단 고정:
  잉크원 · 아싸렌탈 수원지사 | 상담 1544-4065 · 톡톡 문의 · https://ink1.kr/
  경기 수원시 권선구 경수대로235번길 62-26 1층
- 본문 맨 끝에 해시태그 8~10개를 한 줄로 붙인다(지역 2 + 업종 2 + 기종 2 + 서비스 2~4). 10개를 넘기지 않는다.

[스레드 글]
- 250~350자, 3~6줄. 250자보다 짧으면 실패다. 문제 1줄 → 원인·방법 3줄 → 블로그 링크 1줄.
- 모든 문장이 서술어로 끝나게 쓴다(중간에 끊긴 문장 금지). 이모지 0~2개, 해시태그 0~2개.

[15초 쇼츠 대본]
- 0~3초 훅(업종·증상 1줄 + 반전 또는 핵심 훅 1줄), 3~9초 조치 3단계, 9~15초 엔딩(블로그 링크 유도).
- 화면 자막과 음성 대사를 따로 적는다. 한 줄은 15자 안팎으로 짧게.
- 엔딩 음성 마지막 문장은 반드시 "잉크원·아싸렌탈, 1544-4065"로 끝낸다.
- 가격·임대료 숫자는 음성과 자막 모두에 넣지 않는다.

[인스타 캡션]
- 첫 줄은 반드시 '수원'으로 시작하는 문장. 1,000자 이내, 첫 두 줄에 증상과 결론.
- 맨 아래에 스마트박스: 구분선 '━' 20자, 상호 / 지역 / 번호 / 블로그 / 홈페이지 / 한 줄 안내 순서, 이모지 줄마다 하나.
- 위치 태그는 넣지 않는다. 해시태그 8~12개를 박스 아래 한 줄로 붙인다.

[유튜브]
- 제목: '수원'을 포함하고 기종·증상과 숫자를 넣는다. 100자 이내. 끝에 (NN초) 표기를 쓰지 않는다.
- 설명: 첫 줄은 증상 한 문장, 그 아래 3줄 요약, 맨 아래 인스타와 같은 스마트박스.

[말투]
- 동네 사장님이 직접 쓰는 친근한 존댓말. 전문가 과시·감탄사·과장 금지. 읽는 사람이 바로 따라 할 수 있게 쓴다.
- 같은 문장을 채널마다 복사하지 않는다. 같은 사실을 블로그는 문단으로, 쇼츠는 3단계로, 스레드는 3줄로 다시 쓴다.`;

  const SYS_SWO = `너는 사무기기 업체 '수우전산'이 운영하는 정보 블로그 'swo621(세상의 궁금한 이야기)'의 필자다.
사진과 메모를 주면, 그 현장에서 뽑아낼 수 있는 '쓸모 있는 정보'로 블로그 글 1편과 스레드·15초 쇼츠 대본·인스타 캡션을 만든다.

[블로그]
- 상호·전화번호·주소·CTA를 넣지 않는다(정보글이다). 브랜드 언급은 최대 한 번, 자연스럽게만.
- 제목 3안: 30자 안팎, 호기심을 부르는 사실·질문형. ' /swo621' 같은 꼬리표를 붙이지 않는다.
- 본문 1,600~1,900자, 소제목 4~6개. 순서: 결론(3줄) → 왜 그런가 → 확인 방법 → 실제 사례 → 자주 묻는 질문 2~3개.
- 사진에 보이는 사실과 메모만 근거로 쓴다. 모르는 수치·모델명은 쓰지 않는다. 가격 숫자는 쓰지 않는다.
- HTML 태그는 <h2>, <p>, <ul>, <li>, <b> 만. "1. "로 시작하는 문단 금지.
- 맨 끝에 해시태그 8~10개 한 줄.

[스레드] 250~350자, 3~6줄, 문제 1줄 → 핵심 3줄 → 링크 1줄. 문장은 서술어로 끝낸다.
[15초 쇼츠] 0~3초 훅 / 3~9초 핵심 3단계 / 9~15초 정리+블로그 링크. 화면 자막과 음성 대사를 따로, 한 줄 15자 안팎. 가격 금지.
[인스타] 첫 줄은 '수원'으로 시작. 스마트박스는 상호(수우전산)·지역(경기남부)·홈페이지 https://ink1.kr/ 만 넣고 전화번호는 넣지 않는다. 해시태그 8~12개. 위치 태그 금지.
[유튜브] 제목에 '수원' 포함, 설명 첫 줄은 증상 한 문장.`;

  const SYS_BLOG = `너는 사무기기 현장 기록을 구글 블로그(Blogger)에 올릴 정보글로 정리하는 필자다.
[블로그] 제목 3안은 검색 키워드 중심 30자 안팎(꼬리표 없음). 본문 1,600~1,900자, 소제목 4~6개, 결론→원인→확인 방법→사례→FAQ. HTML은 <h2>,<p>,<ul>,<li>,<b> 만. 해시태그는 태그 줄로 8~10개. 가격 숫자 금지.
[스레드] 250~350자 요약. [15초 쇼츠] 훅/핵심 3단계/엔딩, 자막과 음성 분리. [인스타] 첫 줄 '수원' 시작, 위치 태그 없음. [유튜브] 제목·설명.`;

  const INFO_INK = `

[정보성 글 모드 — 위 지침보다 이 절이 우선한다]
- 현장 후기가 아닌 '정보성 글'이다. 주제 하나로, 읽는 사람이 바로 써먹을 정보를 쓴다.
- 사진이 없으면 사진·현장 목격을 언급하지 않는다. 사진이 있으면 보이는 범위에서만 보조로 쓴다.
- 없는 상담 사례·출력 매수·소요 시간·오류코드·기종별 고장 이력을 지어내지 않는다. 일반 원리·점검 순서·설정 방법은 구체적으로 쓴다.
- 구성과 분량 배분을 지킨다(소제목 4~5개): ①결론 3줄(150자) ②원인 3문장(300자) ③조치 4단계, 단계마다 2문장·60자 이내(500자) ④체크리스트 4줄, 한 줄 40자 이내(170자) ⑤FAQ 2개, 질문 1줄+답 1문장 80자 이내(240자) → CTA(120자).
- 분량 계약: 본문 1,700~1,900자. **1,900자를 넘거나 1,600자에 못 미치면 실패다.** 출력 전에 글자수를 어림해 보고 넘치면 문단을 덜어 내고, 모자라면 확인 방법 한 문단을 보태 다시 쓴다.
- 스레드: 4~5문장, 280~330자. 문장마다 45자 이상. **250자 미만이면 실패다.**
- 쇼츠: 3줄(0-3 / 3-9 / 9-15초). 엔딩 음성은 정확히 "잉크원·아싸렌탈, 1544-4065".
- 제목 3안: 30자 안팎, 끝에 ' /아싸렌탈수원지사', 앞 15자에 지역·기종·증상 중 둘 이상.
- CTA·해시태그 8~10개·가격 숫자 금지는 위 지침 그대로.`;

  const INFO_SWO = `

[정보성 글 모드 — 위 지침과 겹치면 이 절을 먼저 따른다]
- 사진 없이 주제만 주어진다. 주어진 주제(또는 네가 고른 주제) 하나로 일반·생활 정보 글을 쓴다.
- 상호·전화번호·주소·CTA를 넣지 않는다. 브랜드 언급도 하지 않는다.
- 없는 통계·연구·수치·개인 사례를 지어내지 않는다. 널리 알려진 원리와 실제로 해볼 수 있는 방법·점검 순서로 쓴다.
- 본문 순서: 결론(3줄) → 왜 그런가 → 방법·조치(단계별) → 체크리스트 → 자주 묻는 질문 2~3개.
- 분량 1,600~1,900자(1,900자를 넘기면 실패), 소제목 4~6개, 해시태그 8~10개. 가격 숫자는 쓰지 않는다.
- 스레드는 250~350자(250자 미만 금지). 쇼츠는 3줄·엔딩 9~15초로 끝낸다.
- 제목 3안은 30자 안팎, 꼬리표 없이. 인스타 첫 줄은 '수원'으로 시작하고 위치 태그는 넣지 않는다.`;

  const INFO_BLOG = `

[정보성 글 모드 — 위 지침과 겹치면 이 절을 먼저 따른다]
- 주어진 주제(또는 네가 고른 주제)로 담백한 정보 글을 쓴다. 현장 후기 형식은 쓰지 않는다.
- 사진이 없으면 사진·현장 목격을 언급하지 않는다. 사진이 있으면 보조로만 쓴다.
- 없는 사례·수치·기종별 이력을 지어내지 않는다. 검색하는 사람이 바로 쓸 수 있는 방법·점검 순서로 쓴다.
- 본문 순서: 결론(3줄) → 핵심·원인 → 방법·조치(단계별) → 체크리스트 → 자주 묻는 질문 2~3개. 분량 1,600~1,900자(1,900자 초과 금지), 소제목 4~6개, 태그 8~10개.
- 제목 3안은 검색 키워드 중심 30자 안팎, 꼬리표 없음. 가격 숫자는 쓰지 않는다.`;

  /* 작업 종류별 전개 구조 — 시스템 지침 뒤에 붙는다 */
  function catRule(type) {
    const c = CATS[type];
    if (!c) {
      return '\n\n[작업 종류 — ' + type + ']\n' +
        '- 위 기본 순서를 그대로 따른다.\n' +
        '- 설치·교체·AS·수리 현장이 아니므로 그 네 종류의 전개 구조를 흉내내지 않는다.\n';
    }
    return '\n\n[작업 종류 — ' + type + ' · 이 종류는 아래 전개 구조를 따른다]\n' +
      '- 글의 뼈대: ' + c.flow + '\n' +
      '- 소제목 구성: ' + c.sections + '\n' +
      '- 첫 결론 3줄과 마지막 정리 문단은 그대로 두고, 중간 전개만 위 구조로 바꾼다.\n' +
      '- 다른 작업 종류(설치/교체/AS/수리)의 구조로 쓰지 않는다. ' + type + ' 현장에서 실제로 한 일과 확인한 것만 쓴다.\n' +
      '- 사진·메모에 없는 부품명·수치·소요시간은 쓰지 않는다.\n';
  }

  function systemFor(brand, mode, type) {
    const info = mode && mode !== 'field';
    let sys;
    if (brand === 'swo621') sys = info ? SYS_SWO + INFO_SWO : SYS_SWO;
    else if (brand === 'blogger') sys = info ? SYS_BLOG + INFO_BLOG : SYS_BLOG;
    else sys = info ? SYS_INK + INFO_INK : SYS_INK;
    if (!info) sys += catRule(type || 'AS');
    return sys;
  }

  function recentForPrompt(n) {
    const out = [];
    S.history.slice(0, n).forEach((h) => {
      const t = String((h.titles && h.titles[0]) || '').trim();
      if (t) out.push(t);
      const tp = String(h.topic || '').trim();
      if (tp && tp !== t) out.push('주제: ' + tp);
    });
    return out.slice(0, 20);
  }

  function userPrompt() {
    const b = BRANDS[S.brand];
    const lines = [];
    const info = S.mode !== 'field';
    if (!info) {
      lines.push('작업 종류: ' + S.type + (CATS[S.type] ? ' — ' + CATS[S.type].flow : ''));
      if (S.memo.trim()) lines.push('현장 메모: ' + S.memo.trim());
      lines.push('사진 ' + S.photos.length + '장(촬영 순서대로). 사진에 보이는 것을 근거로 써라.');
      lines.push('브랜드: ' + b.label);
    } else {
      lines.push('작업 종류: 정보글');
      lines.push('모드: ' + MODES[S.mode].label);
      if (S.mode === 'topic') {
        lines.push('주제: ' + S.topic.trim());
        lines.push('위 주제에서 벗어나지 않는다. 주제를 바꾸거나 넓히지 않는다.');
      } else if (S.pick) {
        lines.push('주제: ' + S.pick.trim());
        lines.push('위 주제로 쓴다. 주제를 바꾸지 않고, 최근 글과 같은 각도로 쓰지 않는다.');
      } else {
        lines.push('주제: 네가 새로 하나 고른다. (운영자는 주제를 비워 두었다)');
        lines.push('주제 범위: ' + (S.brand === 'swo621'
          ? '일반·생활 정보 — 사무실·생활·계절·장비 관리 등, 사무기기와 무관해도 된다.'
          : '경기남부 사무실의 복합기·프린터·복사기 임대·수리·유지관리·스캔·네트워크·토너·보안.'));
        lines.push('아래 최근 글과 같은 소재·같은 각도는 피하고, 처음 다루는 주제를 고른다.');
        const recent = recentForPrompt(12);
        if (recent.length) {
          lines.push('최근에 이미 쓴 글(중복 금지):');
          recent.forEach((t) => lines.push('- ' + t));
        } else {
          lines.push('최근에 쓴 글이 없다.');
        }
      }
      if (S.memo.trim()) lines.push('참고 메모(꼭 반영): ' + S.memo.trim());
      if (S.photos.length) {
        lines.push('사진 ' + S.photos.length + '장을 함께 보낸다. 글의 근거가 아니라 보조 자료다. 사진에 없는 내용을 사진에서 본 것처럼 쓰지 마라.');
      } else {
        lines.push('사진은 없다. 사진·현장 목격을 언급하지 마라.');
      }
      lines.push('브랜드: ' + b.label);
    }
    lines.push('');
    lines.push('아래 형식 그대로 출력하라. 다른 말·머리말·코드블록 표시를 쓰지 않는다.');
    lines.push('');
    if (info) lines.push('[TOPIC] 이번 글의 주제 (한 줄, 30자 안팎)');
    lines.push('[TITLE1] 첫 번째 제목');
    lines.push('[TITLE2] 두 번째 제목');
    lines.push('[TITLE3] 세 번째 제목');
    lines.push('[BLOG] 네이버에 붙여넣을 HTML 본문 (1,600자 이상)');
    lines.push('[TAGS] 해시태그를 공백으로 구분해 한 줄 (# 붙여서, 8~10개) — 반드시 출력한다');
    lines.push('[THREADS] 스레드 글 (250자 이상)');
    lines.push('[SHORTS] 0-3초|화면 자막|음성 대사 형식으로 한 줄씩 (3~4줄)');
    lines.push('[INSTA] 인스타 캡션');
    lines.push('[YT_TITLE] 유튜브 제목');
    lines.push('[YT_DESC] 유튜브 설명');
    return lines.join('\n');
  }

  /* ───────────────────────── 모델 선택·호출 ───────────────────────── */
  const CHAIN_AUTO = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  function chain() {
    const m = S.cfg.model && S.cfg.model !== 'auto' ? S.cfg.model : null;
    if (!m) return CHAIN_AUTO.slice();
    return [m].concat(CHAIN_AUTO.filter((x) => x !== m));
  }

  function apiKey() { return (store.get(LS.key) || '').trim(); }

  function friendly(status, msg) {
    const s = String(msg || '');
    if (/API_KEY_INVALID|API key not valid/i.test(s)) return 'API 키가 유효하지 않습니다. 설정에서 Google AI Studio 키를 다시 확인해 주세요.';
    if (/PERMISSION_DENIED|API key expired/i.test(s)) return '이 키로는 호출할 수 없습니다(권한·만료). AI Studio에서 키를 확인해 주세요.';
    if (status === 429) return 'Gemini 사용 한도를 넘었습니다. 잠시 뒤 다시 시도해 주세요.';
    if (status === 403) return '이 키에 모델 권한이 없습니다(403). AI Studio에서 확인해 주세요.';
    if (/RESOURCE_EXHAUSTED/i.test(s)) return '요청이 몰렸습니다. 1분 뒤 다시 시도해 주세요.';
    if (/SAFETY|blocked/i.test(s)) return '사진·메모가 안전 정책에 걸렸습니다. 표현을 바꿔 다시 시도해 주세요.';
    return 'Gemini 호출 실패(' + status + '): ' + s.slice(0, 160);
  }

  async function callModel(model, parts, signal, maxTokens) {
    const key = apiKey();
    const body = {
      contents: [{ role: 'user', parts }],
      systemInstruction: { parts: [{ text: systemFor(S.brand, S.mode, S.type) }] },
      generationConfig: {
        temperature: (S.mode && S.mode !== 'field') ? 0.6 : 1.0,
        maxOutputTokens: maxTokens || 8192,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };
    const res = await fetch(API + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
    const raw = await res.text();
    let j = null;
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok) {
      const msg = (j && j.error && j.error.message) || raw;
      const err = new Error(friendly(res.status, msg));
      err.status = res.status;
      err.raw = msg;
      throw err;
    }
    const cand = (j.candidates || [])[0];
    if (!cand) throw new Error('빈 응답을 받았습니다. 다시 시도해 주세요.');
    const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
    if (!text) throw new Error('응답이 비었습니다(' + (cand.finishReason || '알 수 없음') + '). 다시 시도해 주세요.');
    return { text, finish: cand.finishReason, usage: j.usageMetadata || {}, model };
  }

  function parseSections(text) {
    const tags = ['TOPIC', 'TITLE1', 'TITLE2', 'TITLE3', 'BLOG', 'TAGS', 'THREADS', 'SHORTS', 'INSTA', 'YT_TITLE', 'YT_DESC'];
    const norm = text.replace(/\r/g, '').replace(/\*\*\[?/g, '');
    const hits = [];
    const re = /\[(TOPIC|TITLE1|TITLE2|TITLE3|BLOG|TAGS|THREADS|SHORTS|INSTA|YT_TITLE|YT_DESC)\]/g;
    let m;
    while ((m = re.exec(norm)) !== null) hits.push({ tag: m[1], start: m.index, end: m.index + m[0].length });
    const out = {};
    hits.forEach((h, i) => {
      const stop = i + 1 < hits.length ? hits[i + 1].start : norm.length;
      const v = norm.slice(h.end, stop).trim();
      if (!out[h.tag]) out[h.tag] = v;
      else if (h.tag === 'SHORTS') out[h.tag] += '\n' + v;   // 모델이 [SHORTS]를 줄마다 반복해도 살린다
    });
    return out;
  }

  function htmlToText(html) {
    let t = String(html || '')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|ul|ol|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    const d = document.createElement('textarea');
    d.innerHTML = t;
    t = d.value;
    return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  function parseShorts(raw) {
    return String(raw || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const p = l.split('|').map((x) => x.trim());
        if (p.length >= 3) return { time: p[0], screen: p[1], voice: p.slice(2).join(' ') };
        const m = /^([0-9~\-–]+\s*초?)\s*[:：]?\s*(.*)$/.exec(l);
        if (m) return { time: m[1], screen: m[2], voice: '' };
        return { time: '', screen: l, voice: '' };
      });
  }

  async function generate() {
    if (S.busy) return;
    if (!apiKey()) {
      toast('설정에서 Google AI Studio 키를 먼저 저장해 주세요.', true);
      go('settings');
      return;
    }
    if (S.mode === 'field') {
      if (!S.photos.length && !S.memo.trim()) {
        toast('사진이나 메모 중 하나는 있어야 합니다.', true);
        return;
      }
    } else if (S.mode === 'topic' && !S.topic.trim()) {
      toast('주제를 한 줄 적어 주세요. 아래 추천 주제를 눌러도 됩니다.', true);
      $('#topicInput').focus();
      return;
    }
    S.busy = true;
    $('#makeBtn').disabled = true;
    $('#genSheet').classList.remove('hidden');
    $('#genStage').textContent = '사진 정리 → 지침 확인 → 생성 요청';
    $('#genElapsed').textContent = '0초';
    const t0 = Date.now();
    const elTimer = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      $('#genElapsed').textContent = s + '초';
      $('#genStage').textContent = s < 8 ? '지침·사진을 묶어 요청 중'
        : s < 20 ? 'Gemini가 원고를 쓰는 중' : '거의 끝났습니다 · 조금만 더';
    }, 500);

    const ctrl = new AbortController();
    $('#genCancel').onclick = () => { try { ctrl.abort(); } catch (e) {} };
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 180000);

    const parts = [{ text: userPrompt() }];
    S.photos.forEach((p) => {
      const b64 = (p.ai || '').split(',')[1];
      if (b64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
    });

    let lastErr = null;
    try {
      for (const model of chain()) {
        try {
          let r = await callModel(model, parts, ctrl.signal, 8192);
          let sec = parseSections(r.text);
          if ((!sec.BLOG || sec.BLOG.length < 400) && r.finish === 'MAX_TOKENS') {
            r = await callModel(model, parts, ctrl.signal, 16384);
            sec = parseSections(r.text);
          }
          if (!sec.BLOG) { lastErr = new Error('원고 형식이 깨졌습니다. 다시 시도해 주세요.'); continue; }
          finishResult(sec, r);
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') throw new Error('취소했습니다.');
          if (e && (e.status === 404 || /no longer available|not found|NOT_FOUND/i.test(e.raw || ''))) { continue; }
          if (e && (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 429)) throw e;
          lastErr = e;
        }
      }
      throw lastErr || new Error('생성에 실패했습니다.');
    } catch (e) {
      toast((e && e.message) || '생성에 실패했습니다.', true);
      if (/키/.test(String(e && e.message))) go('settings');
    } finally {
      clearInterval(elTimer);
      clearTimeout(timer);
      $('#genSheet').classList.add('hidden');
      $('#makeBtn').disabled = false;
      S.busy = false;
    }
  }

  function parseTags(sec, html) {
    const clean = (list) => list
      .map((t) => String(t || '').replace(/^[^#\w가-힣]+/, '').replace(/[^#\w가-힣]+$/, ''))
      .filter((t) => t && t.replace(/#/g, '').length > 1)
      .map((t) => (t.startsWith('#') ? t : '#' + t));
    const fromSec = clean(String(sec.TAGS || '').replace(/[,、]/g, ' ').split(/\s+/));
    const fromBody = clean((String(html || '').match(/#[^\s<>#,]+/g) || []));
    const seen = new Set();
    const out = [];
    fromSec.concat(fromBody).forEach((t) => {
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    });
    return out.slice(0, 10);   // 잉크원 지침: 해시태그 10개 초과 금지
  }

  function finishResult(sec, r) {
    const titles = [sec.TITLE1, sec.TITLE2, sec.TITLE3].filter(Boolean).map((t) => t.replace(/^["'“”]|["'“”]$/g, '').trim());
    const tags = parseTags(sec, sec.BLOG);
    const res = {
      id: 'r' + Date.now(),
      at: new Date().toISOString(),
      brand: S.brand,
      mode: S.mode,
      topic: String(sec.TOPIC || (S.mode === 'topic' ? S.topic : S.pick) || '')
        .replace(/\s*\/\s*아싸렌탈수원지사\s*$/, '')   // 주제에 제목 꼬리표가 붙어 오면 뗀다
        .replace(/^["'“”]|["'“”]$/g, '').trim(),
      type: S.mode === 'field' ? S.type : '정보글',
      memo: S.memo.trim(),
      titles: titles.length ? titles : ['(제목 없음)'],
      blogHtml: sec.BLOG || '',
      tags: tags.slice(0, 12),
      threads: sec.THREADS || '',
      shorts: parseShorts(sec.SHORTS),
      insta: sec.INSTA || '',
      ytTitle: sec.YT_TITLE || '',
      ytDesc: sec.YT_DESC || '',
      model: r.model,
      ms: 0,
      usage: r.usage,
      photoCount: S.photos.length,
      thumb: S.photos[0] ? (S.photos[0].mini || '') : ''
    };
    res.blogText = htmlToText(res.blogHtml);
    S.result = res;
    S.selTitle = 0;
    renderResult();
    saveToHistory(res);
    go('result');
    toast('원고 완성 · ' + res.model + ' · ' + (res.tags.length) + '개 태그');
  }

  function saveToHistory(res) {
    const copy = Object.assign({}, res);
    delete copy.usage;
    S.history.unshift(copy);
    saveHistory();
    paintHome();
  }

  /* ───────────────────────── 결과 렌더 ───────────────────────── */
  function renderResult() {
    const r = S.result;
    if (!r) {
      $('#resultEmpty').classList.remove('hidden');
      $('#resultBody').classList.add('hidden');
      return;
    }
    $('#resultEmpty').classList.add('hidden');
    $('#resultBody').classList.remove('hidden');
    $('#resModel').textContent = r.model || '–';

    const info = !!r.mode && r.mode !== 'field';
    const topic = String(r.topic || '').trim();
    $('#resTopicCard').classList.toggle('hidden', !(info && topic));
    if (info && topic) {
      $('#resModeLabel').textContent = MODES[r.mode] ? MODES[r.mode].label : '정보성';
      $('#resTopic').textContent = topic;
    }

    const tl = $('#titleList');
    tl.innerHTML = '';
    const titleKinds = info
      ? ['① 핵심 정리형', '② 검색 질문형', '③ 체크리스트형']
      : ['① 기종+증상+해결', '② 검색 질문형', '③ 현장 후기형'];
    r.titles.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 't' + (i === S.selTitle ? ' on' : '');
      b.innerHTML = '<span>' + esc(t) + '</span><small>' + (titleKinds[i] || '') + '</small>';
      b.addEventListener('click', () => { S.selTitle = i; renderResult(); });
      tl.appendChild(b);
    });

    $('#blogPreview').innerHTML = sanitizeHtml(r.blogHtml);
    $('#threadsBox').textContent = r.threads || '(없음)';
    $('#threadsLen').textContent = (r.threads || '').length + '자 · ' + ((r.threads || '').split('\n').filter(Boolean).length) + '줄';

    const sb = $('#shortsBox');
    sb.innerHTML = '';
    (r.shorts || []).forEach((row) => {
      const d = document.createElement('div');
      d.className = 'shortsrow';
      d.innerHTML = '<div class="tm">' + esc(row.time || '') + '</div><div><div class="sc">' + esc(row.screen) +
        '</div>' + (row.voice ? '<div class="vc">🎙 ' + esc(row.voice) + '</div>' : '') + '</div>';
      sb.appendChild(d);
    });
    if (!(r.shorts || []).length) sb.innerHTML = '<div class="empty">(대본 없음)</div>';

    $('#instaBox').textContent = r.insta || '(없음)';

    const tg = $('#tagList');
    tg.innerHTML = '';
    r.tags.forEach((t) => {
      const s = document.createElement('span');
      s.className = 'chip tag';
      s.textContent = t;
      tg.appendChild(s);
    });
    $('#tagCount').textContent = r.tags.length + '개';

    const rt = $('#resThumbs');
    rt.innerHTML = '';
    if (S.photos.length) {
      S.photos.forEach((p, i) => {
        const d = document.createElement('div');
        d.className = 'thumb';
        d.innerHTML = '<span class="num">' + (i + 1) + '</span><img alt="" src="' + p.disp + '">';
        d.addEventListener('click', () => downloadDataUrl(p.disp, '현장사진_' + String(i + 1).padStart(2, '0') + '.jpg'));
        rt.appendChild(d);
      });
      $('#resPhotoMeta').textContent = S.photos.length + '장 · 눌러서 저장';
      $('#resPhotoCard').classList.remove('hidden');
    } else if (info) {
      $('#resPhotoCard').classList.add('hidden');
    } else {
      rt.innerHTML = '<div class="muted" style="grid-column:1/-1">이 원고는 기록에서 열었습니다. 사진은 그때 쓰던 기기에만 남습니다.</div>';
      $('#resPhotoMeta').textContent = '';
      $('#resPhotoCard').classList.remove('hidden');
    }

    $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.p === S.pane));
    $$('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + S.pane));

    // P2 발행 어댑터
    renderChannels();
    paintP2();
    const nOut = $('#naverOut');
    if (nOut) nOut.textContent = '';
    const bOut = $('#bgOut');
    if (bOut) bOut.textContent = '';
    const rOut = $('#bridgeOut');
    if (rOut) rOut.textContent = '';
    const gOut = $('#ghOut');
    if (gOut) gOut.textContent = '';
    ghProg('', 0);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function sanitizeHtml(h) {
    const ok = /^(P|H1|H2|H3|UL|OL|LI|B|STRONG|BR|DIV|SPAN|EM|I|BLOCKQUOTE)$/;
    const d = document.createElement('div');
    d.innerHTML = String(h || '');
    const walk = (node) => {
      Array.from(node.children).forEach((el) => {
        if (!ok.test(el.tagName)) {
          const frag = document.createDocumentFragment();
          while (el.firstChild) frag.appendChild(el.firstChild);
          el.replaceWith(frag);
          return;
        }
        Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
        walk(el);
      });
    };
    walk(d);
    return d.innerHTML;
  }

  /* ───────────────────────── 복사·저장 ───────────────────────── */
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (x) {}
      ta.remove();
      return ok;
    }
  }

  async function copyRich(html, text) {
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]);
        return true;
      } catch (e) {}
    }
    const d = document.createElement('div');
    d.contentEditable = 'true';
    d.innerHTML = html;
    d.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(d);
    const rng = document.createRange();
    rng.selectNodeContents(d);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rng);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    sel.removeAllRanges();
    d.remove();
    return ok;
  }

  function downloadDataUrl(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadBlob(blob, name) {
    const u = URL.createObjectURL(blob);
    downloadDataUrl(u, name);
    setTimeout(() => URL.revokeObjectURL(u), 8000);
  }

  /* 최소 ZIP(무압축) — 의존성 없이 사진·원고를 한 파일로 */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const dt = new Date();
    const dosTime = ((dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate()) & 0xFFFF;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data));
      const crc = crc32(data);
      const lh = new Uint8Array(30 + name.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);      // UTF-8 이름
      dv.setUint16(8, 0, true);           // 무압축
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lh.set(name, 30);
      chunks.push(lh, data);
      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + data.length;
    });
    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  function dataUrlToU8(url) {
    const b64 = String(url || '').split(',')[1] || '';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function zipName(r) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return '잉크원_st_AI_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function buildPackage(r) {
    const files = [];
    S.photos.forEach((p, i) => files.push({ name: '사진/' + String(i + 1).padStart(2, '0') + '_현장.jpg', data: dataUrlToU8(p.disp) }));
    const title = r.titles[S.selTitle] || r.titles[0] || '';
    files.push({ name: '원고.html', data: '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title>\n<h1>' + esc(title) + '</h1>\n' + r.blogHtml });
    files.push({ name: '원고_텍스트.txt', data: title + '\n\n' + r.blogText });
    files.push({ name: '해시태그.txt', data: r.tags.join(' ') });
    files.push({ name: '스레드.txt', data: r.threads });
    files.push({ name: '쇼츠대본.txt', data: (r.shorts || []).map((s) => s.time + ' | ' + s.screen + (s.voice ? ' | ' + s.voice : '')).join('\n') });
    files.push({ name: '인스타캡션.txt', data: r.insta });
    if (r.ytTitle) files.push({ name: '유튜브.txt', data: r.ytTitle + '\n\n' + r.ytDesc });
    return files;
  }

  /* ═════════════════════ P2 발행 어댑터 ═════════════════════ */
  const CHANNELS = [
    { id: 'naver', name: '네이버 블로그', sub: '안전모드 · 서식 HTML 1탭 쓰기' },
    { id: 'blogger', name: '구글 블로그(Blogger)', sub: '공식 API · 임시저장/발행' },
    { id: 'youtube', name: '유튜브 쇼츠', sub: '15초 대본 · 제목/설명' },
    { id: 'instagram', name: '인스타그램', sub: '캡션 · 위치 태그 없음' },
    { id: 'threads', name: '스레드', sub: '글 250~350자' }
  ];
  const PUB_STATES = ['대기', '임시저장', '발행요청', '발행완료'];
  const BLOGGER_API = 'https://www.googleapis.com/blogger/v3/';
  const GUARDRAILS = [
    '가격·월 임대료·견적 숫자는 어느 채널에도 넣지 않는다',
    '제목 끝 /아싸렌탈수원지사 유지(잉크원 프리셋), 전화번호는 제목에 넣지 않는다',
    '인스타 위치 태그 없음 · 첫 줄은 "수원"으로 시작',
    '쇼츠 엔딩 음성은 "잉크원·아싸렌탈, 1544-4065"로 끝낸다',
    '해시태그 8~10개(10개 초과 금지)'
  ];

  function pubId(r) { return (r && r.id) || 'none'; }

  function pubEntry(rid, create) {
    if (!S.pub[rid] && create) S.pub[rid] = { ch: {}, log: [] };
    return S.pub[rid] || { ch: {}, log: [] };
  }

  function chState(rid, chId) {
    const e = pubEntry(rid, true);
    if (!e.ch[chId]) e.ch[chId] = { on: true, status: '대기', url: '' };
    return e.ch[chId];
  }

  function setPub(rid, chId, patch) {
    const e = pubEntry(rid, true);
    const st = chState(rid, chId);
    const from = st.status;
    Object.assign(st, patch);
    if (patch.status && patch.status !== from) {
      e.log.unshift({ at: new Date().toISOString(), ch: chId, from: from, to: st.status, url: st.url || '' });
      while (e.log.length > 30) e.log.pop();
    } else if (patch.url !== undefined && e.log[0]) {
      e.log[0].url = st.url || e.log[0].url;
    }
    savePublish();
  }

  function savePublish() {
    const keep = {};
    const ids = {};
    S.history.forEach((h) => { if (h && h.id) ids[h.id] = 1; });
    if (S.result && S.result.id) ids[S.result.id] = 1;
    Object.keys(S.pub).forEach((k) => { if (ids[k]) keep[k] = S.pub[k]; });
    let n = Object.keys(keep).length;
    if (n > 40) {                       // 너무 많으면 오래된 것부터 버린다
      Object.keys(keep).sort((a, b) => {
        const ta = (keep[a].log[0] && keep[a].log[0].at) || '';
        const tb = (keep[b].log[0] && keep[b].log[0].at) || '';
        return String(ta).localeCompare(String(tb));
      }).slice(0, n - 40).forEach((k) => { delete keep[k]; });
    }
    store.set(LS.pub, JSON.stringify(keep));
  }

  function chLabel(id) {
    if (id === 'gh') return '⚡ GitHub 큐';
    const c = CHANNELS.filter((x) => x.id === id)[0];
    return c ? c.name : id;
  }

  function onChannels(rid) {
    return CHANNELS.filter((c) => chState(rid, c.id).on).map((c) => c.id);
  }

  function fmtShort(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtFull(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ── 채널 목록 렌더 ── */
  function renderChannels() {
    const box = $('#chList');
    if (!box) return;
    box.innerHTML = '';
    const r = S.result;
    if (!r) return;
    const rid = pubId(r);
    CHANNELS.forEach((c, i) => {
      const st = chState(rid, c.id);
      const row = document.createElement('div');
      row.className = 'chrow' + (i === 0 ? ' first' : '');

      const cb = document.createElement('button');
      cb.type = 'button';
      cb.className = 'chk' + (st.on ? ' on' : '');
      cb.textContent = st.on ? '✓' : '';
      cb.setAttribute('aria-label', c.name + ' 선택');
      cb.addEventListener('click', () => {
        st.on = !st.on;
        savePublish();
        renderChannels();
        paintP2();
      });

      const nm = document.createElement('div');
      nm.className = 'chname';
      nm.innerHTML = esc(c.name) + '<small>' + esc(c.sub) + '</small>';

      const sb = document.createElement('button');
      sb.type = 'button';
      sb.className = 'chstatus s' + Math.max(0, PUB_STATES.indexOf(st.status));
      sb.textContent = st.status;
      sb.title = '눌러서 상태 바꾸기';
      sb.addEventListener('click', () => {
        const idx = (Math.max(0, PUB_STATES.indexOf(st.status)) + 1) % PUB_STATES.length;
        setPub(rid, c.id, { status: PUB_STATES[idx] });
        renderChannels();
        paintP2();
        paintPublishLog();
        toast(c.name + ' → ' + PUB_STATES[idx]);
      });

      row.appendChild(cb);
      row.appendChild(nm);
      row.appendChild(sb);
      box.appendChild(row);

      if (st.status === '임시저장' || st.status === '발행완료' || st.url) {
        const w = document.createElement('div');
        w.className = 'churl';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = st.url || '';
        inp.placeholder = '발행 URL 메모 (선택)';
        inp.addEventListener('change', () => {
          st.url = inp.value.trim();
          setPub(rid, c.id, { url: st.url });
          paintPublishLog();
        });
        w.appendChild(inp);
        box.appendChild(w);
      }
    });
  }

  function paintP2() {
    const r = S.result;
    if (!r) return;
    const rid = pubId(r);
    const on = onChannels(rid);
    const done = CHANNELS.filter((c) => chState(rid, c.id).status === '발행완료').length;
    $('#p2Sum').textContent = on.length + '/5 채널 · 발행완료 ' + done;

    const c = bloggerCfg();
    const bs = $('#bgState');
    if (!c.token) {
      bs.innerHTML = '토큰 없음 · 설정(⚙)에서 넣으면 바로 올릴 수 있어요. 지금은 <b>HTML 복사</b>로 대체합니다.';
    } else if (!c.blog) {
      bs.innerHTML = '토큰 있음 · <b>Blog ID가 비어 있습니다</b> · 설정(⚙)에서 넣어 주세요.';
    } else {
      const draft = $('#bgDraft') ? $('#bgDraft').checked : true;
      bs.innerHTML = '연결 설정됨 · <b>' + esc(c.blog) + '</b> · ' + (draft ? '임시저장(draft)' : '바로 공개');
    }

    const bu = bridgeUrl();
    $('#bridgeState').textContent = bu ? '연결 설정됨 · ' + bu : 'URL 미설정 · 설정(⚙)에서 브릿지 주소를 넣으세요.';

    const gs = $('#ghState');
    if (gs) {
      const gc = ghCfg();
      if (!gc.owner) gs.innerHTML = '<b>저장소 주소 확인</b> · 설정(⚙)에서 owner/repo 형식으로 넣어 주세요.';
      else if (!gc.token) gs.innerHTML = '<b>비공개 큐 미설정</b> · 설정(⚙)에서 GitHub 토큰(PAT)을 넣으면 이 버튼으로 사진+원고가 바로 넘어갑니다.';
      else gs.innerHTML = '큐 <b>' + esc(gc.repo) + '</b> · 사진 ' + S.photos.length + '장 + 원고를 올리고 니케가 5분 안에 발행합니다.';
    }
  }

  /* ── 발행 로그(설정 화면) ── */
  function paintPublishLog() {
    const box = $('#pubLogList');
    if (!box) return;
    const rows = [];
    Object.keys(S.pub).forEach((rid) => {
      const e = S.pub[rid];
      if (!e || !e.log) return;
      e.log.forEach((l) => rows.push(Object.assign({ rid: rid }, l)));
    });
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    $('#pubLogN').textContent = rows.length ? rows.length + '건' : '';
    if (!rows.length) {
      box.innerHTML = '<div class="empty">아직 발행 기록이 없습니다.</div>';
      return;
    }
    box.innerHTML = '';
    rows.slice(0, 12).forEach((l) => {
      const d = document.createElement('div');
      d.className = 'logrow';
      d.innerHTML = '<b>' + esc(chLabel(l.ch)) + '</b>' +
        '<span class="lg">' + esc(fmtShort(l.at)) + '</span>' +
        '<span class="lg" style="grid-column:1/-1">' + esc(l.from || '') + ' → ' + esc(l.to || '') + '</span>' +
        (l.url ? '<span class="lu">' + esc(l.url) + '</span>' : '');
      box.appendChild(d);
    });
  }

  /* ── 발행팩(니케 위임) ── */
  function buildPack(r) {
    const rid = pubId(r);
    const b = BRANDS[r.brand] || BRANDS.ink1;
    const title = r.titles[S.selTitle] || r.titles[0] || '';
    const states = {};
    CHANNELS.forEach((c) => {
      const st = chState(rid, c.id);
      states[c.id] = { on: !!st.on, status: st.status, url: st.url || '' };
    });
    return {
      header: '#잉크원_st_AI_발행요청',
      app: '잉크원_st_AI',
      type: 'ink1_st_ai_publish_request',
      version: 'P2.0',
      requestId: rid,
      requestedAt: new Date().toISOString(),
      brand: { id: b.id, name: b.name, blog: b.blog, label: b.label },
      mode: r.mode || 'field',
      modeLabel: (MODES[r.mode] || {}).label || '설치·AS 후기',
      topic: r.topic || '',
      workType: r.type || '',
      title: title,
      titles: r.titles || [],
      article: {
        title: title,
        blogHtml: r.blogHtml || '',
        blogText: r.blogText || '',
        tags: r.tags || [],
        threads: r.threads || '',
        shorts: r.shorts || [],
        insta: r.insta || '',
        ytTitle: r.ytTitle || '',
        ytDesc: r.ytDesc || ''
      },
      photos: S.photos.map((p, i) => ({
        name: String(i + 1).padStart(2, '0') + '_' + (p.name || '현장.jpg'),
        takenAt: p.dateText || '',
        dataUrl: p.ai || p.disp || ''
      })),
      channels: onChannels(rid),
      channelStates: states,
      publish: {
        naver: { mode: 'safe_write', blogId: (r.brand === 'blogger' ? 'lvyhs621' : (b.blog || 'lvyhs621')) },
        blogger: { draft: $('#bgDraft') ? $('#bgDraft').checked : true, blogId: bloggerCfg().blog || '' },
        youtube: { format: 'shorts', seconds: 15 },
        instagram: { locationTag: false },
        threads: { maxChars: 350 }
      },
      guardrails: GUARDRAILS
    };
  }

  function packForClipboard(p) {
    const c = JSON.parse(JSON.stringify(p));
    c.photos = (p.photos || []).map((x, i) => ({ name: x.name, takenAt: x.takenAt, index: i + 1 }));
    c.note = '사진 원본은 앱의 [사진 + 원고 ZIP] 또는 로컬 PC 브릿지 전송으로 넘깁니다.';
    return c;
  }

  function packMarkdown(p) {
    const L = [];
    const push = (s) => L.push(s);
    push(p.header);
    push('');
    push('- 요청 ID: ' + p.requestId);
    push('- 만든 시각: ' + fmtFull(p.requestedAt));
    push('- 브랜드: ' + p.brand.name + ' (' + p.brand.blog + ')');
    push('- 모드: ' + p.modeLabel + (p.topic ? ' · 주제: ' + p.topic : ''));
    push('- 작업 종류: ' + (p.workType || '-'));
    push('- 제목: ' + p.title);
    push('- 선택 채널: ' + (p.channels.length ? p.channels.map(chLabel).join(', ') : '(없음)'));
    push('- 사진: ' + p.photos.length + '장' + (p.photos.length ? ' (' + p.photos.map((x) => x.name).join(', ') + ')' : ''));
    push('- 발행 방식: 네이버=서식 HTML 붙여넣기 / Blogger=' + (p.publish.blogger.draft ? '임시저장' : '바로 공개') + ' / 유튜브=쇼츠 대본·제목·설명 / 인스타=캡션(위치 태그 없음) / 스레드=글');
    push('');
    push('## 제목 후보');
    (p.titles || []).forEach((t, i) => push((i + 1) + '. ' + t));
    push('');
    push('## 블로그 본문 (서식 HTML)');
    push('```html');
    push(p.article.blogHtml);
    push('```');
    push('');
    push('## 블로그 본문 (일반 텍스트)');
    push(p.article.blogText);
    push('');
    push('## 해시태그 (' + (p.article.tags || []).length + '개)');
    push((p.article.tags || []).join(' '));
    push('');
    push('## 스레드');
    push(p.article.threads);
    push('');
    push('## 15초 쇼츠 대본');
    (p.article.shorts || []).forEach((s) => push((s.time || '') + ' | ' + (s.screen || '') + ' | ' + (s.voice || '')));
    push('');
    push('## 인스타그램 캡션');
    push(p.article.insta);
    push('');
    push('## 유튜브');
    push('제목: ' + (p.article.ytTitle || ''));
    push('설명: ' + (p.article.ytDesc || ''));
    push('');
    push('## 사진');
    if (!p.photos.length) push('(사진 없음)');
    p.photos.forEach((x) => push('- ' + x.name + (x.takenAt ? ' · 촬영 ' + x.takenAt : '')));
    push('');
    push('## 지킬 것');
    p.guardrails.forEach((g) => push('- ' + g));
    push('');
    push('## 기계용 JSON');
    push('```json');
    push(JSON.stringify(packForClipboard(p), null, 1));
    push('```');
    return L.join('\n');
  }

  async function copyPack() {
    const r = S.result;
    if (!r) return;
    const p = buildPack(r);
    const ok = await copyText(packMarkdown(p));
    if (ok) {
      const rid = pubId(r);
      onChannels(rid).forEach((id) => { if (chState(rid, id).status === '대기') setPub(rid, id, { status: '발행요청' }); });
      renderChannels();
      paintP2();
      paintPublishLog();
    }
    toast(ok ? '발행팩을 복사했습니다 · 채팅에 붙여넣으면 니케가 4채널 발행을 실행합니다' : '복사에 실패했습니다 · .json 내려받기를 써 주세요', !ok);
  }

  function downloadPack() {
    const r = S.result;
    if (!r) return;
    const p = buildPack(r);
    const d = new Date();
    const pd = (n) => String(n).padStart(2, '0');
    const name = '잉크원_st_AI_발행팩_' + d.getFullYear() + pd(d.getMonth() + 1) + pd(d.getDate()) + '_' + pd(d.getHours()) + pd(d.getMinutes()) + '.json';
    downloadBlob(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }), name);
    toast('발행팩 JSON을 저장했습니다 · 사진 ' + p.photos.length + '장 포함');
  }

  function openTab(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ── (B) 네이버 안전모드 ── */
  async function naverSafe() {
    const r = S.result;
    if (!r) return;
    const b = BRANDS[r.brand] || BRANDS.ink1;
    const blogId = r.brand === 'blogger' ? 'lvyhs621' : (b.blog || 'lvyhs621');
    const ok = await copyRich(r.blogHtml, r.blogText);
    const url = 'https://blog.naver.com/PostWriteForm.naver?blogId=' + encodeURIComponent(blogId);
    openTab(url);
    const rid = pubId(r);
    if (chState(rid, 'naver').status === '대기') setPub(rid, 'naver', { status: '발행요청' });
    renderChannels();
    paintP2();
    paintPublishLog();
    const out = $('#naverOut');
    if (out) out.innerHTML = ok
      ? '복사 완료 · `' + esc(blogId) + '` 글쓰기 창이 열렸습니다. 본문 칸에 붙여넣고 [발행]만 누르세요.'
      : '복사가 막혔습니다. 원고 카드의 <b>서식 HTML 복사</b>를 먼저 눌러 주세요.';
    toast(ok ? '서식 HTML 복사 완료 · 네이버 글쓰기 창에서 붙여넣고 [발행]만 누르세요' : '복사에 실패했습니다 · 서식 HTML 복사를 먼저 눌러 주세요', !ok);
  }

  /* ── (C) Blogger 공식 API ── */
  function bloggerCfg() {
    return {
      blog: (store.get(LS.bgBlog) || '').trim(),
      token: (store.get(LS.bgToken) || '').trim()
    };
  }

  function blogErr(status, raw) {
    let msg = String(raw || '');
    try {
      const j = JSON.parse(raw);
      if (j && j.error && j.error.message) msg = j.error.message;
    } catch (e) {}
    if (status === 401) return new Error('토큰이 만료됐거나 잘못됐습니다(401). blogger 권한으로 새 토큰을 받아 주세요.');
    if (status === 403) return new Error('권한이 없습니다(403). 토큰 scope에 https://www.googleapis.com/auth/blogger 가 있는지 확인해 주세요.');
    if (status === 404) return new Error('블로그를 찾지 못했습니다(404). Blog ID를 확인해 주세요.');
    return new Error('Blogger API 오류(' + status + '): ' + msg.slice(0, 150));
  }

  function netErr(e) {
    if (e && e.name === 'TypeError') {
      return new Error('브라우저에서 Blogger API 직접 호출이 막혔습니다(CORS·네트워크). 발행팩이나 로컬 PC 브릿지를 써 주세요.');
    }
    return e;
  }

  async function bloggerResolve(c) {
    const v = c.blog;
    if (!/^(https?:\/\/|.*blogspot\.)/i.test(v)) return v;
    const url = /^https?:/i.test(v) ? v : 'https://' + v;
    const res = await fetch(BLOGGER_API + 'blogs/byurl?url=' + encodeURIComponent(url), {
      headers: { Authorization: 'Bearer ' + c.token }
    });
    const raw = await res.text();
    let j = {};
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok) throw blogErr(res.status, raw);
    if (!j.id) throw new Error('블로그 ID를 찾지 못했습니다. 숫자 ID를 직접 넣어 주세요.');
    store.set(LS.bgBlog, j.id);
    toast('Blog ID를 찾았습니다: ' + j.id);
    return j.id;
  }

  async function bloggerTest() {
    const c = bloggerCfg();
    const out = $('#bgTestOut');
    if (!c.token) { toast('Access Token을 먼저 저장해 주세요.', true); return; }
    if (!c.blog) { toast('Blog ID 또는 주소를 먼저 넣어 주세요.', true); return; }
    if (out) out.textContent = '확인 중…';
    try {
      const id = await bloggerResolve(c);
      const res = await fetch(BLOGGER_API + 'blogs/' + encodeURIComponent(id) + '?fields=id,name,url,posts/totalItems', {
        headers: { Authorization: 'Bearer ' + c.token }
      });
      const raw = await res.text();
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {}
      if (!res.ok) throw blogErr(res.status, raw);
      const line = '연결됨 · ' + (j.name || id) + ' · ' + (j.url || '') + ' · 글 ' + ((j.posts && j.posts.totalItems) || 0) + '개';
      if (out) out.textContent = line;
      toast('Blogger 연결됨 · ' + (j.name || id));
      return id;
    } catch (e) {
      const m = netErr(e);
      if (out) out.textContent = m.message;
      toast(m.message, true);
    }
  }

  async function bloggerSend() {
    const r = S.result;
    if (!r) return;
    const c = bloggerCfg();
    const out = $('#bgOut');
    if (!c.token || !c.blog) {
      const ok = await copyRich(r.blogHtml, r.blogText);
      if (out) out.innerHTML = '토큰·블로그 ID가 없어 <b>서식 HTML을 복사</b>했습니다. 설정(⚙)에서 연결하면 바로 올릴 수 있습니다.';
      toast(ok ? '설정 전이라 본문 HTML만 복사했습니다' : '설정을 먼저 마쳐 주세요', true);
      return;
    }
    const draft = $('#bgDraft') ? $('#bgDraft').checked : true;
    const title = r.titles[S.selTitle] || r.titles[0] || '';
    const body = {
      kind: 'blogger#post',
      title: title,
      content: r.blogHtml,
      labels: (r.tags || []).map((t) => String(t).replace(/^#/, '')).filter(Boolean),
      status: draft ? 'draft' : 'live'
    };
    if (out) out.textContent = (draft ? '임시저장' : '발행') + ' 요청 중…';
    $('#bgSend').disabled = true;
    try {
      const id = await bloggerResolve(c);
      const res = await fetch(BLOGGER_API + 'blogs/' + encodeURIComponent(id) + '/posts/?isDraft=' + (draft ? 'true' : 'false'), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const raw = await res.text();
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {}
      if (!res.ok) throw blogErr(res.status, raw);
      const rid = pubId(r);
      setPub(rid, 'blogger', { status: draft ? '임시저장' : '발행완료', url: j.url || '' });
      renderChannels();
      paintP2();
      paintPublishLog();
      if (out) out.innerHTML = '완료 · ' + (draft ? '임시저장' : '발행') + ' · ' + (j.url ? '<b>' + esc(j.url) + '</b>' : 'id ' + esc(j.id || ''));
      toast(draft ? '구글 블로그에 임시저장했습니다' : '구글 블로그에 발행했습니다');
    } catch (e) {
      const m = netErr(e);
      if (out) out.textContent = m.message;
      toast(m.message, true);
    } finally {
      $('#bgSend').disabled = false;
    }
  }

  /* ── (D) 로컬 PC 브릿지 ── */
  function bridgeUrl() { return (store.get(LS.bridge) || '').trim(); }

  function healthUrl(u) {
    try {
      const x = new URL(u);
      if (/\/publish\/?$/.test(x.pathname)) x.pathname = x.pathname.replace(/\/publish\/?$/, '/health');
      else if (x.pathname === '' || x.pathname === '/') x.pathname = '/health';
      else x.pathname = x.pathname.replace(/\/?$/, '/health');
      return x.toString();
    } catch (e) { return u; }
  }

  async function bridgeTest() {
    const u = bridgeUrl();
    const out = $('#brTestOut');
    if (!u) { toast('브릿지 URL을 먼저 저장해 주세요.', true); return; }
    if (out) out.textContent = '확인 중…';
    try {
      const res = await fetch(healthUrl(u), { method: 'GET', cache: 'no-store' });
      const raw = await res.text();
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {}
      if (!res.ok) throw new Error('브릿지 응답 오류(' + res.status + ')');
      const line = '연결됨 · ' + (j.service || 'bridge') + ' v' + (j.version || '?') + (j.blogger ? ' · Blogger 준비됨' : ' · Blogger 미설정');
      if (out) out.textContent = line;
      toast('로컬 브릿지 연결됨');
    } catch (e) {
      const msg = '브릿지에 연결하지 못했습니다. PC에서 field_studio_bridge_sample.py 가 켜져 있는지, 주소·포트(8787)가 맞는지 확인해 주세요.';
      if (out) out.textContent = msg;
      toast(msg, true);
    }
  }

  async function bridgeSend() {
    const r = S.result;
    if (!r) return;
    const u = bridgeUrl();
    const out = $('#bridgeOut');
    if (!u) { toast('설정(⚙)에서 브릿지 URL을 넣어 주세요.', true); return; }
    const p = buildPack(r);
    if (out) out.textContent = '전송 중… (사진 ' + p.photos.length + '장 포함)';
    $('#bridgeSend').disabled = true;
    try {
      const res = await fetch(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      const raw = await res.text();
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {}
      if (!res.ok) throw new Error('브릿지 응답 오류(' + res.status + '): ' + String(raw).slice(0, 120));
      const rid = pubId(r);
      onChannels(rid).forEach((id) => {
        const st = chState(rid, id);
        if (st.status === '대기') setPub(rid, id, { status: '발행요청' });
      });
      renderChannels();
      paintP2();
      paintPublishLog();
      const saved = j.savedPath || j.saved || '';
      if (out) out.innerHTML = '전송 완료 · ' + (saved ? '<b>' + esc(saved) + '</b>' : 'PC가 받았습니다') + (j.blogger && j.blogger.url ? '<br>' + esc(j.blogger.url) : '');
      toast('로컬 PC 브릿지로 보냈습니다');
    } catch (e) {
      const msg = e && e.name === 'TypeError'
        ? '브릿지에 닿지 않았습니다. PC와 같은 와이파이인지, 주소가 127.0.0.1이 아니라 PC의 LAN IP인지 확인해 주세요.'
        : (e && e.message) || '전송에 실패했습니다.';
      if (out) out.textContent = msg;
      toast(msg, true);
    } finally {
      $('#bridgeSend').disabled = false;
    }
  }

  /* ── (E) 원클릭 바로발행 큐 (비공개 GitHub 저장소) ──
     사진 → pack.json → ready.json 순서로 올린다. 감시 스크립트는 ready.json 이 있는 건만 집는다.
     pack.json 에는 사진 base64 를 넣지 않고 경로만 참조한다(중복 용량 방지). */
  const GH_API = 'https://api.github.com';
  const GH_DEFAULT = 'lvybb1102-lgtm/ink1-publish-queue';

  function ghCfg() {
    const raw = (store.get(LS.ghRepo) || '').trim();
    const repo = raw || GH_DEFAULT;
    const m = repo.match(/^(?:https?:\/\/github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
    return {
      raw: raw, repo: m ? m[1] + '/' + m[2] : repo,
      owner: m ? m[1] : '', name: m ? m[2] : '',
      token: (store.get(LS.ghToken) || '').trim()
    };
  }

  function ghReady(c) { return !!(c.owner && c.name && c.token); }

  function ghHeaders(c) {
    const h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (c.token) h.Authorization = 'Bearer ' + c.token;
    return h;
  }

  function ghPath(p) {
    return String(p || '').split('/').map((s) => encodeURIComponent(s)).join('/');
  }

  function ghContents(c, path) {
    return GH_API + '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.name) + '/contents/' + ghPath(path);
  }

  function ghErr(status, j) {
    const msg = (j && j.message) || '';
    if (status === 401) return '토큰이 올바르지 않거나 만료됐습니다 · 새 토큰을 발급해 다시 넣어 주세요.';
    if (status === 403 && /rate limit/i.test(msg)) return 'GitHub 호출 한도를 넘었습니다 · 잠시 뒤 다시 시도해 주세요.';
    if (status === 403) return '권한이 없습니다 · 토큰에 그 저장소의 Contents: Read and write 권한을 주세요.';
    if (status === 404) return '저장소를 찾을 수 없습니다 · 이름(owner/repo)과 토큰에 그 저장소가 선택됐는지 확인해 주세요.';
    if (status === 409 || status === 422) return '같은 경로에 파일이 이미 있습니다 · 다시 눌러 주세요(자동으로 덮어씁니다).';
    return 'GitHub 응답 오류(' + status + ')' + (msg ? ': ' + msg : '');
  }

  async function ghGet(c, path) {
    const res = await fetch(ghContents(c, path), { headers: ghHeaders(c), cache: 'no-store' });
    const raw = await res.text();
    let j = {};
    try { j = JSON.parse(raw); } catch (e) {}
    return { ok: res.ok, status: res.status, json: j };
  }

  function u8ToB64(u8) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function strToU8(s) { return new TextEncoder().encode(String(s)); }

  async function ghPut(c, path, bytes, message) {
    const url = ghContents(c, path);
    const body = { message: message, content: u8ToB64(bytes) };
    const send = () => fetch(url, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(c)),
      body: JSON.stringify(body)
    });
    let res = await send();
    if (res.status === 409 || res.status === 422) {          // 이미 있는 파일 → sha 붙여 덮어쓰기
      const cur = await ghGet(c, path);
      if (cur.ok && cur.json && cur.json.sha) { body.sha = cur.json.sha; res = await send(); }
    }
    const raw = await res.text();
    let j = {};
    try { j = JSON.parse(raw); } catch (e) {}
    if (!res.ok) throw new Error(ghErr(res.status, j));
    return j;
  }

  /* 파일명은 경로에 안전하게: 원래 이름 살리고 확장자만 검사 */
  function safeFileName(name, i) {
    let n = String(name || '').replace(/^.*[\\/]/, '');
    const m = n.match(/\.([A-Za-z0-9]{2,5})$/);
    const ext0 = (m ? m[1] : 'jpg').toLowerCase();
    const ext = /^(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/.test(ext0) ? ext0 : 'jpg';
    let base = n.replace(/\.[^.]+$/, '').replace(/[^0-9A-Za-z가-힣_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    if (!base) base = 'photo' + i;
    return base + '.' + (ext === 'jpeg' ? 'jpg' : ext);
  }

  /* 요청 ID — 같은 초에 두 번 보내도 겹치지 않게 */
  function newRid() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 6);
    return 'ink1_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '_' + rnd;
  }

  async function uniqueRid(c) {
    const base = newRid();
    for (let k = 1; k <= 4; k++) {
      const rid = k === 1 ? base : base + '-' + k;
      const hit = await ghGet(c, 'queue/' + rid);      // 폴더 목록 200 = 이미 있음 · 404 = 비어 있음
      if (!hit.ok) return rid;
    }
    return base + '-' + Math.random().toString(36).slice(2, 6);
  }

  function ghProg(text, pct, isErr) {
    const w = $('#ghProgWrap'), t = $('#ghProg'), b = $('#ghBar');
    if (!w) return;
    w.classList.toggle('hidden', !text);
    if (t) { t.textContent = text || ''; t.style.color = isErr ? '#a4232b' : ''; }
    if (b) b.style.width = (pct == null ? 0 : Math.max(2, Math.min(100, pct))) + '%';
  }

  function ghBadge(text, kind) {
    const b = $('#ghBadge');
    if (!b) return;
    b.textContent = text;
    b.className = 'badge' + (kind === 'ok' ? '' : kind === 'warn' ? ' warn' : ' off');
  }

  /* 연결 테스트 — GET /repos/{owner}/{repo} → private 여부 · permissions.push */
  async function ghTest() {
    const c = ghCfg();
    const out = $('#ghTestOut');
    if (!c.owner) { toast('저장소를 owner/repo 형식으로 넣어 주세요.', true); if (out) out.textContent = '저장소 주소 형식이 아닙니다 · 예) lvybb1102-lgtm/ink1-publish-queue'; return; }
    if (out) out.textContent = '확인 중…';
    try {
      const res = await fetch(GH_API + '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.name),
        { headers: ghHeaders(c), cache: 'no-store' });
      const raw = await res.text();
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {}
      if (!res.ok) throw new Error(ghErr(res.status, j));
      const priv = !!j.private;
      const push = !!(j.permissions && j.permissions.push);
      const line = '연결됨 · ' + esc(j.full_name || c.repo) + ' · ' +
        (priv ? '<b>비공개</b>' : '<b>공개</b>') + ' · ' +
        (c.token ? (push ? '<b>쓰기 가능</b>' : '<b>읽기만 가능</b>') : '토큰 없음(읽기 확인만)');
      if (out) out.innerHTML = line + '<br>' + (push ? '사진과 원고를 올릴 수 있습니다.' : '토큰에 <b>Contents: Read and write</b> 권한을 주면 바로 올릴 수 있습니다.');
      ghBadge(push ? '연결됨' : (c.token ? '읽기만' : '토큰 필요'), push ? 'ok' : 'warn');
      toast(push ? '저장소 연결됨 · 바로 발행할 수 있습니다' : '저장소는 열리지만 쓰기 권한이 없습니다', !push);
    } catch (e) {
      const msg = (e && e.name === 'TypeError')
        ? 'GitHub에 닿지 않았습니다 · 인터넷 연결을 확인해 주세요.'
        : ((e && e.message) || '연결 테스트에 실패했습니다.');
      if (out) out.textContent = msg;
      ghBadge('미연결', 'warn');
      toast(msg, true);
    }
  }

  /* 원클릭 바로발행 전송 — 사진 → pack.json → ready.json */
  async function ghQueue() {
    const r = S.result;
    if (!r) return;
    const c = ghCfg();
    const out = $('#ghOut');
    const btn = $('#ghSend');
    if (!c.owner) {
      const m = '저장소 주소를 확인해 주세요 · 설정(⚙)에서 owner/repo 형식으로 넣습니다.';
      if (out) out.textContent = m; toast(m, true);
      return;
    }
    if (!c.token) {
      const m = 'GitHub 토큰(PAT)이 없습니다 · 설정(⚙) → ⚡ 원클릭 바로발행 큐에서 저장해 주세요.';
      if (out) out.textContent = m; toast('토큰을 먼저 저장해 주세요 · 설정(⚙)', true);
      return;
    }
    const ridP = pubId(r);
    const already = chState(ridP, 'gh');
    if (already && already.url && !confirm('이 원고는 이미 큐에 보낸 기록이 있습니다.\n한 번 더 보내면 니케가 같은 글을 두 번 발행할 수 있습니다.\n그래도 보낼까요?')) return;

    if (btn) btn.disabled = true;
    if (out) out.innerHTML = '';
    const title = r.titles[S.selTitle] || r.titles[0] || '';
    const b = BRANDS[r.brand] || BRANDS.ink1;
    const photos = S.photos.slice();
    const total = photos.length;
    try {
      ghProg('저장소 확인 중…', 2);
      const rid = await uniqueRid(c);
      const refs = [];

      // 1) 사진 먼저 (idx_원래이름.jpg) — 가리기 반영된 1280px JPEG
      for (let i = 0; i < total; i++) {
        const p = photos[i];
        const fname = String(i + 1).padStart(2, '0') + '_' + safeFileName(p.name, i + 1);
        const path = 'queue/' + rid + '/photos/' + fname;
        const bytes = dataUrlToU8(p.disp);
        ghProg('사진 ' + (i + 1) + '/' + total + ' 올리는 중…', 4 + Math.round((i / Math.max(1, total)) * 74));
        await ghPut(c, path, bytes, 'ink1 queue ' + rid + ' · 사진 ' + (i + 1) + '/' + total);
        refs.push({
          index: i + 1, name: fname, original: p.name || '', path: path,
          bytes: bytes.length, takenAt: p.dateText || '', edited: !!p.edited,
          width: p.w || null, height: p.h || null
        });
      }

      // 2) 원고·채널·설정 메타데이터 (사진은 경로만 참조)
      ghProg('원고 올리는 중…', 82);
      const pack = buildPack(r);
      pack.appResultId = pack.requestId;      // 앱 기록 ID(로컬 발행 로그 키)는 따로 보존
      pack.requestId = rid;                    // 큐의 요청 ID = 경로 queue/{request_id}/
      pack.photos = refs.map((x) => ({
        index: x.index, name: x.name, original: x.original, path: x.path,
        takenAt: x.takenAt, edited: x.edited, bytes: x.bytes, width: x.width, height: x.height
      }));
      pack.photosNote = '사진 원본은 이 저장소의 photos[].path 에 있습니다(pack.json 안에는 base64를 넣지 않습니다).';
      pack.queue = {
        request_id: rid, repo: c.repo, base_path: 'queue/' + rid + '/',
        photos_dir: 'queue/' + rid + '/photos/', pack_path: 'queue/' + rid + '/pack.json',
        ready_path: 'queue/' + rid + '/ready.json',
        order: 'photos → pack.json → ready.json (ready.json 이 마지막 완료 표시)',
        watcher: '니케가 주기적으로 ready.json(status=pending)을 찾아 5채널 발행' 
      };
      await ghPut(c, 'queue/' + rid + '/pack.json', strToU8(JSON.stringify(pack, null, 1)),
        'ink1 queue ' + rid + ' · pack.json (원고 ' + (pack.modeLabel || '') + ')' );

      // 3) 완료 마커 — 이것이 올라간 뒤에만 감시 스크립트가 집는다
      ghProg('완료 표시 올리는 중…', 94);
      const ready = {
        request_id: rid,
        title: title,
        brand: b.id,
        channels: onChannels(ridP),
        photo_count: refs.length,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
      const readyRes = await ghPut(c, 'queue/' + rid + '/ready.json', strToU8(JSON.stringify(ready, null, 1)),
        'ink1 queue ' + rid + ' · ready.json (발행 대기)');
      const htmlUrl = (readyRes && readyRes.content && readyRes.content.html_url) || ('https://github.com/' + c.repo + '/blob/HEAD/queue/' + rid + '/ready.json');

      // 채널 상태 대기 → 발행요청 · 발행 로그
      onChannels(ridP).forEach((id) => { if (chState(ridP, id).status === '대기') setPub(ridP, id, { status: '발행요청' }); });
      setPub(ridP, 'gh', { status: '발행요청', url: htmlUrl });
      renderChannels(); paintP2(); paintPublishLog();

      ghProg('완료! 5분 안에 니케가 자동 발행합니다', 100);
      if (out) out.innerHTML = '전송 완료 · <b>' + esc(rid) + '</b> · 사진 ' + refs.length + '장 + 원고<br>' +
        '<a href="' + esc(htmlUrl) + '" target="_blank" rel="noopener noreferrer">GitHub에서 확인</a> · ' +
        '5분 안에 니케가 ' + onChannels(ridP).length + '채널 발행을 시작합니다.';
      toast('니케에게 보냈습니다 · 5분 안에 자동 발행');
    } catch (e) {
      const msg = (e && e.name === 'TypeError')
        ? 'GitHub에 닿지 않았습니다 · 인터넷 연결을 확인한 뒤 다시 눌러 주세요.'
        : ((e && e.message) || '전송에 실패했습니다.');
      ghProg('전송 실패 · 다시 시도해 주세요', 0, true);
      if (out) out.textContent = msg;
      toast(msg, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ───────────────────────── 홈 ───────────────────────── */
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  function pubBadge(h) {
    const e = h && h.id ? S.pub[h.id] : null;
    if (!e || !e.ch) return '';
    let done = 0, mov = 0;
    CHANNELS.forEach((c) => {
      const st = e.ch[c.id];
      if (!st) return;
      if (st.status === '발행완료') done++;
      if (st.status !== '대기') mov++;
    });
    if (!mov) return '';
    return ' · 발행 ' + done + '/' + mov;
  }

  function paintHome() {
    const today = dayKey(new Date());
    const now = new Date();
    const nToday = S.history.filter((h) => dayKey(new Date(h.at)) === today).length;
    const nMonth = S.history.filter((h) => {
      const d = new Date(h.at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    $('#kToday').textContent = nToday;
    $('#kMonth').textContent = nMonth;
    $('#kKey').textContent = apiKey() ? '연결' : '없음';
    $('#kKey').style.color = apiKey() ? '#0f7a5a' : '#a4232b';

    const list = $('#histList');
    $('#histCount').textContent = S.history.length ? S.history.length + '건' : '';
    if (!S.history.length) {
      list.innerHTML = '<div class="empty">아직 만든 원고가 없습니다.<br>첫 현장을 넣어 보세요.</div>';
      return;
    }
    list.innerHTML = '';
    S.history.slice(0, 10).forEach((h) => {
      const d = document.createElement('button');
      d.className = 'hitem';
      d.style.width = '100%';
      d.style.textAlign = 'left';
      const dt = new Date(h.at);
      const stamp = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      d.innerHTML = (h.thumb ? '<img alt="" src="' + h.thumb + '">'
          : '<div class="noimg">' + (h.mode && h.mode !== 'field' ? '📝' : '📷') + '</div>') +
        '<div class="t"><b>' + esc(h.titles[0] || '(제목 없음)') + '</b>' +
        '<span>' + stamp + ' · ' + esc(BRANDS[h.brand] ? BRANDS[h.brand].name : h.brand) + ' · ' +
        esc(h.mode === 'topic' ? '정보성·지정' : h.mode === 'random' ? '정보성·랜덤' : h.type) + esc(pubBadge(h)) + '</span></div>' +
        '<span class="badge">열기</span>';
      d.addEventListener('click', () => {
        S.result = h;
        S.selTitle = 0;
        renderResult();
        go('result');
      });
      list.appendChild(d);
    });
  }

  /* ───────────────────────── 설정 ───────────────────────── */
  function paintSettings() {
    const k = apiKey();
    $('#gemKey').value = k;
    $('#keyState').textContent = k ? '저장됨' : '없음';
    $('#keyState').className = 'badge' + (k ? '' : ' warn');
    const oa = (store.get(LS.oa) || '').trim();
    $('#oaKey').value = oa;
    $('#modelSel').value = S.cfg.model || 'auto';
    $('#histN').textContent = S.history.length + '건';
    let bytes = 0;
    try {
      Object.keys(localStorage).forEach((kk) => { bytes += (localStorage.getItem(kk) || '').length; });
    } catch (e) {}
    $('#lsUse').textContent = (bytes / 1024).toFixed(0) + 'KB / 약 5MB';

    // P2: Blogger·브릿지 설정
    $('#bgBlog').value = (store.get(LS.bgBlog) || '').trim();
    $('#bgToken').value = (store.get(LS.bgToken) || '').trim();
    const bc = bloggerCfg();
    const bgb = $('#bgBadge');
    bgb.textContent = bc.token && bc.blog ? '연결 설정됨' : (bc.token || bc.blog ? '일부 설정' : '미설정');
    bgb.className = 'badge' + (bc.token && bc.blog ? '' : ' off');
    $('#brUrl').value = bridgeUrl();
    const brb = $('#brBadge');
    brb.textContent = bridgeUrl() ? '설정됨' : '미설정';
    brb.className = 'badge' + (bridgeUrl() ? '' : ' off');

    // 원클릭 바로발행 큐 (GitHub)
    const gc = ghCfg();
    $('#ghRepo').value = gc.raw;
    $('#ghToken').value = gc.token;
    ghBadge(ghReady(gc) ? '설정됨' : (gc.raw || gc.token ? '일부 설정' : '미설정'), ghReady(gc) ? 'ok' : 'off');
    const gto = $('#ghTestOut');
    if (gto && !gto.textContent) gto.textContent = ghReady(gc) ? '저장됨 · [연결 테스트]로 저장소 접근과 쓰기 권한을 확인하세요.' : '저장소와 토큰을 넣고 [연결 테스트]를 누르면 바로 확인합니다.';
    paintPublishLog();
  }

  async function testKey() {
    const k = apiKey();
    if (!k) { toast('키를 먼저 저장해 주세요.', true); return; }
    toast('확인 중…');
    try {
      // 키는 쿼리로 넘긴다(브라우저 CORS 단순 요청 유지)
      const r2 = await fetch(API + '?pageSize=200&key=' + encodeURIComponent(k));
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        throw new Error(friendly(r2.status, (j.error && j.error.message) || ''));
      }
      const j = await r2.json();
      const names = (j.models || []).map((m) => m.name.replace('models/', '')).filter((n) => /gemini.*flash/.test(n) && !/image|tts|live/.test(n));
      toast('연결됨 · 사용 가능한 모델 ' + names.length + '개');
      $('#modelInfo').textContent = '사용 가능: ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' …' : '');
    } catch (e) {
      toast((e && e.message) || '연결에 실패했습니다.', true);
    }
  }

  /* ───────────────────────── 이벤트 ───────────────────────── */
  function bind() {
    $$('#tabs .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.v)));
    $('#goWrite').addEventListener('click', () => go('write'));
    $$('#modeTabs .modecard').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
    $('#topicInput').addEventListener('input', (e) => {
      S.topic = e.target.value;
      $$('#topicChips .chip').forEach((x) => x.classList.toggle('on', x.textContent === S.topic.trim()));
    });
    $('#rollBtn').addEventListener('click', () => {
      const t = rollTopic();
      toast('주제를 뽑았습니다: ' + (t.length > 22 ? t.slice(0, 22) + '…' : t));
    });
    $('#clearPick').addEventListener('click', () => {
      S.pick = '';
      paintPick();
      toast('주제를 비웠습니다 · AI가 최근 글을 피해 새로 고릅니다');
    });
    [['#pickGallery', '#fileInput'], ['#pickFiles', '#fileInputAll'], ['#pickCamera', '#cameraInput']].forEach((pair) => {
      $(pair[0]).addEventListener('click', () => $(pair[1]).click());
      $(pair[1]).addEventListener('change', async (e) => {
        await addPhotos(e.target.files);
        e.target.value = '';
      });
    });
    $('#thumbs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (b) {
        if (b.dataset.act === 'mosaic') openMosaic(b.dataset.id);
        if (b.dataset.act === 'del') {
          S.photos = S.photos.filter((p) => p.id !== b.dataset.id);
          paintThumbs();
        }
        return;
      }
      const t = e.target.closest('.thumb');
      if (t) {
        const img = t.querySelector('img');
        const p = S.photos.find((x) => x.disp === (img && img.getAttribute('src')));
        if (p) openMosaic(p.id);
      }
    });
    $('#memo').addEventListener('input', (e) => { S.memo = e.target.value; });

    paintCats();

    $('#brandBtn').addEventListener('click', () => {
      const opts = Object.keys(BRANDS).map((k) => BRANDS[k]);
      openChooser('브랜드 프리셋', opts.map((b) => ({ key: b.id, label: b.name, sub: b.line })), (id) => {
        S.brand = id;
        paintBrand();
        toast(BRANDS[id].name + ' 프리셋으로 바꿨습니다');
      });
    });

    $('#makeBtn').addEventListener('click', generate);
    $('#genCancel').addEventListener('click', () => {});
    $('#seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      S.pane = b.dataset.p;
      renderResult();
    });

    $('#copyHtml').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyRich(r.blogHtml, r.blogText);
      toast(ok ? '서식 HTML을 복사했습니다 · 네이버에 붙여넣기' : '복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.', !ok);
    });
    $('#copyText').addEventListener('click', async () => {
      if (!S.result) return;
      const ok = await copyText(S.result.blogText);
      toast(ok ? '본문 텍스트를 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyTitle').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyText(r.titles[S.selTitle] || r.titles[0] || '');
      toast(ok ? '제목을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyThreads').addEventListener('click', async () => {
      if (!S.result) return;
      const ok = await copyText(S.result.threads || '');
      toast(ok ? '스레드 글을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyThreadsShort').addEventListener('click', async () => {
      const t = (S.result && S.result.threads) || '';
      const lines = t.split('\n').filter(Boolean);
      const short = lines.slice(0, 3).join('\n').slice(0, 260);
      const ok = await copyText(short);
      toast(ok ? '짧은 버전(260자)을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyShorts').addEventListener('click', async () => {
      const rows = (S.result && S.result.shorts) || [];
      const t = rows.map((s) => s.time + ' | ' + s.screen + (s.voice ? ' | ' + s.voice : '')).join('\n');
      const ok = await copyText(t);
      toast(ok ? '쇼츠 대본을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyInsta').addEventListener('click', async () => {
      const ok = await copyText((S.result && S.result.insta) || '');
      toast(ok ? '인스타 캡션을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyYt').addEventListener('click', async () => {
      const r = S.result;
      if (!r) return;
      const ok = await copyText((r.ytTitle || '') + '\n\n' + (r.ytDesc || ''));
      toast(ok ? '유튜브 제목·설명을 복사했습니다' : '복사 실패', !ok);
    });
    $('#copyTags').addEventListener('click', async () => {
      const ok = await copyText(((S.result && S.result.tags) || []).join(' '));
      toast(ok ? '해시태그를 복사했습니다' : '복사 실패', !ok);
    });

    $('#zipBtn').addEventListener('click', () => {
      if (!S.result) return;
      const files = buildPackage(S.result);
      downloadBlob(makeZip(files), zipName(S.result) + '.zip');
      toast('ZIP으로 저장했습니다 · 사진 ' + S.photos.length + '장 + 원고');
    });
    $('#htmlBtn').addEventListener('click', () => {
      const r = S.result;
      if (!r) return;
      const title = r.titles[S.selTitle] || r.titles[0] || '';
      const html = '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title>\n<h1>' + esc(title) + '</h1>\n' + r.blogHtml;
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), zipName(r) + '_원고.html');
      toast('원고 HTML을 저장했습니다');
    });
    $('#naverSafeBtn').addEventListener('click', naverSafe);
    $('#bgSend').addEventListener('click', bloggerSend);
    $('#bgDraft').addEventListener('change', () => paintP2());
    $('#packCopy').addEventListener('click', copyPack);
    $('#packJson').addEventListener('click', downloadPack);
    $('#bridgeSend').addEventListener('click', bridgeSend);
    $('#goHist').addEventListener('click', () => go('home'));
    $('#discardBtn').addEventListener('click', () => {
      S.result = null;
      renderResult();
      go('write');
    });

    $('#bgSave').addEventListener('click', () => {
      const b = $('#bgBlog').value.trim();
      const t = $('#bgToken').value.trim();
      if (b) store.set(LS.bgBlog, b); else store.del(LS.bgBlog);
      if (t) store.set(LS.bgToken, t); else store.del(LS.bgToken);
      paintSettings();
      paintP2();
      toast(t ? 'Blogger 설정을 저장했습니다' : 'Blogger 토큰을 지웠습니다');
    });
    $('#bgTest').addEventListener('click', bloggerTest);
    $('#brSave').addEventListener('click', () => {
      const u = $('#brUrl').value.trim();
      if (u) store.set(LS.bridge, u); else store.del(LS.bridge);
      paintSettings();
      paintP2();
      toast(u ? '브릿지 URL을 저장했습니다' : '브릿지 URL을 지웠습니다');
    });
    $('#brTest').addEventListener('click', bridgeTest);
    $('#ghSave').addEventListener('click', () => {
      const repo = $('#ghRepo').value.trim();
      const token = $('#ghToken').value.trim();
      if (repo) store.set(LS.ghRepo, repo); else store.del(LS.ghRepo);
      if (token) store.set(LS.ghToken, token); else store.del(LS.ghToken);
      const out = $('#ghTestOut');
      if (out) out.textContent = '';
      paintSettings();
      paintP2();
      toast(token || repo ? '바로발행 큐 설정을 저장했습니다' : '바로발행 큐 설정을 지웠습니다');
    });
    $('#ghTest').addEventListener('click', ghTest);
    $('#ghSend').addEventListener('click', ghQueue);
    $('#pubLogExport').addEventListener('click', () => {
      const data = { app: 'ink1-field-studio', kind: 'publish-log', at: new Date().toISOString(), publish: S.pub };
      downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), '잉크원_st_AI_발행로그.json');
      toast('발행 로그를 JSON으로 저장했습니다');
    });
    $('#pubLogClear').addEventListener('click', () => {
      if (!confirm('발행 로그와 채널 상태를 모두 지울까요? (원고 기록은 남습니다)')) return;
      S.pub = {};
      store.del(LS.pub);
      paintPublishLog();
      if (S.result) { renderChannels(); paintP2(); }
      toast('발행 로그를 지웠습니다');
    });

    $('#saveKey').addEventListener('click', () => {
      const v = $('#gemKey').value.trim();
      if (v) store.set(LS.key, v); else store.del(LS.key);
      paintSettings(); paintHome();
      toast(v ? '키를 이 브라우저에 저장했습니다' : '키를 지웠습니다');
    });
    $('#testKey').addEventListener('click', testKey);
    $('#importKey').addEventListener('click', () => {
      const v = (store.get(LS.mars) || '').trim();
      if (!v) { toast('비서실에 저장된 키가 없습니다.', true); return; }
      store.set(LS.key, v);
      paintSettings(); paintHome();
      toast('비서실 키를 가져왔습니다');
    });
    $('#saveOa').addEventListener('click', () => {
      const v = $('#oaKey').value.trim();
      if (v) store.set(LS.oa, v); else store.del(LS.oa);
      toast(v ? 'OpenAI 키를 저장했습니다' : 'OpenAI 키를 지웠습니다');
    });
    $('#modelSel').addEventListener('change', (e) => {
      S.cfg.model = e.target.value;
      saveCfg();
      toast('모델: ' + (e.target.value === 'auto' ? '자동' : e.target.value));
    });
    $('#exportBtn').addEventListener('click', () => {
      const data = { app: 'ink1-field-studio', at: new Date().toISOString(), history: S.history };
      downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), '잉크원_st_AI_백업.json');
      toast('기록을 JSON으로 저장했습니다');
    });
    $('#clearHistBtn').addEventListener('click', () => {
      if (!confirm('저장된 원고 기록을 모두 지울까요? 되돌릴 수 없습니다.')) return;
      S.history = [];
      store.del(LS.hist);
      paintHome(); paintSettings();
      toast('기록을 지웠습니다');
    });
  }

  /* 선택 시트 */
  function openChooser(title, items, onPick) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet';
    wrap.innerHTML = '<div class="inner"><div class="hd"><b>' + esc(title) + '</b><button class="btn mini ghost">닫기</button></div><div class="stack" id="chList"></div></div>';
    document.body.appendChild(wrap);
    const list = wrap.querySelector('#chList');
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.style.margin = '0';
      b.style.textAlign = 'left';
      b.innerHTML = '<b style="font-size:14.5px">' + esc(it.label) + '</b><div class="muted" style="margin-top:4px">' + esc(it.sub || '') + '</div>';
      b.addEventListener('click', () => { wrap.remove(); onPick(it.key); });
      list.appendChild(b);
    });
    wrap.querySelector('button').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  }

  /* ───────────────────── 공유받기 (share_target → sw.js) ───────────────────── */
  async function takeShared() {
    const q = new URLSearchParams(location.search);
    const flag = q.has('share-target') || q.get('shared') === '1' || q.has('n');
    if (!flag) return false;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    const base = new URL('./__share__/', location.href).href;
    let meta = null;
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
        const r = await fetch(base + 'meta', { cache: 'no-store' });
        if (r.ok) meta = await r.json();
      } catch (e) {}
    }
    if (!meta || !meta.count) {
      const t = String(q.get('text') || '').trim();
      if (t) {
        S.memo = t.slice(0, 300);
        $('#memo').value = S.memo;
        setMode('field');
        go('write');
        toast('공유받은 글을 메모에 넣었습니다');
        return true;
      }
      toast('공유받은 사진을 찾지 못했습니다. 앱을 한 번 새로 고친 뒤 갤러리에서 다시 공유해 주세요.', true);
      return false;
    }
    const files = [];
    for (let i = 0; i < meta.count; i++) {
      try {
        const r = await fetch(base + 'f' + i, { cache: 'no-store' });
        if (!r.ok) continue;
        const blob = await r.blob();
        let name = '';
        try { name = decodeURIComponent(r.headers.get('x-ink1-name') || ''); } catch (e) {}
        files.push(new File([blob], name || ('공유사진_' + (i + 1) + '.jpg'), { type: blob.type || 'image/jpeg' }));
      } catch (e) {}
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) reg.active.postMessage({ type: 'ink1-share-clear' });
    } catch (e) {}
    setMode('field');
    go('write');
    if (meta.text && !S.memo.trim()) {
      S.memo = String(meta.text).slice(0, 300);
      $('#memo').value = S.memo;
    }
    if (!files.length) {
      toast('공유받은 사진을 읽지 못했습니다. [사진·앨범]으로 다시 골라 주세요.', true);
      return true;
    }
    await addPhotos(files);
    toast('공유받은 사진 ' + files.length + '장 · 확인하고 [만들기]를 누르세요');
    return true;
  }

  /* ───────────────────────── 시작 ───────────────────────── */
  function init() {
    loadCfg();
    loadHistory();
    loadPublish();
    bindCanvas();
    bind();
    paintBrand();
    setMode(S.mode);
    paintThumbs();
    paintHome();
    paintSettings();
    if (!apiKey()) {
      const mars = (store.get(LS.mars) || '').trim();
      if (mars) { $('#homeHint').innerHTML = '마르스 비서실 키를 찾았습니다. <b>설정 → 비서실 키 가져오기</b>를 누르면 바로 쓸 수 있습니다.'; }
      else $('#homeHint').textContent = '설정에서 Google AI Studio 키를 넣으면 바로 동작합니다.';
    }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) {
      navigator.serviceWorker.register('./sw.js').catch(() => {}).finally(() => { takeShared(); });
    } else {
      takeShared();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
