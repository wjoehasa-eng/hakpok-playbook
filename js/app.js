/* 2026 학교폭력 실전 플레이북 — app.js
 * 데이터: data/official_2026.json (교육부 2026 가이드북 색인), data/cases_public.json (검증 사례)
 * 개인정보·학교명·실제 사안 정보는 넣지 않는다.
 */
(function () {
  'use strict';

  var TREE = window.HAKPOK_TREE;
  var DATA = { official: null, cases: null };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { n.dataset[d] = attrs[k][d]; });
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === null || attrs[k] === false) return;
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------- 날짜 ---------- */
  function parseISO(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function iso(d) {
    var m = String(d.getMonth() + 1); var dd = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (dd.length < 2 ? '0' + dd : dd);
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d.getTime()); x.setMonth(x.getMonth() + n); return x; }
  function fmt(d) { return iso(d) + '(' + WD[d.getDay()] + ')'; }
  function daysFromToday(d) {
    var t = new Date(); var a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((d.getTime() - a.getTime()) / 86400000);
  }
  function rel(d) {
    var n = daysFromToday(d);
    if (n === 0) return '오늘';
    return n > 0 ? n + '일 남음' : Math.abs(n) + '일 지남';
  }

  /* ---------- 탭 ---------- */
  var VIEWS = ['nav', 'calc', 'risk', 'py', 'search'];
  var currentView = 'nav';
  function showView(name) {
    currentView = name;
    VIEWS.forEach(function (v) {
      var sec = $('#view-' + v); var tab = $('#tab-' + v);
      var on = v === name;
      if (sec) sec.hidden = !on;
      if (tab) { tab.classList.toggle('is-on', on); tab.setAttribute('aria-selected', on ? 'true' : 'false'); }
    });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
    document.title = ({ nav: '분기 트리', calc: '기한·생기부 계산기', risk: '지뢰·예외', py: '진행 체크', search: '검색·양식' }[name] || '') + ' · 2026 학교폭력 플레이북';
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { showView(t.dataset.view); }); });

  /* 섹션 내부 세그먼트 탭 */
  $$('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var wrap = b.parentNode;
      $$('.seg-btn', wrap).forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      var panes = [];
      $$('.seg-btn', wrap).forEach(function (x) { panes.push($('#' + x.dataset.pane)); });
      panes.forEach(function (p) { if (p) p.hidden = true; });
      var target = $('#' + b.dataset.pane); if (target) target.hidden = false;
    });
  });

  /* ---------- 분기 트리 ---------- */
  var treeState = { path: [], gate: {} };

  function renderTree() {
    if (!treeState.path.length) treeState.path = [TREE.start];
    var id = treeState.path[treeState.path.length - 1];
    var node = TREE.nodes[id];
    if (!node) { treeState.path = [TREE.start]; node = TREE.nodes[TREE.start]; }

    var crumb = $('#treePath'); crumb.innerHTML = '';
    treeState.path.forEach(function (nid, i) {
      var n = TREE.nodes[nid]; if (!n) return;
      var li = el('li', { class: i === treeState.path.length - 1 ? 'on' : '' }, [
        el('button', {
          class: 'crumb-btn', type: 'button', text: n.title,
          onclick: function () { treeState.path = treeState.path.slice(0, i + 1); renderTree(); }
        })
      ]);
      crumb.appendChild(li);
    });

    var host = $('#treeNode'); host.innerHTML = '';
    host.dataset.node = id;
    var head = el('div', { class: 'node-top' }, [
      el('div', { class: 'node-badge', text: node.badge || '·' }),
      el('div', { class: 'node-titles' }, [
        el('h3', { text: node.title }),
        el('p', { class: 'node-summary', text: node.summary || '' }),
        el('div', { class: 'pages' }, (node.pages || []).map(function (p) {
          return el('span', { class: 'page-badge', text: 'p.' + p });
        }))
      ])
    ]);
    host.appendChild(head);

    if (node.sections && node.sections.length) {
      var wrap = el('div', { class: 'sections' });
      node.sections.forEach(function (s) {
        if (!s.items || !s.items.length) return;
        var icons = { todo: '☑️', info: 'ℹ️', warn: '⚠️', tip: '💡', law: '⚖️', step: '➡️', score: '📊' };
        var box = el('section', { class: 'sec ' + (s.kind || 'info') }, [
          el('h4', {}, [el('span', { class: 'k', text: icons[s.kind] || '•' }), document.createTextNode(s.title || '')]),
          el('ul', {}, s.items.map(function (t) { return el('li', { text: t }); }))
        ]);
        wrap.appendChild(box);
      });
      host.appendChild(wrap);
    }

    var formBox = formChips(id);
    if (formBox) host.appendChild(formBox);

    if (node.gate) host.appendChild(renderGate(node, id));

    if (node.options && node.options.length) {
      var opts = el('div', { class: 'options' });
      node.options.forEach(function (o) {
        opts.appendChild(el('button', {
          class: 'opt ' + (o.kind || ''), type: 'button',
          onclick: function () { go(o.next); }
        }, [document.createTextNode(o.label), el('span', { class: 'arrow', text: '›' })]));
      });
      host.appendChild(opts);
    }

    $('#treeCount').textContent = '단계 ' + treeState.path.length;
    $('#treeBack').disabled = treeState.path.length < 2;
  }

  function renderGate(node, id) {
    var g = node.gate;
    var checked = treeState.gate[id] || (treeState.gate[id] = []);
    var box = el('div', { class: 'gate' });
    box.appendChild(el('h4', { text: g.title }));
    if (g.hint) box.appendChild(el('p', { class: 'gate-hint', text: g.hint }));
    var list = el('div', { class: 'gate-list' });
    g.items.forEach(function (item, i) {
      var on = checked.indexOf(i) >= 0;
      var lab = el('label', { class: 'gate-item' + (on ? ' is-on' : '') }, [
        el('input', { type: 'checkbox', checked: on ? 'checked' : null }),
        el('span', { text: item })
      ]);
      lab.querySelector('input').addEventListener('change', function (e) {
        var idx = checked.indexOf(i);
        if (e.target.checked && idx < 0) checked.push(i);
        if (!e.target.checked && idx >= 0) checked.splice(idx, 1);
        renderTree();
      });
      list.appendChild(lab);
    });
    box.appendChild(list);

    var pass = g.mode === 'all' ? checked.length === g.items.length : checked.length > 0;
    box.appendChild(el('p', { class: 'gate-verdict ' + (pass ? 'pass' : 'fail'), text: pass ? g.passText : g.failText }));
    var go2 = el('div', { class: 'gate-go' });
    var pick = pass ? g.pass : g.fail;
    go2.appendChild(el('button', {
      class: 'btn ' + (pass ? 'btn-primary' : ''), type: 'button', text: pick.label,
      onclick: function () { go(pick.next); }
    }));
    if (pass && g.fail) {
      go2.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', text: g.fail.label, onclick: function () { go(g.fail.next); } }));
    }
    box.appendChild(go2);
    return box;
  }

  /* ---------- 단계별 양식 칩 + 양식 시트 ---------- */
  var STAGE = window.HAKPOK_STAGE || { FORMS: {}, NODE_FORMS: {}, QUIZ: [], CHECK_STEPS: [] };

  function formChips(nodeId) {
    var codes = (STAGE.NODE_FORMS || {})[nodeId] || [];
    if (!codes.length) return null;
    var box = el('div', { class: 'node-forms' }, [el('span', { class: 'node-forms-label', text: '이 단계에서 쓸 양식' })]);
    var chips = el('div', { class: 'chips' });
    codes.forEach(function (code) {
      var f = (STAGE.FORMS || {})[code];
      chips.appendChild(el('button', {
        class: 'chip form-chip', type: 'button',
        text: f ? code + ' ' + f.name : code,
        onclick: function () { openSheet(code); }
      }));
    });
    box.appendChild(chips);
    return box;
  }

  function openSheet(code) {
    var f = (STAGE.FORMS || {})[code];
    if (!f) return;
    $('#sheetTitle').textContent = code + ' · ' + f.name;
    var body = $('#sheetBody');
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'sheet-meta' }, [el('span', { class: 'page-badge', text: f.page }), el('span', { class: 'tag form', text: code })]));
    [['작성 주체', f.who], ['사용·제출·보관', f.how], ['주의', f.warning]].forEach(function (row) {
      body.appendChild(el('div', { class: 'sheet-row ' + (row[0] === '주의' ? 'warn' : '') }, [
        el('span', { class: 'k', text: row[0] }),
        el('p', { class: 'v', text: row[1] })
      ]));
    });
    body.appendChild(el('p', { class: 'calc-note', text: '※ 양식 원본은 2026 가이드북 부록1(' + f.page + ')에 있습니다. 이 앱은 작성 내용을 저장하지 않습니다.' }));
    $('#sheetBackdrop').hidden = false;
    $('#sheet').hidden = false;
    $('#sheetClose').focus();
  }
  function closeSheet() {
    $('#sheetBackdrop').hidden = true;
    $('#sheet').hidden = true;
  }
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  function go(nextId) {
    if (!nextId || !TREE.nodes[nextId]) return;    treeState.path.push(nextId);
    renderTree();
    var top = $('#view-nav').getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  $('#treeHome').addEventListener('click', function () { treeState.path = [TREE.start]; treeState.gate = {}; renderTree(); });
  $('#treeBack').addEventListener('click', function () { if (treeState.path.length > 1) { treeState.path.pop(); renderTree(); } });
  $$('#treeShortcuts .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      treeState.path = [TREE.start, 'split', c.dataset.goto];
      // 특수 분기는 경로를 짧게: 시작 → 해당 노드
      treeState.path = [TREE.start, c.dataset.goto];
      renderTree();
      showView('nav');
    });
  });

  /* ---------- 데이터 ---------- */
  var DATA_ONELINE = {};
  function onelineOf(c) {
    return String(DATA_ONELINE[c.id] || c.oneline || '').trim() || '카드를 펼쳐 상황 · 검증 결론 · 실전 대응을 확인하세요.';
  }
  function loadData() {
    var badge = $('#dataBadge');
    return Promise.all([
      fetch('data/official_2026.json?v=4', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('official ' + r.status); return r.json(); }),
      fetch('data/cases_public.json?v=4', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('cases ' + r.status); return r.json(); })
    ]).then(function (res) {
      DATA.official = res[0]; DATA.cases = res[1];
      badge.textContent = '근거 쪽수 표시';
      badge.className = 'pill ok';
      buildSearchIndex(); renderRisk(); renderForms(); renderTOC(); renderDeadlineFull(); runSearch();
      return fetch('data/cases_oneline.json?v=4', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { DATA_ONELINE = (j && j.items) || {}; renderRisk(); })
        .catch(function () { /* 한 줄 요약은 없어도 동작한다 */ });
    }).catch(function (err) {
      badge.textContent = '데이터 로드 실패';
      badge.className = 'pill warn';
      ['#caseList', '#searchList'].forEach(function (s) {
        var h = $(s); if (h) h.innerHTML = '<p class="empty">데이터를 불러오지 못했습니다. 네트워크 확인 후 새로고침하거나, 한 번 열어둔 상태라면 오프라인 캐시로 다시 열립니다.</p>';
      });
      console.error(err);
    });
  }

  /* ---------- 기한 계산기 ---------- */
  var DL_FULL = [];
  function renderDeadlineFull() {
    var t = el('table');
    t.appendChild(el('thead', {}, [el('tr', {}, ['사건', '기한', '비고', '쪽'].map(function (h) { return el('th', { text: h }); }))]));
    var tb = el('tbody');
    (DATA.official.deadlines || []).forEach(function (d) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: d.event }),
        el('td', { text: d.limit }),
        el('td', { text: d.extra || '' }),
        el('td', { class: 'pg', text: String(d.page) })
      ]));
    });
    t.appendChild(tb);
    $('#deadlineFull').innerHTML = ''; $('#deadlineFull').appendChild(t);
  }

  function initCalc() {
    var today = new Date();
    $('#inDate').value = iso(today);
    $('#sepDate').value = iso(addDays(today, 1));
    $('#calcToday').textContent = '오늘(' + fmt(today) + ') 인지로';
    runCalc();

    var sel = $('#measureSel');
    var items = [
      { v: '1', label: '1호 서면사과' }, { v: '2', label: '2호 접촉·협박·보복행위 금지' },
      { v: '3', label: '3호 학교에서의 봉사' }, { v: '4', label: '4호 사회봉사' },
      { v: '5', label: '5호 특별교육 이수 또는 심리치료' }, { v: '6', label: '6호 출석정지' },
      { v: '7', label: '7호 학급교체' }, { v: '8', label: '8호 전학' }, { v: '9', label: '9호 퇴학처분' },
      { v: 'e2', label: '긴급조치 제2호(제17조④) — 기재 대상 아님' },
      { v: 'urg', label: '긴급조치 ⑤·⑥ (추인 전)' }
    ];
    items.forEach(function (i) { sel.appendChild(el('option', { value: i.v, text: i.label })); });

    var gy = $('#gradYear'); var y = today.getFullYear();
    for (var k = 0; k < 6; k++) {
      var yy = y + k;
      gy.appendChild(el('option', { value: String(yy), text: yy + '학년도 (졸업 ' + yy + '-02-28)' }));
    }
    gy.value = String(y + 1);
    $('#recDate').value = iso(today);
    runRecord();
  }

  function calcRows() {
    var inD = parseISO($('#inDate').value);
    var sepD = parseISO($('#sepDate').value) || (inD ? addDays(inD, 1) : null);
    var reqD = parseISO($('#reqDate').value);
    var decD = parseISO($('#decDate').value);
    var out = [];
    if (!inD) return out;
    out.push({
      title: '인지일 기준', rows: [
        { k: '① 피해학생 분리 시행 (24시간)', d: addDays(inD, 1), note: '인지 후 24시간 이내 · 인지 시각 +24시간', hot: true },
        { k: '② 교육(지원)청 사안 보고', d: addDays(inD, 2), note: '48시간 이내 · 불가피하면 유선 선행 후 공문' },
        { k: '③ 분리기간 만료 (시행일 포함 7일)', d: sepD ? addDays(sepD, 6) : null, note: '시행일을 1일로 셈 · 공휴일·토요일 포함 (53쪽)', hot: true, sep: true },
        { k: '④ 조사·전담기구 완료 (자체해결 결정 또는 심의위 요청)', d: addDays(inD, 14), note: '14일 이내' },
        { k: '⑤ 연기 시 최종 한도', d: addDays(inD, 21), note: '14일 + 7일 · 넘기면 절차 위반 소지', hot: true }
      ]
    });
    if (reqD) {
      out.push({
        title: '심의위 요청일 기준', rows: [
          { k: '⑥ 피해학생 보호조치 결정', d: addDays(reqD, 7), note: '요청 후 7일 이내 · 보호자 동의' },
          { k: '⑦ 가해학생 조치 결정', d: addDays(reqD, 14), note: '요청 후 14일 이내' }
        ]
      });
    }
    if (decD) {
      out.push({
        title: '조치 결정·통보일 기준', rows: [
          { k: '⑧ 조치 서면 통보', d: addDays(decD, 14), note: '결정 후 14일 이내 · 근거·이유 제시' },
          { k: '⑨ 보호자 특별교육 이수', d: addMonths(decD, 3), note: '통보 후 3개월 내 · 불응 시 300만원 이하 과태료', hot: true },
          { k: '⑩ 미이행 1차 확인', d: addMonths(decD, 3), note: '3개월 내 미이행 보고 → 교육장 21일 이내 1개월 내 이행 안내' },
          { k: '⑪ 행정심판 청구 (안 날부터 90일)', d: addDays(decD, 90), note: '처분일부터 180일 = ' + fmt(addDays(decD, 180)) }
        ]
      });
    }
    return out;
  }

  function runCalc() {
    var host = $('#deadlineOut'); if (!host) return;
    host.innerHTML = '';
    var groups = calcRows();
    if (!groups.length) {
      host.appendChild(el('p', { class: 'empty', text: '인지일을 넣으면 기한이 계산됩니다.' }));
      return;
    }
    var sepD = parseISO($('#sepDate').value);
    groups.forEach(function (g) {
      var card = el('div', { class: 'calc-card' }, [el('h4', {}, [el('span', { text: '⏱️' }), document.createTextNode(g.title)])]);
      g.rows.forEach(function (r) {
        if (r.d == null) return;
        var dow = r.d.getDay();
        var weekend = dow === 0 || dow === 6;
        var meta = el('small', { text: r.note });
        var v = el('span', { class: 'v' }, [document.createTextNode(fmt(r.d)), el('b', { class: 'dday-badge' + (r.hot ? ' hot' : ''), text: rel(r.d) }), meta]);
        if (weekend) {
          v.appendChild(el('span', {
            class: 'wk-badge ' + (r.sep ? 'ok' : 'warn'),
            text: r.sep ? '주말도 기간에 포함 — 연장 없음(53쪽)' : '주말 만료 — 익일 평일 연장 여부는 교육지원청 확인'
          }));
        }
        card.appendChild(el('div', { class: 'calc-line' + (r.hot ? ' hot' : '') }, [
          el('span', { class: 'k', text: r.k }),
          v
        ]));
      });
      if (g.title === '인지일 기준' && sepD) {
        card.appendChild(el('p', { class: 'calc-note', text: '※ 분리 1일차 = 분리 시행일(' + fmt(sepD) + '). 시행일을 바꾸면 ③이 그날부터 7일로 다시 계산됩니다.' }));
      }
      host.appendChild(card);
    });
    host.appendChild(el('p', { class: 'calc-note', text: '※ 분리기간만 "초일 산입·공휴일 포함"이 명시되어 있습니다(53쪽). 나머지 기한의 초일 산입 여부와 휴일 처리 방식은 소속 교육지원청에 확인해 확정하세요.' }));
  }

  /* ---------- 생기부 삭제 계산기 ---------- */
  var MEASURES = {
    '1': { name: '1호 서면사과', del: '졸업과 동시', review: false, hold: true, extra: '특별교육·보호자 교육 없음' },
    '2': { name: '2호 접촉·협박·보복 금지', del: '졸업과 동시', review: false, hold: true, extra: '특별교육 이수 또는 심리치료 필수 + 보호자 교육 4시간 이내' },
    '3': { name: '3호 학교에서의 봉사', del: '졸업과 동시', review: false, hold: true, extra: '특별교육 이수 또는 심리치료 필수 + 보호자 교육 4시간 이내' },
    '4': { name: '4호 사회봉사', del: '졸업일로부터 2년', review: true, hold: false, extra: '특별교육 이수 또는 심리치료 필수 + 보호자 교육 5시간 이상' },
    '5': { name: '5호 특별교육 이수 또는 심리치료', del: '졸업일로부터 2년', review: true, hold: false, extra: '특별교육 자체가 조치' },
    '6': { name: '6호 출석정지', del: '졸업일로부터 4년', review: true, hold: false, extra: '출석일수 미산입·미인정결석, 특별교육·보호자 교육 5시간 이상' },
    '7': { name: '7호 학급교체', del: '졸업일로부터 4년', review: true, hold: false, extra: '학적변동은 추인 후 반영, 특별교육·보호자 교육 5시간 이상' },
    '8': { name: '8호 전학', del: '졸업일로부터 4년', review: false, hold: false, extra: '졸업 직전 심의로 삭제 불가 · 피해학생 소속 학교로 재전학 불가' },
    '9': { name: '9호 퇴학처분', del: '삭제 대상 아님', review: false, hold: false, extra: '의무교육과정 학생에게는 적용 불가' },
    'e2': { name: '긴급조치 제2호(제17조④)', del: '기재 대상 아님', review: false, hold: false, extra: '추인 불요 · 생기부 기재하지 않음' },
    'urg': { name: '긴급조치 제17조⑤·⑥', del: '추인되면 조치로 기재', review: false, hold: false, extra: '추인 후 심의위 조치가 되어 기재 · 불추인 출석정지는 출석인정 처리' }
  };

  function runRecord() {
    var host = $('#recordOut'); if (!host) return;
    host.innerHTML = '';
    var v = $('#measureSel').value;
    var m = MEASURES[v]; if (!m) return;
    var rec = parseISO($('#recDate').value);
    var gy = Number($('#gradYear').value);
    var gradDate = new Date(gy, 1, 28);

    var card = el('div', { class: 'calc-card' }, [
      el('div', { class: 'record-head' }, [
        el('span', { class: 'big', text: m.name }),
        el('span', { class: 'page-badge', text: 'p.121-127' })
      ])
    ]);

    var delText = m.del;
    if (m.del === '졸업과 동시') delText = '졸업과 동시 (' + fmt(gradDate) + ')';
    else if (m.del === '졸업일로부터 2년') delText = '졸업일로부터 2년 (' + fmt(addMonths(gradDate, 24)) + ')';
    else if (m.del === '졸업일로부터 4년') delText = '졸업일로부터 4년 (' + fmt(addMonths(gradDate, 48)) + ')';

    card.appendChild(line('기재 여부', m.del === '기재 대상 아님' ? '기재하지 않음' : '기재 (통보 공문 접수 즉시)', ''));
    card.appendChild(line('삭제 시기', delText, '2024.3.1 이후 신고 사안 기준'));
    var reviewText;
    if (m.review) reviewText = '가능 — 요건 충족 시 졸업과 동시 삭제';
    else if (m.del === '기재 대상 아님') reviewText = '해당 없음';
    else if (m.del === '졸업과 동시') reviewText = '해당 없음 — 졸업과 동시에 삭제됨';
    else reviewText = '불가 — 8호는 졸업 직전 심의 대상이 아님';
    card.appendChild(line('졸업 직전 삭제 심의', reviewText, m.review ? '요건 2가지 + 확인자료 ①~⑤' : ''));
    if (m.hold) card.appendChild(line('조건부 기재유보', '이행하면 미기재 · 미이행 또는 동일 학교급 재학 중 같은 조치를 받으면 기재', '초등은 조치일부터 3년 내 · p.121,123'));
    card.appendChild(line('부가 조치', m.extra, ''));
    host.appendChild(card);

    if (m.review && rec) {
      var six = addMonths(rec, 6);
      var ok = six.getTime() <= gradDate.getTime();
      var box = el('div', { class: 'calc-card' }, [
        el('h4', {}, [el('span', { text: '🔎' }), document.createTextNode('졸업 직전 삭제 심의 요건 확인')])
      ]);
      box.appendChild(line('조치 결정일', fmt(rec), ''));
      box.appendChild(line('6개월 경과일', fmt(six), '결정일부터 6개월'));
      box.appendChild(line('졸업학년도 2월 말', fmt(gradDate), ''));
      box.appendChild(el('p', { class: 'verdict-line ' + (ok ? 'good' : 'bad'), text: ok
        ? '6개월 요건 충족 — 다만 "다른 사안으로 1~3호 포함 조치를 받은 사실이 없을 것"과 확인자료 ①~⑤를 모두 갖춰야 합니다(142~143쪽).'
        : '6개월 미경과 — 이번 졸업에서는 졸업 직전 삭제 심의 대상이 아닙니다. 삭제는 ' + fmt(addMonths(gradDate, m.del === '졸업일로부터 2년' ? 24 : 48)) + '입니다.' }));
      host.appendChild(box);
    }

    if (m.del === '졸업일로부터 4년' && !m.review) {
      host.appendChild(el('p', { class: 'calc-note', text: '※ 8호(전학)는 졸업일부터 4년 보관이며, 졸업 직전 전담기구 심의로 삭제할 수 없습니다(126~127쪽).' }));
    }
    if (v === '9') {
      host.appendChild(el('p', { class: 'calc-note', text: '※ 9호(퇴학)는 삭제 대상이 아니며, 의무교육과정 학생에게는 적용할 수 없습니다(110·127쪽).' }));
    }
  }
  function line(k, v, note) {
    return el('div', { class: 'calc-line' }, [
      el('span', { class: 'k', text: k }),
      el('span', { class: 'v' }, [document.createTextNode(v), note ? el('small', { text: note }) : null])
    ]);
  }

  /* ---------- 지뢰·예외 ---------- */
  var caseFilter = 'all', stageFilter = 'all', caseQuery = '';
  var GRADE_TEXT = { red: '복구 불가·감사', yellow: '예외 주의', green: '실무 팁' };
  /* 데이터의 grade_label 앞에 깨진 문자·이모지가 붙어도 한글만 남긴다(U+FFFD 방어) */
  function gradeText(c) {
    var t = String(c.grade_label || '').replace(/^[^가-힣]*/, '').trim();
    return t || GRADE_TEXT[c.grade] || '';
  }
  function caseHit(c, q) {
    if (!q) return true;
    var blob = [c.headline, c.stage, c.situation, c.conclusion, c.playbook]
      .concat((c.basis || []).map(function (b) { return b.ref + ' ' + b.point; }))
      .concat((c.discarded || []).map(function (x) { return x.claim + ' ' + x.reason; }))
      .join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return blob.indexOf(t) >= 0; });
  }
  function renderRisk() {
    if (!DATA.cases) return;
    var host = $('#caseList'); host.innerHTML = '';
    var list = DATA.cases.cases.filter(function (c) {
      return (caseFilter === 'all' || c.grade === caseFilter) &&
             (stageFilter === 'all' || c.stage === stageFilter) &&
             caseHit(c, caseQuery);
    });
    var cnt = $('#caseCount');
    if (cnt) {
      var s = DATA.cases.stats || {};
      cnt.textContent = list.length + '건 표시 · 전체 ' + DATA.cases.cases.length + '건 (🔴 ' + (s.red || 0) + ' · 🟡 ' + (s.yellow || 0) + ' · 🟢 ' + (s.green || 0) + ')';
    }
    if (!list.length) { host.appendChild(el('p', { class: 'empty', text: '조건에 맞는 사례가 없습니다. 등급·단계·검색어를 풀어 보세요.' })); }
    list.forEach(function (c) {
      var gl = { red: '🔴', yellow: '🟡', green: '🟢' }[c.grade] || '•';
      var d = el('details', { class: 'case ' + c.grade });
      if (caseQuery) d.open = true;
      d.appendChild(el('summary', {}, [
        el('span', { class: 'gl', text: gl }),
        el('div', { class: 'case-summary-main' }, [
          el('div', { class: 'case-title', text: c.headline }),
          el('div', { class: 'case-oneline', text: onelineOf(c) }),
          el('div', { class: 'case-meta' }, [
            el('span', { class: 'tag ' + (c.grade === 'red' ? 'case' : 'rule'), text: gradeText(c) }),
            c.stage ? el('span', { class: 'tag stage', text: c.stage }) : null,
            el('span', { text: c.verdict }),
            el('span', { class: 'case-toggle', text: '상황·검증·대응' })
          ])
        ])
      ]));
      var body = el('div', { class: 'case-body' });
      body.appendChild(el('div', { class: 'wide' }, [el('h5', { text: '상황' }), el('p', { text: c.situation })]));
      if (c.conclusion) body.appendChild(el('div', {}, [el('h5', { text: '검증 결론' }), el('p', { text: c.conclusion })]));
      body.appendChild(el('div', {}, [el('h5', { text: '실전 대응' }), el('p', { text: c.playbook })]));
      if (c.basis && c.basis.length) {
        body.appendChild(el('div', { class: 'wide' }, [
          el('h5', { text: '2026 근거' }),
          el('ul', { class: 'basis' }, c.basis.map(function (b) {
            return el('li', {}, [el('span', { class: 'ref', text: b.ref }), document.createTextNode(b.point)]);
          }))
        ]));
      }
      if (c.discarded && c.discarded.length) {
        body.appendChild(el('div', { class: 'wide' }, [el('h5', { text: '버린 주장' })].concat(c.discarded.map(function (x) {
          return el('div', { class: 'myth' }, [el('b', { text: x.claim }), document.createTextNode(x.reason + ' (' + x.ref + ')')]);
        }))));
      }
      d.appendChild(body);
      host.appendChild(d);
    });

    var ch = $('#changeList'); ch.innerHTML = '';
    var t = el('table');
    t.appendChild(el('thead', {}, [el('tr', {}, ['#', '항목', '2025판', '2026판', '쪽'].map(function (h) { return el('th', { text: h }); }))]));
    var tb = el('tbody');
    (DATA.official.changes_2026 || []).forEach(function (c) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: String(c.no) }),
        el('td', { text: c.item }),
        el('td', { text: c.before }),
        el('td', {}, [document.createTextNode(c.after)]),
        el('td', { class: 'pg', text: String(c.page) })
      ]));
    });
    t.appendChild(tb); ch.appendChild(t);

    var lg = $('#legacyList'); lg.innerHTML = '';
    (DATA.official.discarded_legacy || []).forEach(function (x) {
      lg.appendChild(el('div', { class: 'legacy' }, [
        el('div', { class: 't', text: x.item }),
        el('div', { class: 'r' }, [document.createTextNode(x.reason), el('span', { class: 'ref', text: x.ref })])
      ]));
    });
    var ml = $('#mythList'); ml.innerHTML = '';
    (DATA.cases.discarded_claims || []).forEach(function (x) {
      ml.appendChild(el('div', { class: 'legacy' }, [
        el('div', { class: 't', text: '✗ ' + x.claim }),
        el('div', { class: 'r' }, [document.createTextNode(x.reason), el('span', { class: 'ref', text: x.ref })])
      ]));
    });
  }

  $$('#caseFilter .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#caseFilter .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
      caseFilter = c.dataset.grade; renderRisk();
    });
  });
  $$('#stageFilter .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#stageFilter .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
      stageFilter = c.dataset.stage; renderRisk();
    });
  });
  var caseQEl = $('#caseQ');
  if (caseQEl) caseQEl.addEventListener('input', function () { caseQuery = caseQEl.value || ''; renderRisk(); });
  var caseQClear = $('#caseQClear');
  if (caseQClear) caseQClear.addEventListener('click', function () { if (caseQEl) caseQEl.value = ''; caseQuery = ''; renderRisk(); });
  $('#caseOpenAll').addEventListener('click', function () {
    $$('#caseList details').forEach(function (d) { d.open = true; });
    toast('모든 카드를 폈습니다');
  });
  $('#caseCloseAll').addEventListener('click', function () {
    $$('#caseList details').forEach(function (d) { d.open = false; });
    toast('모든 카드를 접었습니다');
  });

  /* ---------- 검색 ---------- */
  var INDEX = [];
  function buildSearchIndex() {
    INDEX = [];
    var o = DATA.official;
    (o.rules || []).forEach(function (r) {
      INDEX.push({ type: 'rule', title: r.topic + ' — ' + r.rule, body: r.ref, tag: r.topic });
    });
    (o.deadlines || []).forEach(function (d) {
      INDEX.push({ type: 'deadline', title: d.event, body: d.limit + (d.extra ? ' · ' + d.extra : ''), ref: 'p.' + d.page });
    });
    (o.key_flow || []).forEach(function (s) {
      INDEX.push({ type: 'rule', title: s.name + ' — ' + s.actions.join(' / '), body: '기한: ' + s.limit, ref: 'p.' + s.page, tag: '흐름' });
    });
    (o.forms || []).forEach(function (f) {
      INDEX.push({ type: 'form', title: f.code + ' ' + f.name, body: '부록1 양식', ref: 'p.' + f.page, tag: f.code });
    });
    (o.changes_2026 || []).forEach(function (c) {
      INDEX.push({ type: 'rule', title: '2026 개정 ' + c.no + ' · ' + c.item, body: (c.before ? '2025: ' + c.before + ' → ' : '') + '2026: ' + c.after, ref: 'p.' + c.page, tag: '개정' });
    });
    (o.discarded_legacy || []).forEach(function (x) {
      INDEX.push({ type: 'rule', title: '폐기 · ' + x.item, body: x.reason, ref: x.ref, tag: '폐기' });
    });
    if (DATA.cases) {
      (DATA.cases.cases || []).forEach(function (c) {
        INDEX.push({
          type: 'case', title: c.grade_label + ' ' + c.headline,
          body: (c.stage ? '[' + c.stage + '] ' : '') + c.situation + ' / ' + c.playbook,
          ref: (c.basis && c.basis[0] ? c.basis[0].ref : ''), tag: '지뢰'
        });
      });
      (DATA.cases.discarded_claims || []).forEach(function (x) {
        INDEX.push({ type: 'case', title: '✗ ' + x.claim, body: x.reason, ref: x.ref, tag: '통설' });
      });
    }
  }

  var typeFilter = 'all';
  function highlight(text, tokens) {
    var out = text;
    tokens.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function runSearch() {
    var q = ($('#q').value || '').trim();
    var host = $('#searchList'); var cnt = $('#qCount');
    host.innerHTML = '';
    var tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    var list = INDEX.filter(function (i) { return typeFilter === 'all' || i.type === typeFilter; });
    if (tokens.length) {
      list = list.filter(function (i) {
        var hay = (i.title + ' ' + i.body + ' ' + (i.tag || '') + ' ' + (i.ref || '')).toLowerCase();
        return tokens.every(function (t) { return hay.indexOf(t.toLowerCase()) >= 0; });
      });
    }
    cnt.textContent = list.length + '건' + (tokens.length ? ' · "' + q + '"' : ' · 전체 목록');
    var shown = list.slice(0, 80);
    if (!shown.length) { host.appendChild(el('p', { class: 'empty', text: '검색 결과가 없습니다. 다른 낱말로 찾아보세요 (예: 분리, 자체해결, 2호, 삭제).' })); }
    var labels = { rule: '규정', deadline: '기한', case: '지뢰·사례', form: '양식' };
    shown.forEach(function (i) {
      host.appendChild(el('div', { class: 'result' }, [
        el('div', { class: 'r-top' }, [
          el('span', { class: 'tag ' + i.type, text: labels[i.type] || i.type }),
          i.tag ? el('span', { class: 'tag', text: i.tag }) : null,
          i.ref ? el('span', { class: 'page-badge', text: String(i.ref) }) : null
        ]),
        el('div', { class: 'r-t', html: highlight(i.title, tokens) }),
        el('div', { class: 'r-b', html: highlight(i.body || '', tokens) })
      ]));
    });
    if (list.length > shown.length) {
      host.appendChild(el('p', { class: 'calc-note', text: '상위 ' + shown.length + '건만 표시했습니다. 검색어를 좁혀 주세요.' }));
    }
  }
  $('#q').addEventListener('input', runSearch);
  $('#qClear').addEventListener('click', function () { $('#q').value = ''; runSearch(); $('#q').focus(); });
  $$('#typeFilter .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#typeFilter .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
      typeFilter = c.dataset.type; runSearch();
    });
  });

  function renderForms() {
    var host = $('#formGrid'); host.innerHTML = '';
    (DATA.official.forms || []).forEach(function (f) {
      var detail = (STAGE.FORMS || {})[f.code];
      host.appendChild(el('button', { class: 'form-item', type: 'button', onclick: function () { openSheet(f.code); } }, [
        el('span', { class: 'code', text: f.code }),
        el('span', { text: f.name }),
        el('span', { class: 'pg', text: 'p.' + f.page }),
        detail ? null : el('span', { class: 'muted small', text: ' · 안내 준비 중' })
      ]));
    });
  }

  function renderTOC() {
    var host = $('#tocList'); host.innerHTML = '';
    var t = el('table');
    t.appendChild(el('thead', {}, [el('tr', {}, ['PART', '장', '제목', '쪽'].map(function (h) { return el('th', { text: h }); }))]));
    var tb = el('tbody');
    (DATA.official.toc || []).forEach(function (r) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: r.part }), el('td', { text: r.no }),
        el('td', { text: r.title }), el('td', { class: 'pg', text: 'p.' + r.page })
      ]));
    });
    t.appendChild(tb); host.appendChild(t);

    host.appendChild(el('p', { class: 'calc-note', text: '문서: ' + DATA.official.basis + ' · 쪽수는 PDF 페이지 = 인쇄 쪽수' }));
  }

  /* ---------- O/X 퀴즈 ---------- */
  var quizOrder = [], quizPick = {}, quizDone = 0;
  function quizReset(shuffle) {
    var idx = (STAGE.QUIZ || []).map(function (_, i) { return i; });
    if (shuffle) {
      for (var i = idx.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
      }
    }
    quizOrder = idx; quizPick = {}; quizDone = 0;
    renderQuiz();
  }
  function renderQuiz() {
    var host = $('#quizList'); if (!host) return;
    host.innerHTML = '';
    var total = quizOrder.length;
    var right = 0;
    quizOrder.forEach(function (qi, n) {
      var q = STAGE.QUIZ[qi]; if (!q) return;
      var picked = quizPick[qi];
      var card = el('div', { class: 'quiz-card' + (picked == null ? '' : (picked === q.answer ? ' ok' : ' bad')) });
      card.appendChild(el('div', { class: 'quiz-q' }, [
        el('span', { class: 'quiz-no', text: String(n + 1) }),
        el('span', { class: 'quiz-stmt', text: q.stmt })
      ]));
      var btns = el('div', { class: 'quiz-btns' });
      [true, false].forEach(function (val) {
        var b = el('button', {
          class: 'quiz-btn' + (picked == null ? '' : (q.answer === val ? ' is-answer' : (picked === val ? ' is-wrong' : ''))),
          type: 'button', text: val ? 'O' : 'X',
          'aria-label': (val ? 'O' : 'X') + ' 선택',
          onclick: function () {
            if (quizPick[qi] != null) return;
            quizPick[qi] = val; quizDone++;
            renderQuiz();
          }
        });
        if (picked != null) b.disabled = true;
        btns.appendChild(b);
      });
      card.appendChild(btns);
      if (picked != null) {
        var good = picked === q.answer;
        if (good) right++;
        card.appendChild(el('div', { class: 'quiz-answer ' + (good ? 'ok' : 'bad') }, [
          el('p', { class: 'quiz-verdict' }, [
            el('b', { text: (good ? '정답 ' : '틀렸습니다 — 정답 ') + (q.answer ? 'O' : 'X') }),
            el('span', { class: 'page-badge', text: q.ref })
          ]),
          el('p', { class: 'quiz-row' }, [el('span', { class: 'k', text: '검증 결론' }), el('span', { class: 'v', text: q.verdict })]),
          el('p', { class: 'quiz-row' }, [el('span', { class: 'k', text: '왜 함정' }), el('span', { class: 'v', text: q.trap })])
        ]));
      }
      host.appendChild(card);
    });
    var score = $('#quizScore');
    if (score) score.textContent = quizDone ? right + ' / ' + quizDone + ' 정답' : '0 / 0 정답';
    var prog = $('#quizProgress');
    if (prog) prog.textContent = quizDone + ' / ' + total + ' 문제 풀었습니다';
  }
  $('#quizShuffle').addEventListener('click', function () { quizReset(true); toast('문제 순서를 섞었습니다'); });
  $('#quizReset').addEventListener('click', function () { quizReset(false); toast('처음부터 다시 풉니다'); });

  /* ---------- 익명 사안 진행 체크 (localStorage) ---------- */
  var TRACK_KEY = 'hakpok.cases.v3';
  var TRACK_MAX = 3;
  var LETTERS = ['A', 'B', 'C', 'D'];

  function trackLoad() {
    try {
      var raw = window.localStorage.getItem(TRACK_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function trackSave(arr) {
    try { window.localStorage.setItem(TRACK_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }
  function privacyProblem(txt) {
    var s = String(txt || '');
    if (!s) return '';
    if (s.indexOf('@') >= 0) return '이메일·핸들로 보이는 입력은 저장하지 않습니다.';
    if (/\d{3}\s*-\s*\d{3,}/.test(s) || /\d{7,}/.test(s)) return '전화번호·학번처럼 보이는 숫자는 저장하지 않습니다.';
    if (/(초등|중학|고등|학교|반|번)/.test(s) && /\d/.test(s)) return '학교·학급을 특정할 수 있는 표기는 피해 주세요(예: 사안 A).';
    return '';
  }
  function parseDate(v) {
    var d = parseISO(v); return d;
  }
  function trackRender() {
    var host = $('#trackList'); if (!host) return;
    host.innerHTML = '';
    var arr = trackLoad();
    if (!arr.length) {
      host.appendChild(el('p', { class: 'empty', text: '저장된 사안이 없습니다. 인지일을 넣고 "사안 추가"를 누르면 기한과 체크리스트가 생깁니다.' }));
      return;
    }
    arr.forEach(function (item) {
      var start = parseDate(item.date);
      if (!start) return;
      var done = item.checks || {};
      var total = (STAGE.CHECK_STEPS || []).length;
      var doneN = (STAGE.CHECK_STEPS || []).filter(function (s) { return done[s.key]; }).length;
      var card = el('div', { class: 'track-card' });
      var head = el('div', { class: 'track-head' }, [
        el('div', {}, [
          el('strong', { class: 'track-label', text: item.label }),
          el('span', { class: 'muted small', text: ' · 인지 ' + fmt(start) })
        ]),
        el('div', { class: 'track-head-right' }, [
          el('span', { class: 'track-progress', text: doneN + '/' + total }),
          el('button', {
            class: 'track-del', type: 'button', text: '삭제', 'aria-label': item.label + ' 삭제',
            onclick: function () {
              var next = trackLoad().filter(function (x) { return x.id !== item.id; });
              trackSave(next); trackRender(); toast('사안을 지웠습니다');
            }
          })
        ])
      ]);
      card.appendChild(head);

      var nextStep = null;
      (STAGE.CHECK_STEPS || []).forEach(function (s) {
        if (!done[s.key] && nextStep == null) nextStep = s;
      });
      if (nextStep && nextStep.days != null) {
        var nd = addDays(start, nextStep.days);
        card.appendChild(el('p', { class: 'track-next' }, [
          el('b', { text: '다음: ' + nextStep.label }),
          document.createTextNode(' ' + fmt(nd)),
          el('span', { class: 'dday-badge' + (daysFromToday(nd) < 0 ? ' hot' : ''), text: rel(nd) })
        ]));
      } else if (!nextStep) {
        card.appendChild(el('p', { class: 'track-next done', text: '체크리스트를 모두 마쳤습니다. 서류 보관·이관까지 확인하세요.' }));
      }

      var list = el('ul', { class: 'track-steps' });
      (STAGE.CHECK_STEPS || []).forEach(function (s) {
        var on = !!done[s.key];
        var due = s.days != null ? addDays(start, s.days) : null;
        var lab = el('label', { class: 'track-step' + (on ? ' is-on' : '') }, [
          el('input', { type: 'checkbox', checked: on ? 'checked' : null }),
          el('span', { class: 'track-step-main' }, [
            el('span', { class: 'track-step-label', text: s.label }),
            el('span', { class: 'track-step-meta' }, [
              due ? el('b', { class: 'track-date', text: fmt(due) }) : el('b', { class: 'track-date', text: '통보·종결 후' }),
              due ? el('span', { class: 'dday-badge' + (daysFromToday(due) < 0 && !on ? ' hot' : ''), text: rel(due) }) : null,
              el('span', { class: 'page-badge', text: s.ref }),
              s.form ? el('button', {
                class: 'chip form-chip mini', type: 'button', text: s.form,
                onclick: function (ev) { ev.preventDefault(); openSheet(s.form); }
              }) : null
            ])
          ])
        ]);
        lab.querySelector('input').addEventListener('change', function (e) {
          var arr2 = trackLoad();
          arr2.forEach(function (x) { if (x.id === item.id) { x.checks = x.checks || {}; x.checks[s.key] = e.target.checked; } });
          trackSave(arr2); trackRender();
        });
        list.appendChild(el('li', {}, [lab]));
      });
      card.appendChild(list);
      host.appendChild(card);
    });
  }

  $('#trackAdd').addEventListener('click', function () {
    var arr = trackLoad();
    var msg = $('#trackMsg');
    if (arr.length >= TRACK_MAX) { msg.textContent = '익명 사안은 최대 3건까지 저장됩니다. 하나를 지우고 추가하세요.'; return; }
    var d = parseISO($('#trackDate').value);
    if (!d) { msg.textContent = '인지일을 먼저 넣어 주세요.'; return; }
    var label = ($('#trackLabel').value || '').trim();
    var bad = privacyProblem(label);
    if (bad) { msg.textContent = bad; return; }
    var used = arr.map(function (x) { return x.label; });
    var letter = LETTERS[arr.length] || 'D';
    var k = 0;
    while (used.indexOf('사안 ' + letter) >= 0 && k < 10) { k++; letter = LETTERS[(arr.length + k) % LETTERS.length]; }
    if (!label) label = '사안 ' + letter;
    arr.push({ id: 'c' + Date.now(), label: label, date: iso(d), checks: {} });
    if (!trackSave(arr)) { msg.textContent = '이 브라우저에서는 저장이 차단되었습니다(시크릿 모드 등).'; return; }
    $('#trackLabel').value = '';
    msg.textContent = '추가했습니다. 이 브라우저에만 저장됩니다.';
    trackRender();
  });
  $('#trackClearAll').addEventListener('click', function () {
    var arr = trackLoad();
    if (!arr.length) { $('#trackMsg').textContent = '지울 사안이 없습니다.'; return; }
    trackSave([]); trackRender();
    $('#trackMsg').textContent = '모두 지웠습니다.';
  });

  var EXEC_KEY = 'hakpok.execUrl';

  function b64e(s) {
    try {
      return btoa(unescape(encodeURIComponent(String(s || ''))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { return ''; }
  }
  function b64d(s) {
    try {
      var t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      while (t.length % 4) t += '=';
      return decodeURIComponent(escape(atob(t)));
    } catch (e) { return ''; }
  }
  function execGet() {
    try { return window.localStorage.getItem(EXEC_KEY) || ''; } catch (e) { return ''; }
  }
  function execSet(url) {
    try {
      if (url) window.localStorage.setItem(EXEC_KEY, url);
      else window.localStorage.removeItem(EXEC_KEY);
      return true;
    } catch (e) { return false; }
  }
  function safeDecode(s) {
    try { return decodeURIComponent(String(s || '')); } catch (e) { return ''; }
  }
  function readHashLink() {
    var m = String(location.hash || '').match(/[#&]s=([^&]+)/);
    if (!m) return '';
    var v = b64d(safeDecode(m[1]));
    return /^https:\/\//i.test(v) ? v : '';
  }
  /* 붙여넣은 값이 '#s=' 링크여도 안에서 주소만 뽑아 쓴다 */
  function normalizeExec(v) {
    var s = String(v || '').trim();
    var m = s.match(/[#&]s=([^&]+)/);
    if (m) { var d = b64d(safeDecode(m[1])); if (d) s = d.trim(); }
    return s;
  }
  /* #s= 링크로 열렸으면 저장하고 주소창 해시를 정리한다 */
  function applyHashLink() {
    var url = readHashLink();
    if (!url) return '';
    execSet(url);
    if (history.replaceState) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 무시 */ }
    }
    return url;
  }
  function pageLink() {
    var base = location.origin + location.pathname;
    var url = execGet();
    return url ? base + '#s=' + b64e(url) : base;
  }
  function linkRender() {
    var url = execGet();
    var input = $('#linkUrl');
    if (input && document.activeElement !== input) input.value = url;
    var st = $('#linkState');
    if (st) {
      st.className = 'link-state' + (url ? ' on' : '');
      st.innerHTML = url
        ? '<b>연결 주소가 저장되어 있습니다.</b> 이 브라우저에만 남습니다. 시트 연동 기능이 붙으면 이 주소를 그대로 씁니다.'
        : '<b>저장된 연결 주소가 없습니다.</b> 기본 주소로도 모든 화면을 그대로 쓸 수 있습니다. 나중에 시트 연동을 붙일 때 여기에 주소를 저장해 두면 됩니다.';
    }
    var help = $('#linkHelp');
    if (help) help.textContent = url
      ? '이 주소가 담긴 #s= 링크를 복사합니다. 다른 기기·브라우저에서 이 링크로 열면 주소가 자동으로 저장됩니다.'
      : '지금은 기본 주소(해시 없음)를 복사합니다. 포털·즐겨찾기에 그대로 넣어 두면 됩니다. 주소를 저장하면 #s= 링크로 바뀝니다.';
  }
  function openLink() {
    var msg = $('#linkMsg'); if (msg) msg.textContent = '';
    linkRender();
    $('#linkBackdrop').hidden = false;
    $('#linkSheet').hidden = false;
    $('#linkClose').focus();
  }
  function closeLink() {
    $('#linkBackdrop').hidden = true;
    $('#linkSheet').hidden = true;
  }
  $('#linkBtn').addEventListener('click', openLink);
  $('#linkClose').addEventListener('click', closeLink);
  $('#linkBackdrop').addEventListener('click', closeLink);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#linkSheet').hidden) closeLink(); });

  $('#linkSave').addEventListener('click', function () {
    var msg = $('#linkMsg');
    var v = normalizeExec($('#linkUrl').value);
    if (!v) { msg.textContent = '주소를 넣어 주세요.'; return; }
    if (!/^https:\/\/\S+$/i.test(v)) { msg.textContent = 'https:// 로 시작하는 주소만 저장합니다 (Apps Script는 …/exec 형식).'; return; }
    if (!execSet(v)) { msg.textContent = '이 브라우저에서는 저장이 차단되었습니다(시크릿 모드 등).'; return; }
    $('#linkUrl').value = v;
    linkRender();
    msg.textContent = '저장했습니다. 이 브라우저에만 남습니다.';
    toast('연결 주소를 저장했습니다');
  });
  $('#linkClear').addEventListener('click', function () {
    execSet('');
    $('#linkUrl').value = '';
    linkRender();
    $('#linkMsg').textContent = '저장된 주소를 지웠습니다. 기본 주소로도 그대로 쓸 수 있습니다.';
    toast('연결 주소를 지웠습니다');
  });
  $('#linkCopy').addEventListener('click', function () {
    var link = pageLink();
    var msg = $('#linkMsg');
    var done = function () {
      if (msg) msg.textContent = '링크를 복사했습니다. 붙여넣어 쓰세요.';
      toast(execGet() ? '이 페이지 링크를 복사했습니다' : '기본 주소를 복사했습니다');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () { window.prompt('링크를 복사하세요', link); });
    } else {
      window.prompt('링크를 복사하세요', link);
    }
  });

  /* 앱을 켜 둔 채 주소창에 #s= 링크를 붙여넣은 경우 */
  window.addEventListener('hashchange', function () {
    if (!readHashLink()) return;
    applyHashLink();
    linkRender();
    if (history.replaceState) {
      try { history.replaceState(null, '', '#' + currentView); } catch (e) { /* 무시 */ }
    }
    toast('연결 주소를 저장했습니다');
  });

  /* ---------- 이벤트 묶음 ---------- */
  $('#calcRun').addEventListener('click', runCalc);
  $('#calcToday').addEventListener('click', function () { $('#inDate').value = iso(new Date()); $('#sepDate').value = iso(addDays(new Date(), 1)); runCalc(); });
  ['#inDate', '#sepDate', '#reqDate', '#decDate'].forEach(function (s) { $(s).addEventListener('change', runCalc); });
  $('#calcCopy').addEventListener('click', function () {
    var groups = calcRows(); var lines = [];
    groups.forEach(function (g) { lines.push('[' + g.title + ']'); g.rows.forEach(function (r) { if (r.d != null) lines.push(r.k + ': ' + fmt(r.d) + ' (' + rel(r.d) + ')'); }); });
    var text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('기한표를 복사했습니다'); }, function () { toast('복사가 차단되었습니다'); });
    } else { toast('이 브라우저에서는 복사할 수 없습니다'); }
  });
  $('#measureSel').addEventListener('change', runRecord);
  $('#recDate').addEventListener('change', runRecord);
  $('#gradYear').addEventListener('change', runRecord);
  $$('#check5 input').forEach(function (c) {
    c.addEventListener('change', function () {
      var n = $$('#check5 input').filter(function (x) { return x.checked; }).length;
      var out = $('#check5Out');
      out.textContent = n === 5 ? '5종 모두 준비됨 — ①~⑤ 중 하나라도 미제출이면 삭제 불가입니다(143쪽).' : n + '/5 준비 — 남은 서류가 있으면 졸업 직전 삭제 심의를 통과할 수 없습니다.';
      out.className = 'verdict-line ' + (n === 5 ? 'good' : 'bad');
    });
  });
  $$('input[type=range]').forEach(function (r) {
    r.addEventListener('input', function () {
      var total = $$('input[type=range]').reduce(function (a, x) { return a + Number(x.value); }, 0);
      $('#scoreTotal').textContent = total;
    });
  });

  /* ---------- 시작 ---------- */
  var linked = applyHashLink();
  renderTree();
  initCalc();
  quizReset(false);
  $('#trackDate').value = iso(new Date());
  trackRender();
  linkRender();
  var hash = (location.hash || '').replace('#', '');
  showView(VIEWS.indexOf(hash) >= 0 ? hash : 'nav');
  if (linked) toast('연결 주소를 이 브라우저에 저장했습니다');
  loadData();

  /* PWA */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; $('#installBtn').hidden = false;
  });
  $('#installBtn').addEventListener('click', function () {
    if (!deferred) { toast('브라우저 메뉴의 "홈 화면에 추가"를 사용하세요'); return; }
    deferred.prompt(); deferred = null; $('#installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', function () { $('#installBtn').hidden = true; });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('SW 등록 실패', e); });
    });
  }
})();
