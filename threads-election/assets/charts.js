
(function () {
  const D = window.DAY; if (!D || !window.d3) return;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C = [css('--c0'), css('--c1'), css('--c2')], CM = css('--cm');
  const fmt = d3.format(','), signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
  const widths = (svg, s) => { const g = svg.append('g').attr('opacity', 0); const w = s.map((t) => g.append('text').text(t).node().getComputedTextLength() || String(t).length * 12); g.remove(); return w; };
  const tipFor = (el) => { const t = document.createElement('div'); t.className = 'tip'; t.hidden = true; el.appendChild(t);
    return { show(ev, text) { t.textContent = text; t.hidden = false; const [x, y] = d3.pointer(ev, el);
      t.style.left = Math.max(0, Math.min(el.clientWidth - t.offsetWidth, x + 12)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 8) + 'px'; },
      hide() { t.hidden = true; } }; };
  const svgIn = (el, H, label) => d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${el.clientWidth} ${H}`).attr('role', 'img').attr('aria-label', label);

  function stance(el) {
    const rows = [['shen', 0], ['chiang', 1]].map(([k, c]) => ({ ...D.cands[k], c }));
    const W = el.clientWidth, rowH = 34, gap = 14, H = rows.length * (rowH + gap);
    const svg = svgIn(el, H, '兩位候選人當日支持與反對貼文的讚數');
    const lw = d3.max(widths(svg, rows.map((r) => r.name))) + 10;
    const vw = d3.max(widths(svg, rows.flatMap((r) => [`${fmt(r.support_likes)}（${r.support_posts}）`, `${fmt(r.oppose_likes)}（${r.oppose_posts}）`]))) + 8;
    const center = lw + (W - lw) / 2, half = Math.max(10, (W - lw) / 2 - vw);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(r.support_likes, r.oppose_likes)) || 1]).range([0, half]);
    const tip = tipFor(el);
    rows.forEach((r, i) => {
      const y = i * (rowH + gap) + gap / 2;
      svg.append('text').attr('class', 'lab').attr('y', y + rowH / 2).attr('dy', '.35em').text(r.name);
      const msg = `${r.name}\n支持：${fmt(r.support_likes)} 讚（${r.support_posts} 則）\n反對：${fmt(r.oppose_likes)} 讚（${r.oppose_posts} 則）\n淨聲量：${signed(r.net)}`;
      svg.append('rect').attr('x', center - x(r.oppose_likes)).attr('y', y).attr('width', x(r.oppose_likes)).attr('height', rowH).attr('fill', C[r.c]).attr('opacity', .4)
        .on('pointermove', (e) => tip.show(e, msg)).on('pointerleave', tip.hide);
      svg.append('rect').attr('x', center).attr('y', y).attr('width', x(r.support_likes)).attr('height', rowH).attr('fill', C[r.c])
        .on('pointermove', (e) => tip.show(e, msg)).on('pointerleave', tip.hide);
      svg.append('text').attr('class', 'val').attr('x', center - x(r.oppose_likes) - 4).attr('y', y + rowH / 2).attr('dy', '.35em').attr('text-anchor', 'end').text(`${fmt(r.oppose_likes)}（${r.oppose_posts}）`);
      svg.append('text').attr('class', 'val').attr('x', center + x(r.support_likes) + 4).attr('y', y + rowH / 2).attr('dy', '.35em').text(`${fmt(r.support_likes)}（${r.support_posts}）`);
    });
    svg.append('line').attr('x1', center).attr('x2', center).attr('y2', H).attr('stroke', CM);
  }

  function trend(el) {
    const parse = d3.utcParse('%Y-%m-%d'), day = d3.utcFormat('%m/%d');
    const series = [['shen', '沈伯洋', 0], ['chiang', '蔣萬安', 1]].map(([k, name, c]) => ({ name, c, pts: D.trend.map((t) => ({ t: parse(t.date), v: t[k] ?? t.cands?.[k] })) }));
    const W = el.clientWidth, H = 220, svg = svgIn(el, H, '兩位候選人每日淨聲量趨勢');
    const all = series.flatMap((s) => s.pts);
    const y = d3.scaleLinear().domain(d3.extent([0, ...all.map((p) => p.v)])).nice(); const ticks = y.ticks(5);
    const ends = series.map((s) => `${s.name} ${signed(s.pts[s.pts.length - 1].v)}`);
    const m = { top: 10, bottom: 24, left: d3.max(widths(svg, ticks.map(signed))) + 8, right: d3.max(widths(svg, ends)) + 10 };
    y.range([H - m.bottom, m.top]);
    const dates = series[0].pts.map((p) => p.t);
    const x = dates.length > 1 ? d3.scaleUtc().domain(d3.extent(dates)).range([m.left, W - m.right]) : () => (m.left + W - m.right) / 2;
    svg.append('g').attr('transform', `translate(${m.left},0)`).call(d3.axisLeft(y).tickValues(ticks).tickFormat(signed).tickSize(-(W - m.left - m.right)));
    const step = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor((W - m.left - m.right) / 48))));
    const xa = svg.append('g').attr('transform', `translate(0,${H - m.bottom})`);
    dates.filter((_, i) => i % step === 0).forEach((t) => xa.append('text').attr('x', x(t)).attr('y', 16).attr('text-anchor', 'middle').text(day(t)));
    svg.append('line').attr('x1', m.left).attr('x2', W - m.right).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', CM);
    const endY = series.map((s) => y(s.pts[s.pts.length - 1].v));
    if (Math.abs(endY[0] - endY[1]) < 14) { const mid = (endY[0] + endY[1]) / 2, up = endY[0] <= endY[1] ? 0 : 1; endY[up] = mid - 7; endY[1 - up] = mid + 7; }
    series.forEach((s, i) => {
      svg.append('path').datum(s.pts).attr('fill', 'none').attr('stroke', C[s.c]).attr('stroke-width', 2).attr('d', d3.line().x((p) => x(p.t)).y((p) => y(p.v)));
      svg.selectAll(null).data(s.pts).join('circle').attr('cx', (p) => x(p.t)).attr('cy', (p) => y(p.v)).attr('r', 3).attr('fill', C[s.c]);
      svg.append('text').attr('class', 'val').attr('x', W - m.right + 6).attr('y', endY[i]).attr('dy', '.35em').text(ends[i]);
    });
    const tip = tipFor(el), hover = svg.append('line').attr('stroke', CM).attr('y1', m.top).attr('y2', H - m.bottom).attr('opacity', 0);
    svg.append('rect').attr('x', m.left).attr('y', m.top).attr('width', Math.max(1, W - m.left - m.right)).attr('height', H - m.top - m.bottom).attr('fill', 'transparent')
      .on('pointermove', (e) => { const px = d3.pointer(e)[0]; const i = d3.leastIndex(dates, (t) => Math.abs(x(t) - px));
        hover.attr('x1', x(dates[i])).attr('x2', x(dates[i])).attr('opacity', 1);
        tip.show(e, [day(dates[i]), ...series.map((s) => `${s.name}：${signed(s.pts[i].v)}`)].join('\n')); })
      .on('pointerleave', () => { hover.attr('opacity', 0); tip.hide(); });
  }

  const go = (id, f) => { const el = document.getElementById(id); if (el) { el.replaceChildren(); f(el); } };
  const STZ = { support: '支持', oppose: '反對', neutral: '中立', mixed: '混合', not_mentioned: '未提及' };
  const reduce = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // one filter at a time: a topic (active), a word (activeWord) or a 其他 sub-label (activeOther)
  const fromHash = (k) => { const m = location.hash.match(new RegExp('^#' + k + '=(.+)$')); return m ? decodeURIComponent(m[1]) : null; };
  let active = fromHash('topic'), activeWord = fromHash('word'), activeOther = null;
  if (active && !(D.posts || []).some((p) => p.topics.includes(active))) active = null;
  if (activeWord && !(D.word_posts && D.word_posts[activeWord])) activeWord = null;

  function applyFilter(scroll, hash) {
    history.replaceState(null, '', hash || location.pathname + location.search);
    renderPosts();
    if (D.topics) go('topics', stacked);
    markClouds();
    if (scroll && (active || activeWord || activeOther))
      document.getElementById('posts').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function setTopic(t, scroll) {
    active = t || null; activeWord = null; activeOther = null;
    applyFilter(scroll, active ? '#topic=' + encodeURIComponent(active) : null);
  }
  function setWord(w, scroll) {
    activeWord = w && w !== activeWord ? w : null; active = null; activeOther = null;
    applyFilter(scroll, activeWord ? '#word=' + encodeURIComponent(activeWord) : null);
  }
  function setOther(o, scroll) {
    activeOther = o && o !== activeOther ? o : null; active = null; activeWord = null;
    applyFilter(scroll, null);
  }
  // dim the cloud words that are not the current filter
  function markClouds() {
    const cur = activeWord || activeOther || active;
    document.querySelectorAll('#tcloud text, #wcloud text, #tcloud .fallback span, #wcloud .fallback span').forEach((n) => {
      n.style.opacity = !cur || n.textContent === cur ? 1 : 0.3;
    });
  }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function renderPosts() {
    const body = document.getElementById('posts-body'); if (!body || !D.posts) return;
    const list = activeWord ? ((D.word_posts || {})[activeWord] || []).map((i) => D.posts[i]).filter(Boolean)
      : activeOther ? D.posts.filter((p) => p.other === activeOther)
      : active ? D.posts.filter((p) => p.topics.includes(active)) : D.posts;
    const shown = list.slice(0, D.top_n);
    body.replaceChildren();
    shown.forEach((p, i) => {
      const tr = mk('tr');
      tr.append(mk('td', 'rank num', String(i + 1)));
      const lk = mk('td', 'likes num', fmt(p.likes)); lk.append(mk('span', 'unit', ' 讚')); tr.append(lk);
      const tp = mk('td', 'topics');
      p.topics.forEach((t) => { const b = mk('button', 'topic-btn' + (t === active ? ' active' : ''), t); b.type = 'button';
        b.addEventListener('click', () => setTopic(t === active ? null : t, false)); tp.append(b); });
      tr.append(tp);
      [['沈伯洋', p.stance_shen], ['蔣萬安', p.stance_chiang]].forEach(([who, st]) => {
        const td = mk('td', 'st'), c = mk('span', 'chip ' + st); c.append(mk('span', 'who', who + ' '), STZ[st] || st); td.append(c); tr.append(td); });
      const sar = mk('td', 'sar'); if (p.sarcasm) sar.append(mk('span', 'chip sarc', '反諷')); tr.append(sar);
      tr.append(mk('td', 'sum', p.summary));
      const ln = mk('td', 'link'), a = mk('a', null, '原文 ↗'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; ln.append(a); tr.append(ln);
      tr.append(mk('td', 'br'));
      body.append(tr);
    });
    if (!shown.length) { const tr = mk('tr'), td = mk('td', 'empty', '沒有符合的貼文'); td.colSpan = 9; tr.append(td); body.append(tr); }
    const desc = document.getElementById('posts-desc');
    const label = activeWord ? `含「${activeWord}」的貼文` : activeOther ? `其他細項「${activeOther}」` : active ? `議題「${active}」` : '';
    if (desc) desc.textContent = label
      ? `${label}共 ${list.length} 則，依讚數顯示前 ${shown.length} 則。`
      : `選舉相關貼文中讚數最高的 ${shown.length} 則；摘要由 Claude 撰寫，原文請見連結。點選議題可篩選。`;
    const bar = document.getElementById('filterbar');
    if (bar) { bar.hidden = !label; const nm = document.getElementById('filter-name'); if (nm) nm.textContent = activeWord ? `詞彙「${activeWord}」` : activeOther ? `其他細項「${activeOther}」` : (active || ''); }
  }
  const clear = document.getElementById('filter-clear');
  if (clear) clear.addEventListener('click', () => { active = null; activeWord = null; activeOther = null; applyFilter(false, null); });

  function stacked(el) {
    const rows = D.topics, keys = [['shen', C[0], '挺沈伯洋／批蔣萬安'], ['chiang', C[1], '挺蔣萬安／批沈伯洋'], ['neutral', CM, '中立／混合']];
    const W = el.clientWidth, bh = 22, gap = 8, H = rows.length * (bh + gap), svg = svgIn(el, H, '當日各議題貼文數，依立場傾向拆分');
    const left = d3.max(widths(svg, rows.map((r) => r.topic))) + 10, right = d3.max(widths(svg, rows.map((r) => fmt(r.posts)))) + 8;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.posts) || 1]).range([0, Math.max(10, W - left - right)]);
    const tip = tipFor(el);
    rows.forEach((r, i) => {
      const y = i * (bh + gap); let x0 = left;
      const dim = active && r.topic !== active ? 0.3 : 1;
      const pick = () => setTopic(r.topic === active ? null : r.topic, true);
      const g = svg.append('g').attr('class', 'clickable').attr('opacity', dim).on('click', pick);
      g.append('rect').attr('x', 0).attr('y', y - gap / 2).attr('width', W).attr('height', bh + gap).attr('fill', 'transparent');
      g.append('text').attr('class', 'lab').attr('x', left - 8).attr('y', y + bh / 2).attr('dy', '.35em').attr('text-anchor', 'end')
        .style('font-weight', r.topic === active ? 600 : null).text(r.topic);
      keys.forEach(([k, fill]) => { const w = x(r[k]); if (w > 0) g.append('rect').attr('x', x0).attr('y', y).attr('width', w).attr('height', bh).attr('fill', fill)
        .on('pointermove', (e) => tip.show(e, `${r.topic}（${r.posts} 則）\n` + keys.map(([kk, , n]) => `${n}：${r[kk]}`).join('\n') + '\n點選以篩選貼文')).on('pointerleave', tip.hide); x0 += w; });
      g.append('text').attr('class', 'val').attr('x', x0 + 4).attr('y', y + bh / 2).attr('dy', '.35em').text(fmt(r.posts));
    });
  }

  function bars(el, rows, label) {
    const W = el.clientWidth, bh = 18, gap = 7, H = rows.length * (bh + gap), svg = svgIn(el, H, label);
    const left = d3.max(widths(svg, rows.map((r) => r.label))) + 10, right = d3.max(widths(svg, rows.map((r) => fmt(r.posts)))) + 8;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.posts) || 1]).range([0, Math.max(10, W - left - right)]);
    const tip = tipFor(el);
    rows.forEach((r, i) => { const y = i * (bh + gap);
      svg.append('text').attr('class', 'lab').attr('x', left - 8).attr('y', y + bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').text(r.label);
      svg.append('rect').attr('x', left).attr('y', y).attr('width', x(r.posts)).attr('height', bh).attr('rx', 2).attr('fill', C[2])
        .on('pointermove', (e) => tip.show(e, `${r.label}：${r.posts} 則`)).on('pointerleave', tip.hide);
      svg.append('text').attr('class', 'val').attr('x', left + x(r.posts) + 4).attr('y', y + bh / 2).attr('dy', '.35em').text(fmt(r.posts)); });
  }

  // ---------- topic cloud + word cloud ----------
  let cloudMetric = 'posts', cloudExpand = false;
  const FONT = getComputedStyle(document.body).fontFamily;
  function leanColor(x) {
    const tot = x.shen + x.chiang + x.neutral, mid = css('--muted'); if (!tot) return mid;
    const t = (x.shen - x.chiang) / tot;   // -1 pro-Chiang .. +1 pro-Shen
    return t >= 0 ? d3.interpolateRgb(mid, C[0])(Math.min(1, t * 1.4)) : d3.interpolateRgb(mid, C[1])(Math.min(1, -t * 1.4));
  }
  function cloud(el, items, unit, maxShown, scaleFrom, shrink = true) {
    const rows = items.filter((d) => d[cloudMetric] > 0).sort((a, b) => b[cloudMetric] - a[cloudMetric]).slice(0, maxShown);
    if (!rows.length) { el.append(mk('p', 'note', '沒有足夠的資料。')); return; }
    const W = el.clientWidth || 800, H = Math.round(Math.max(240, Math.min(380, W * 0.45)));
    const ext = d3.extent(rows, (d) => d[cloudMetric]);
    const lo = scaleFrom === 'zero' || ext[0] === ext[1] ? 0 : ext[0];
    const fs = d3.scaleSqrt().domain([lo, ext[1]]).range([12, Math.max(28, Math.min(60, W / 10))]);
    const words = rows.map((d) => ({ ...d, size: Math.round(fs(d[cloudMetric])) }));
    const tot = D.cloud_totals || {};
    const tip = tipFor(el);
    const pick = (d) => unit === '詞' ? setWord(d.text, true)
      : d.other ? setOther(d.text, true) : setTopic(d.text === active ? null : d.text, true);
    const msg = (d) => `${d.text}${d.other ? '（其他細項）' : ''}\n${fmt(d.posts)} 則貼文 · ${fmt(d.likes)} 讚\n挺沈 ${d.shen} · 挺蔣 ${d.chiang} · 中立／混合 ${d.neutral}\n點選以篩選下方貼文`;
    if (!(d3.layout && d3.layout.cloud)) {
      const box = mk('div', 'fallback'); el.append(box);
      words.forEach((d) => { const sp = mk('span', null, d.text); sp.style.fontSize = d.size + 'px'; sp.style.color = leanColor(d);
        sp.style.cursor = 'pointer'; sp.addEventListener('click', () => pick(d)); box.append(sp); });
      markClouds();
      return;
    }
    const layout = (scale, tries) => d3.layout.cloud().size([W, H])
      .words(words.map((d) => ({ ...d, size: Math.max(10, Math.round(d.size * scale)) })))
      .padding(4).rotate(0).random(() => 0.5).font(FONT).fontWeight(600).fontSize((d) => d.size).spiral('archimedean')
      .on('end', (placed) => {
        if (placed.length < words.length && tries > 0 && shrink) return layout(scale * 0.85, tries - 1);
        el.querySelectorAll('svg, .note').forEach((n) => n.remove());
        const svg = svgIn(el, H, unit + '文字雲');
        svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`).selectAll('text').data(placed).join('text')
          .attr('text-anchor', 'middle').attr('transform', (d) => `translate(${d.x},${d.y})`)
          .style('font-size', (d) => d.size + 'px').style('font-family', FONT).style('font-weight', 600)
          .style('fill', (d) => leanColor(d)).style('cursor', 'pointer').text((d) => d.text)
          .on('pointermove', (e, d) => tip.show(e, msg(d))).on('pointerleave', tip.hide)
          .on('click', (e, d) => { tip.hide(); pick(d); });
        markClouds();
        if (placed.length < words.length) el.append(mk('p', 'note', `另有 ${words.length - placed.length} 個較小的${unit}因版面不足未顯示。`));
      }).start();
    layout(1, 4);
  }
  function drawClouds() {
    const c = D.cloud; if (!c) return;
    if (c.excluded_topics && c.excluded_topics.length) {
      const d = document.getElementById('tcloud-desc');
      if (d) d.textContent = `Claude 標註的議題（不含「${c.excluded_topics.join('」「')}」）。`;
    }
    if (c.excluded_words && c.excluded_words.length) {
      const d = document.getElementById('wcloud-desc');
      if (d) d.textContent = `直接從貼文原文斷詞統計，每則貼文同一個詞只算一次，且至少出現在 2 則貼文中；候選人姓名與「台北」「市長」等幾乎每則都有的詞不列入。`;
    }
    const tItems = cloudExpand ? c.topics.filter((t) => t.text !== '其他').concat(c.others || []) : c.topics;
    go('tcloud', (el) => cloud(el, tItems, '議題', cloudExpand ? 70 : 30, 'zero', !cloudExpand));
    go('wcloud', (el) => c.words ? cloud(el, c.words, '詞', el.clientWidth < 600 ? 35 : 60, 'min')
                                 : el.append(mk('p', 'note', '這一天沒有詞彙資料。')));
  }
  const ex = document.getElementById('cloud-expand');
  if (ex) ex.addEventListener('change', () => { cloudExpand = ex.checked; drawClouds(); });
  document.querySelectorAll('#cloud-metric button').forEach((b) => b.addEventListener('click', () => {
    cloudMetric = b.dataset.m;
    document.querySelectorAll('#cloud-metric button').forEach((x) => x.classList.toggle('on', x === b));
    drawClouds();
  }));

  // ---------- rising words ----------
  function rising(el) {
    const R = D.rising, desc = document.getElementById('rise-desc');
    if (!R) { el.append(mk('p', 'note', '這是第一天的資料（或尚未安裝斷詞套件），沒有之前的日期可以比較。')); return; }
    if (desc) desc.textContent = `與之前 ${R.before_days} 天（共 ${fmt(R.before_posts)} 則選舉相關貼文）相比，當日明顯更常出現的詞。`;
    const rows = R.words;
    if (!rows.length) { el.append(mk('p', 'note', '當日沒有明顯升溫的詞。')); return; }
    const pc = (v) => (v * 100).toFixed(1) + '%';
    const W = el.clientWidth, bh = 20, gap = 8, H = rows.length * (bh + gap);
    const svg = svgIn(el, H, '當日升溫詞');
    const vals = rows.map((r) => `${pc(r.before_share)} → ${pc(r.today_share)}（${r.today} 則）`);
    const lw = d3.max(widths(svg, rows.map((r) => r.w))) + 12, rw = d3.max(widths(svg, vals)) + 10;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.z)]).range([0, Math.max(40, W - lw - rw)]);
    const tip = tipFor(el);
    rows.forEach((r, i) => {
      const y = i * (bh + gap);
      const msg = `${r.w}\n當日 ${r.today} 則（${pc(r.today_share)}）\n之前 ${r.before} 則（${pc(r.before_share)}）\n當日立場：挺沈 ${r.shen} · 挺蔣 ${r.chiang} · 中立／混合 ${r.neutral}`;
      svg.append('text').attr('class', 'lab').attr('x', lw - 8).attr('y', y + bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').text(r.w);
      svg.append('rect').attr('x', lw).attr('y', y).attr('width', x(r.z)).attr('height', bh).attr('rx', 2).attr('fill', leanColor(r));
      svg.append('text').attr('class', 'val').attr('x', lw + x(r.z) + 6).attr('y', y + bh / 2).attr('dy', '.35em').text(vals[i]);
      svg.append('rect').attr('x', 0).attr('y', y - gap / 2).attr('width', W).attr('height', bh + gap).attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('pointermove', (e) => tip.show(e, msg + '\n點選以篩選下方貼文')).on('pointerleave', tip.hide)
        .on('click', () => { tip.hide(); setWord(r.w, true); });
    });
  }

  function drawAll() {
    if (D.cands) go('stance', stance);
    if (D.trend && D.trend.length) go('trend', trend);
    if (D.topics) go('topics', stacked);
    if (D.post_types) go('ptype', (el) => bars(el, D.post_types, '當日各類型貼文數'));
    if (D.image_types) go('itype', (el) => bars(el, D.image_types, '當日含各類圖片的貼文數'));
    if ('rising' in D) go('rising', rising);
    drawClouds();
  }
  drawAll();
  renderPosts();
  let w = window.innerWidth; window.addEventListener('resize', () => { if (window.innerWidth !== w) { w = window.innerWidth; drawAll(); } });
})();
