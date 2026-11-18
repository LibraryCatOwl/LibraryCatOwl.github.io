
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
  let active = (location.hash.match(/^#topic=(.+)$/) || [])[1];
  active = active ? decodeURIComponent(active) : null;
  if (active && !(D.posts || []).some((p) => p.topics.includes(active))) active = null;

  function setTopic(t, scroll) {
    active = t || null;
    history.replaceState(null, '', active ? '#topic=' + encodeURIComponent(active) : location.pathname + location.search);
    renderPosts();
    if (D.topics) go('topics', stacked);
    if (scroll && active) document.getElementById('posts').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function renderPosts() {
    const body = document.getElementById('posts-body'); if (!body || !D.posts) return;
    const list = active ? D.posts.filter((p) => p.topics.includes(active)) : D.posts;
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
    if (desc) desc.textContent = active
      ? `議題「${active}」共 ${list.length} 則相關貼文，依讚數顯示前 ${shown.length} 則。`
      : `選舉相關貼文中讚數最高的 ${shown.length} 則；摘要由 Claude 撰寫，原文請見連結。點選議題可篩選。`;
    const bar = document.getElementById('filterbar');
    if (bar) { bar.hidden = !active; const nm = document.getElementById('filter-name'); if (nm) nm.textContent = active || ''; }
  }
  const clear = document.getElementById('filter-clear');
  if (clear) clear.addEventListener('click', () => setTopic(null, false));

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

  function drawAll() {
    if (D.cands) go('stance', stance);
    if (D.trend && D.trend.length) go('trend', trend);
    if (D.topics) go('topics', stacked);
    if (D.post_types) go('ptype', (el) => bars(el, D.post_types, '當日各類型貼文數'));
    if (D.image_types) go('itype', (el) => bars(el, D.image_types, '當日含各類圖片的貼文數'));
  }
  drawAll();
  renderPosts();
  let w = window.innerWidth; window.addEventListener('resize', () => { if (window.innerWidth !== w) { w = window.innerWidth; drawAll(); } });
})();
