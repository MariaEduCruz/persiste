(function () {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const LS = 'persiste_state_v2';

  // ---------- estado ----------
  let S;
  function load() {
    try { const r = localStorage.getItem(LS); if (r) return JSON.parse(r); } catch (e) {}
    return { students: JSON.parse(JSON.stringify(window.SEED_STUDENTS)), interests: [] };
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
  S = load();
  const stu = (id) => S.students.find((s) => s.id === id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (h) => (h ? h.slice(0, 10) + '...' + h.slice(-6) : '');

  // ---------- radar de risco (regras explicáveis, sem LLM) ----------
  function risk(s) {
    const fr = s.freq[s.freq.length - 1], fr0 = s.freq[0];
    const media = s.notas.reduce((a, b) => a + b, 0) / s.notas.length;
    const score = Math.round(Math.min(100, Math.max(0, (100 - fr) * 0.6 + Math.max(0, 7 - media) * 7 + Math.min(s.diasSemPortal, 30) * 1.0)));
    const level = score >= 55 ? 'alto' : score >= 30 ? 'med' : 'baixo';
    const reasons = [];
    if (fr < 75) reasons.push({ k: 'frequencia', t: 'Frequência caiu de ' + fr0 + '% para ' + fr + '%' });
    if (media < 6) reasons.push({ k: 'nota', t: 'Média de notas em ' + media.toFixed(1).replace('.', ',') });
    if (s.diasSemPortal >= 14) reasons.push({ k: 'contato', t: 'Sem acessar o portal há ' + s.diasSemPortal + ' dias' });
    if (!reasons.length) reasons.push({ k: 'ok', t: 'Sem sinais de alerta relevantes' });
    const sug = { frequencia: 'Plano de recuperação de frequência com o coordenador', nota: 'Monitoria da disciplina com nota mais baixa', contato: 'Conversa com o coordenador (contato humano)', ok: 'Manter acompanhamento normal' }[reasons[0].k];
    return { score, level, reasons, sug };
  }
  const lvlTxt = { alto: 'Alto', med: 'Médio', baixo: 'Baixo' };
  const badge = (l) => '<span class="badge b-' + l + '">' + lvlTxt[l] + '</span>';

  // ---------- pontos / ranking (SIMULADO, fora da blockchain) ----------
  function points(s) {
    const cr = s.credentials.filter((c) => !c.revoked);
    let p = cr.reduce((a, c) => a + (window.PTS[c.tipo] || 10), 0);
    const evol = cr.some((c) => c.tipo === 'nota' || c.tipo === 'frequencia');
    if (evol) p += 40;
    return { pts: p, evol, creds: cr.length };
  }
  function ranking() {
    const list = S.students.filter((s) => s.rankOptIn && s.handle).map((s) => { const p = points(s); return { id: s.id, handle: s.handle, course: s.course, pts: p.pts, creds: p.creds, evol: p.evol }; });
    window.RANK_SEED.forEach((r) => list.push({ id: null, ...r }));
    return list.sort((a, b) => b.pts - a.pts);
  }

  // ---------- gráficos ----------
  function line(data, max, color) {
    const w = 260, h = 90, n = data.length;
    const pts = data.map((v, i) => [10 + (i * (w - 20)) / (n - 1), h - 10 - (v / max) * (h - 20)]);
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '"><polyline fill="none" stroke="' + color + '" stroke-width="2.5" points="' + pts.map((p) => p.join(',')).join(' ') + '"/>' + pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.5" fill="' + color + '"/>').join('') + '</svg>';
  }
  function bars(data) {
    const w = 260, h = 90, n = data.length, mx = Math.max(12, ...data), bw = (w - 20) / n - 8;
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '">' + data.map((v, i) => { const bh = (v / mx) * (h - 14); return '<rect x="' + (10 + i * ((w - 20) / n)) + '" y="' + (h - bh - 4) + '" width="' + bw + '" height="' + bh + '" rx="4" fill="#14b8a6"/>'; }).join('') + '</svg>';
  }

  // ---------- util UI ----------
  function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms || 3500); }
  function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.classList.remove('hidden'); }
  function closeModal() { $('#modal').classList.add('hidden'); }
  function qrSvg(text) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag(4, 0); } catch (e) { return '<p>Não foi possível gerar o QR.</p>'; } }
  const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const unb64 = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));

  function shareLink(c) {
    const base = location.origin + location.pathname;
    if (!c.real) return base + '#/verificar?demo=1&t=' + encodeURIComponent(c.title);
    return base + '#/verificar?sig=' + encodeURIComponent(c.sig) + '&p=' + encodeURIComponent(b64(c.payload));
  }

  // ---------- navegação ----------
  function nav(route) {
    const items = [['#/', 'Início'], ['#/faculdade', 'Coordenador'], ['#/aluno/marina', 'Aluno'], ['#/empresa', 'Empresa']];
    $('#nav').innerHTML = items.map((i) => '<a href="' + i[0] + '" class="' + (route.startsWith(i[0].replace('#', '')) && i[0] !== '#/' || (i[0] === '#/' && route === '/') ? 'on' : '') + '">' + i[1] + '</a>').join('');
  }
  function sub(id, cur) {
    return '<div class="tabs">' + [['jornada', 'Jornada'], ['carteira', 'Carteira'], ['ranking', 'Ranking']].map((t) => '<a class="btn ' + (cur === t[0] ? '' : 'sec') + '" href="#/aluno/' + id + (t[0] === 'jornada' ? '' : '/' + t[0]) + '">' + t[1] + '</a>').join('') + '</div>';
  }

  // ---------- telas ----------
  function home() {
    return '<div class="hero"><span class="badge b-real">Hackathon MVP · Solana devnet</span><h1>Persiste</h1><p class="sub" style="font-size:18px">Não prove que você fez um curso. <b style="color:var(--p2)">Prove o que você aprendeu.</b></p>' +
      '<div class="pills"><div class="pill">Detecta cedo alunos em risco</div><div class="pill">Explica o motivo e sugere apoio</div><div class="pill">Registra marcos na Solana</div><div class="pill">Conecta o aluno ao mercado</div></div></div>' +
      '<div class="grid g3">' +
      '<div class="card"><h2>Sou aluno</h2><p class="sub">Veja sua jornada, carteira e ranking.</p>' + S.students.slice(0, 3).map((s) => '<a class="row" style="text-decoration:none;color:inherit" href="#/aluno/' + s.id + '"><span><b>' + esc(s.name) + '</b><br><span class="meta">' + esc(s.course) + ' · ' + s.period + 'º período</span></span><span>→</span></a>').join('') + '</div>' +
      '<div class="card"><h2>Sou coordenador</h2><p class="sub">Radar de risco e emissão de credenciais na Solana.</p><a class="btn" href="#/faculdade">Acessar painel →</a></div>' +
      '<div class="card"><h2>Sou empresa</h2><p class="sub">Encontre talentos com credenciais verificáveis, só com consentimento do aluno.</p><a class="btn ok" href="#/empresa">Acessar portal →</a></div></div>' +
      '<footer class="s">Dados acadêmicos ficam fora da blockchain. Na Solana vai só o hash da credencial. Todos os alunos são fictícios.</footer>';
  }

  function faculdade() {
    const list = S.students.map((s) => ({ s, r: risk(s) }));
    const cnt = (l) => list.filter((x) => x.r.level === l).length;
    const ivs = S.students.filter((s) => s.intervencao).length;
    const ce = S.students.reduce((a, s) => a + s.credentials.length, 0);
    const selL = (window.__fl) || 'ativos', q = (window.__fq || '').toLowerCase();
    const rows = list.filter((x) => (selL === 'todos' || x.r.level !== 'baixo') && x.s.name.toLowerCase().includes(q)).sort((a, b) => b.r.score - a.r.score);
    return '<h1>Painel do Coordenador</h1><p class="sub">Identifique quem precisa de ajuda e aja rápido.</p>' +
      '<div class="grid g6" style="margin-bottom:16px">' + [['Total de alunos', S.students.length, ''], ['Risco alto', cnt('alto'), 'bad-t'], ['Risco médio', cnt('med'), ''], ['Risco baixo', cnt('baixo'), 'ok-t'], ['Intervenções ativas', ivs, ''], ['Credenciais emitidas', ce, '']].map((x) => '<div class="stat"><small>' + x[0] + '</small><b class="' + x[2] + '">' + x[1] + '</b></div>').join('') + '</div>' +
      '<div class="card" id="issuer"><h2>Carteira da instituição (emissora)</h2><p class="meta">Endereço: <span class="hash" id="iaddr">' + esc(SOL.issuerAddress()) + '</span></p><p class="meta" id="ibal">Saldo: consultando...</p>' +
      '<button class="btn sec" data-act="airdrop">Pedir 1 SOL de teste (devnet)</button> <button class="btn sec" data-act="phantom">Usar Phantom</button> <a class="btn sec" target="_blank" rel="noopener" href="' + SOL.explorerAddr(SOL.issuerAddress()) + '">Ver no Explorer</a></div>' +
      '<div class="card"><h2>Alunos em risco</h2><div class="filters"><select data-act="filter"><option value="ativos"' + (selL === 'ativos' ? ' selected' : '') + '>Alto e Médio</option><option value="todos"' + (selL === 'todos' ? ' selected' : '') + '>Todos</option></select><input id="fq" placeholder="Buscar por nome..." value="' + esc(window.__fq || '') + '"></div>' +
      rows.map((x) => '<div class="row"><span><a class="nm" href="#/faculdade/' + x.s.id + '">' + esc(x.s.name) + '</a> ' + badge(x.r.level) + (x.s.intervencao ? ' <span class="badge b-real">Intervenção ativa</span>' : '') + '<br><span class="meta">' + esc(x.s.course) + ' · ' + x.s.period + 'º período</span></span><span class="score">' + x.r.score + '<br><small class="meta">score de risco</small></span></div>').join('') + '</div>';
  }

  function faculdadeAluno(id) {
    const s = stu(id); if (!s) return '<p>Aluno não encontrado.</p>';
    const r = risk(s);
    return '<a class="link" href="#/faculdade">← Voltar ao painel</a><h1 style="margin-top:8px">' + esc(s.name) + ' ' + badge(r.level) + '</h1><p class="sub">' + esc(s.course) + ' · ' + s.period + 'º período · score de risco ' + r.score + '</p>' +
      '<div class="grid g3"><div class="card"><small class="meta">Frequência (%)</small>' + line(s.freq, 100, '#7c3aed') + '</div><div class="card"><small class="meta">Notas</small>' + line(s.notas, 10, '#14b8a6') + '</div><div class="card"><small class="meta">Acessos ao portal</small>' + bars(s.acessos) + '</div></div>' +
      '<div class="card"><h2>Por que este aluno aparece no radar</h2><ul>' + r.reasons.map((x) => '<li>' + esc(x.t) + '</li>').join('') + '</ul><div class="note"><b>Ação sugerida:</b> ' + esc(r.sug) + '<br><small class="meta">Explicação gerada por regras transparentes. A decisão e o contato são sempre humanos.</small></div>' +
      (s.intervencao ? '<span class="badge b-real">Intervenção ativa</span>' : '<button class="btn" data-act="interv" data-id="' + s.id + '">Aprovar intervenção</button>') + '</div>' +
      '<div class="card"><h2>Marcos e credenciais</h2>' + (s.milestones.length ? s.milestones.map((m) => {
        const cr = s.credentials.find((c) => c.title === m.title);
        let act = '';
        if (m.state === 'pendente') act = '<span class="badge b-med">Pendente</span>';
        else if (m.state === 'concluido') act = '<button class="btn ok" data-act="emit" data-id="' + s.id + '" data-m="' + m.id + '">Emitir credencial na Solana</button>';
        else act = '<span class="badge b-real">Credencial emitida</span>' + (cr && !cr.revoked ? ' <button class="btn sec" data-act="revoke" data-id="' + s.id + '" data-c="' + cr.id + '">Revogar</button>' : '') + (cr && cr.revoked ? ' <span class="badge b-rev">Revogada</span>' : '');
        return '<div class="row"><span><b>' + esc(m.title) + '</b><br><span class="meta">' + esc(m.desc) + '</span></span><span>' + act + '</span></div>';
      }).join('') : '<p class="meta">Sem marcos definidos para este aluno.</p>') + '</div>';
  }

  function jornada(id) {
    const s = stu(id); if (!s) return '<p>Aluno não encontrado.</p>';
    const r = risk(s);
    const done = s.milestones.filter((m) => m.state !== 'pendente').length, pct = s.milestones.length ? Math.round((done / s.milestones.length) * 100) : 0;
    const msgs = (window.__chat && window.__chat[id]) || [{ me: false, t: 'Oi! Estou aqui pra te ajudar nessa jornada. Pode me contar como estão as coisas ou perguntar sobre seus marcos. 💜' }];
    const pend = s.milestones.find((m) => m.state === 'pendente');
    const status = r.level === 'alto' ? 'Vamos cuidar disso juntos' : r.level === 'med' ? 'Você está no caminho, com alguns pontos pra melhorar' : 'Tudo indo bem, continue assim';
    return sub(id, 'jornada') + '<h1>Oi, ' + esc(s.name.split(' ')[0]) + '. Vamos olhar sua jornada?</h1><p class="sub">Acompanhe seu progresso e seus próximos passos.</p>' +
      '<div class="grid" style="grid-template-columns:2fr 1fr;align-items:start"><div>' +
      '<div class="note"><small class="meta">Situação atual</small><br><b>' + status + '</b></div>' +
      '<div class="grid g3"><div class="card"><small class="meta">Frequência</small>' + line(s.freq, 100, '#7c3aed') + '</div><div class="card"><small class="meta">Notas</small>' + line(s.notas, 10, '#14b8a6') + '</div><div class="card"><small class="meta">Acessos ao portal</small>' + bars(s.acessos) + '</div></div>' +
      '<div class="card"><h2>Seus marcos</h2><p class="meta">' + done + ' de ' + s.milestones.length + ' marcos concluídos · ' + pct + '%</p><div class="bar"><i style="width:' + pct + '%"></i></div><div style="margin-top:12px">' +
      s.milestones.map((m) => '<div class="row"><span><b>' + esc(m.title) + '</b><br><span class="meta">' + esc(m.desc) + '</span></span><span>' + (m.state === 'pendente' ? '<span class="badge b-med">Pendente</span>' : m.state === 'concluido' ? '<span class="badge b-med">Aguardando emissão da faculdade</span>' : '<span class="badge b-real">Concluído · credencial</span>') + '</span></div>').join('') + '</div>' +
      (pend ? '<button class="btn sec" data-act="simulate" data-id="' + s.id + '">▶ Simular conclusão de marco</button>' : '') + '</div>' +
      '<div class="card"><h2>Próximo passo sugerido</h2><b>' + esc(r.sug) + '</b><p class="meta">' + esc(r.reasons[0].t) + '. ' + (r.reasons[0].k === 'contato' ? 'Isso merece contato humano.' : '') + '</p><button class="btn ok" data-act="accept" data-id="' + s.id + '">Aceitar</button> <button class="btn sec" data-act="later">Agora não</button></div></div>' +
      '<div class="card"><h2>Assistente Persiste</h2><small class="meta">Respostas por regras, não substitui apoio profissional</small><div class="chat" id="chat">' + msgs.map((m) => '<div class="msg ' + (m.me ? 'me' : '') + '">' + esc(m.t) + '</div>').join('') + '</div><div class="bar-in"><input id="chatin" placeholder="Escreva sua mensagem..."><button class="btn" data-act="send" data-id="' + s.id + '">Enviar</button></div></div></div>';
  }

  function credCard(s, c) {
    return '<div class="card" style="' + (c.revoked ? 'opacity:.55' : '') + '"><span class="badge ' + (c.revoked ? 'b-rev' : c.real ? 'b-real' : 'b-demo') + '" style="float:right">' + (c.revoked ? 'Revogada' : c.real ? 'On-chain (devnet)' : 'Demo (não gravada)') + '</span><h2>' + esc(c.title) + '</h2><p class="meta">Universidade Exemplo · ' + esc(c.date) + '</p><p class="hash">hash: ' + esc(short(c.hash)) + '</p>' +
      '<label class="meta"><input type="checkbox" data-act="vis" data-id="' + s.id + '" data-c="' + c.id + '" ' + (c.visible ? 'checked' : '') + (c.revoked ? ' disabled' : '') + '> Visível p/ empresas</label><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" data-act="detail" data-id="' + s.id + '" data-c="' + c.id + '">Detalhes</button><button class="btn sec" data-act="share" data-id="' + s.id + '" data-c="' + c.id + '" ' + (c.revoked ? 'disabled' : '') + '>QR / Compartilhar</button></div></div>';
  }

  function carteira(id) {
    const s = stu(id); if (!s) return '';
    const p = points(s);
    return sub(id, 'carteira') + '<h1>Carteira de Credenciais</h1><p class="sub">Guarde, controle e compartilhe a prova do que você aprendeu.</p>' +
      '<div class="note"><b>Bolsa-permanência condicional</b> <span class="badge b-sim">SIMULADO</span><br>USDC ' + (p.creds * 50) + ' (devnet) vinculados a marcos. Neste MVP o valor é ilustrativo, a transferência automática está no roadmap.</div>' +
      '<div class="grid g3">' + (s.credentials.length ? s.credentials.map((c) => credCard(s, c)).join('') : '<p class="meta">Nenhuma credencial ainda. Conclua um marco e peça a emissão à faculdade.</p>') + '</div>' +
      '<div class="card"><h2>Portfólio de aprendizagem</h2><p class="meta">Educação</p><b>' + esc(s.course) + ' · ' + s.period + 'º período</b><p class="meta">Credenciais verificáveis</p><b>' + s.credentials.filter((c) => !c.revoked && c.visible).length + ' compartilháveis</b><p class="meta">Portfólio</p><ul>' + s.credentials.filter((c) => !c.revoked).map((c) => '<li>' + esc(c.title) + '</li>').join('') + '</ul><p class="meta">Empregabilidade</p><p>Compartilhe suas credenciais por QR. Empresas verificam sem contatar a faculdade.</p></div>';
  }

  function rankingView(id) {
    const s = stu(id); if (!s) return '';
    const p = points(s), rk = ranking(), pos = rk.findIndex((x) => x.id === s.id) + 1;
    return sub(id, 'ranking') + '<h1>🏆 Ranking de evolução <span class="badge b-sim" style="font-size:12px">SIMULADO, não está na blockchain</span></h1><p class="sub">Progresso e evolução contam mais que nota absoluta.</p>' +
      '<div class="grid g2"><div class="card"><h2>Seus pontos</h2><div class="score" style="text-align:left;font-size:40px">' + p.pts + ' <small class="meta">pts</small></div><p class="meta">Credenciais ' + p.creds + ' · Bônus de evolução ' + (p.evol ? '+40' : '0') + '</p>' + (s.rankOptIn && pos ? '<b class="ok-t">Você está em #' + pos + ' no ranking público</b>' : '<p class="meta">Você não aparece no ranking público.</p>') + '</div>' +
      '<div class="card"><h2>Visibilidade no ranking</h2><p class="meta">Sem opt-in você não aparece no ranking público. Escolha um apelido, seu nome real nunca é exposto.</p><div class="bar-in"><input id="handle" value="' + esc(s.handle) + '" placeholder="apelido"><label><input type="checkbox" data-act="optin" data-id="' + s.id + '" ' + (s.rankOptIn ? 'checked' : '') + '> Visível</label></div></div></div>' +
      '<div class="card"><h2>Ranking público</h2>' + rk.map((x, i) => '<div class="row" style="' + (x.id === s.id ? 'background:#f5f3ff' : '') + '"><span><b>' + (i + 1) + '. @' + esc(x.handle) + '</b><br><span class="meta">' + esc(x.course) + ' · ' + x.creds + ' credenciais' + (x.evol ? ' · +40 evolução' : '') + '</span></span><span class="score">' + x.pts + ' <small class="meta">pts</small></span></div>').join('') + '</div>' +
      '<div class="card"><h2>Como os pontos funcionam</h2><div class="grid g3">' + [['Monitoria', 'monitoria'], ['Recuperação de nota', 'nota'], ['Projeto', 'projeto'], ['Avaliação prática', 'avaliacao'], ['Frequência recuperada', 'frequencia']].map((x) => '<div class="pill">' + x[0] + ' <b style="float:right">+' + window.PTS[x[1]] + '</b></div>').join('') + '</div><div class="note" style="margin-top:12px"><b>Bônus de evolução +40:</b> ao concluir recuperação de nota ou frequência, reconhecendo quem saiu de uma situação de risco.</div></div>';
  }

  function empresa() {
    const course = window.__ec || '';
    const talents = S.students.filter((s) => s.rankOptIn && s.credentials.some((c) => !c.revoked && c.visible) && (!course || s.course === course));
    const courses = [...new Set(S.students.map((s) => s.course))];
    return '<h1>Portal da Empresa</h1><p class="sub">Talentos que escolheram se mostrar, com credenciais verificáveis na Solana. Sem contatar a faculdade.</p>' +
      '<div class="note">Você só vê alunos que ativaram a visibilidade e apenas as credenciais que eles liberaram. Nome real fica oculto, o aluno aparece por apelido.</div>' +
      '<div class="filters"><select data-act="ecourse"><option value="">Todos os cursos</option>' + courses.map((c) => '<option ' + (c === course ? 'selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div>' +
      (talents.length ? talents.map((s) => { const p = points(s); const interested = S.interests.includes(s.id);
        return '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h2>@' + esc(s.handle) + '</h2><span class="meta">' + esc(s.course) + ' · ' + p.pts + ' pts' + (p.evol ? ' · superou uma situação de risco' : '') + '</span></div><button class="btn ' + (interested ? 'sec' : 'ok') + '" data-act="interest" data-id="' + s.id + '">' + (interested ? '✓ Interesse enviado' : 'Tenho interesse') + '</button></div><div style="margin-top:10px">' +
          s.credentials.filter((c) => !c.revoked && c.visible).map((c) => '<div class="row"><span><b>' + esc(c.title) + '</b> <span class="badge ' + (c.real ? 'b-real' : 'b-demo') + '">' + (c.real ? 'On-chain' : 'Demo') + '</span><br><span class="meta">' + esc(c.date) + '</span></span><a class="btn sec" href="' + shareLink(c).replace(location.origin + location.pathname, '') + '">Verificar</a></div>').join('') + '</div></div>'; }).join('') : '<p class="meta">Nenhum talento visível ainda. No perfil do aluno, ative o ranking e libere credenciais para empresas.</p>');
  }

  function verificar(qs) {
    const q = new URLSearchParams(qs);
    if (q.get('demo')) return '<div class="card"><h1>Credencial de demonstração</h1><div class="note warn">A credencial <b>' + esc(q.get('t')) + '</b> é de demonstração e não tem registro na blockchain. Emita uma credencial real pelo painel do coordenador para ver a verificação on-chain.</div></div>';
    return '<div class="card"><h1>Verificação de credencial</h1><div id="vres"><p class="meta">Consultando a Solana devnet...</p></div></div>';
  }
  async function runVerify(qs) {
    const q = new URLSearchParams(qs), el = $('#vres'); if (!el) return;
    try {
      const sig = q.get('sig'), payload = unb64(q.get('p'));
      const hash = await SOL.sha256Hex(JSON.stringify(payload));
      const r = await SOL.readMemo(sig);
      if (!r) { el.innerHTML = '<p class="bad-t">✗ Transação não encontrada na devnet.</p>'; return; }
      const memoOk = r.memo === 'persiste:v1:' + hash, signerOk = r.signer === payload.issuer;
      const ok = memoOk && signerOk;
      el.innerHTML = '<p class="' + (ok ? 'ok-t' : 'bad-t') + '" style="font-size:20px">' + (ok ? '✓ Credencial autêntica e não adulterada' : '✗ Credencial NÃO confere com o registro da chain') + '</p>' +
        '<div class="row"><span><b>' + esc(payload.titulo) + '</b><br><span class="meta">' + esc(payload.curso) + ' · ' + esc(payload.data) + '</span></span></div>' +
        '<ul><li>Hash recalculado confere com o memo gravado: <b>' + (memoOk ? 'sim' : 'não') + '</b></li><li>Assinada pela instituição emissora: <b>' + (signerOk ? 'sim' : 'não') + '</b></li><li>Emissora: <span class="hash">' + esc(payload.issuer) + '</span></li><li>Bloco (slot): ' + r.slot + (r.blockTime ? ' · ' + new Date(r.blockTime * 1000).toLocaleString('pt-BR') : '') + '</li></ul>' +
        '<a class="btn sec" target="_blank" rel="noopener" href="' + SOL.explorer(sig) + '">Ver transação no Solana Explorer</a>' +
        '<p class="meta" style="margin-top:12px">A chain prova quem emitiu e que o conteúdo não foi alterado. Que o conteúdo é verdadeiro depende da confiança na instituição emissora.</p>';
    } catch (e) { el.innerHTML = '<p class="bad-t">✗ Não foi possível verificar: ' + esc(e.message) + '</p>'; }
  }

  // ---------- ações ----------
  async function emit(sid, mid) {
    const s = stu(sid), m = s.milestones.find((x) => x.id === mid);
    toast('Gravando na Solana devnet...', 20000);
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const date = new Date().toISOString().slice(0, 10);
      const payload = { v: 1, titulo: m.title, tipo: m.type, curso: s.course, data: date, titular: s.name.split(' ')[0], issuer: SOL.issuerAddress(), salt };
      const hash = await SOL.sha256Hex(JSON.stringify(payload));
      const sig = await SOL.writeMemo(hash);
      s.credentials.push({ id: 'c-' + Date.now(), title: m.title, tipo: m.type, date, hash, sig, issuer: payload.issuer, payload, visible: true, revoked: false, real: true });
      m.state = 'emitida'; save(); toast('Credencial gravada na devnet ✓'); render();
    } catch (e) {
      const msg = String(e.message || e);
      toast('Falhou: ' + (/airdrop|insufficient|debit|0x1|funds/i.test(msg) ? 'a carteira da instituição está sem SOL de teste. Use "Pedir 1 SOL" ou o faucet.solana.com.' : msg), 7000);
    }
  }

  async function onClick(e) {
    const t = e.target.closest('[data-act]'); if (!t) { if (e.target.id === 'modal') closeModal(); return; }
    const a = t.dataset.act, id = t.dataset.id;
    if (a === 'simulate') { const s = stu(id); const m = s.milestones.find((x) => x.state === 'pendente'); if (m) { m.state = 'concluido'; save(); toast('Marco concluído. A faculdade já pode emitir a credencial.'); render(); } }
    else if (a === 'emit') emit(id, t.dataset.m);
    else if (a === 'interv') { stu(id).intervencao = true; save(); render(); }
    else if (a === 'revoke') { const c = stu(id).credentials.find((x) => x.id === t.dataset.c); c.revoked = true; c.visible = false; save(); toast('Credencial revogada (registro local neste MVP)'); render(); }
    else if (a === 'airdrop') { toast('Pedindo SOL de teste...', 15000); try { await SOL.airdrop(); toast('Recebeu 1 SOL de teste ✓'); refreshBal(); } catch (er) { toast('O airdrop da devnet falhou (limite comum). Copie o endereço e use faucet.solana.com', 8000); } }
    else if (a === 'phantom') { try { const ad = await SOL.connectPhantom(); $('#iaddr').textContent = ad; toast('Phantom conectada ✓'); refreshBal(); } catch (er) { toast(er.message, 6000); } }
    else if (a === 'accept') { toast('Plano aceito. O coordenador foi avisado.'); }
    else if (a === 'later') { toast('Tudo bem, a gente volta nisso depois.'); }
    else if (a === 'send') sendChat(id);
    else if (a === 'vis') { stu(id).credentials.find((c) => c.id === t.dataset.c).visible = t.checked; save(); }
    else if (a === 'optin') { const s = stu(id), h = ($('#handle').value || '').trim().replace(/^@/, ''); if (t.checked && !h) { t.checked = false; toast('Escolha um apelido primeiro.'); return; } s.handle = h; s.rankOptIn = t.checked; save(); render(); }
    else if (a === 'interest') { const i = S.interests.indexOf(id); if (i < 0) S.interests.push(id); else S.interests.splice(i, 1); save(); render(); }
    else if (a === 'share') { const c = stu(id).credentials.find((x) => x.id === t.dataset.c), url = shareLink(c); modal('<h2>' + esc(c.title) + '</h2><div class="qr" style="text-align:center">' + qrSvg(url) + '</div><p class="meta">Quem escanear verifica a credencial direto na Solana, sem contatar a faculdade.</p><input style="width:100%" readonly value="' + esc(url) + '" onclick="this.select()"><p><button class="btn" data-act="close">Fechar</button></p>'); }
    else if (a === 'detail') { const c = stu(id).credentials.find((x) => x.id === t.dataset.c); modal('<h2>' + esc(c.title) + '</h2><p class="hash">hash: ' + esc(c.hash) + '</p>' + (c.real ? '<p class="hash">tx: ' + esc(c.sig) + '</p><p class="hash">emissora: ' + esc(c.issuer) + '</p><a class="btn sec" target="_blank" rel="noopener" href="' + SOL.explorer(c.sig) + '">Ver no Solana Explorer</a>' : '<p class="meta">Credencial de demonstração, sem registro on-chain.</p>') + '<p><button class="btn" data-act="close">Fechar</button></p>'); }
    else if (a === 'close') closeModal();
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.act === 'filter') { window.__fl = t.value; render(); }
    else if (t.dataset.act === 'ecourse') { window.__ec = t.value; render(); }
  }
  function onInput(e) { if (e.target.id === 'fq') { window.__fq = e.target.value; const pos = e.target.selectionStart; render(); const el = $('#fq'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } } }
  function onKey(e) { if (e.key === 'Enter' && e.target.id === 'chatin') { const b = document.querySelector('[data-act=send]'); if (b) b.click(); } }

  function reply(s, text) {
    const r = risk(s), t = text.toLowerCase(), pend = s.milestones.filter((m) => m.state === 'pendente');
    if (/marco|credencial|pend/.test(t)) return pend.length ? 'Falta concluir: ' + pend.map((m) => m.title).join(' e ') + '. Quando concluir, sua faculdade emite a credencial na Solana.' : 'Você concluiu todos os seus marcos! Veja a credencial na aba Carteira.';
    if (/falta|nota|prova|dif[ií]cil|cansad|desanim|sumi|desist/.test(t)) return 'Obrigada por contar. ' + (r.level !== 'baixo' ? 'Vi que ' + r.reasons[0].t.toLowerCase() + '. ' : '') + 'Uma boa próxima etapa é: ' + r.sug.toLowerCase() + '. Se quiser, aceite a sugestão ao lado e o coordenador entra em contato. Eu não substituo apoio profissional.';
    if (/ranking|ponto/.test(t)) return 'O ranking premia evolução, não só nota. Quem se recupera de uma situação de risco ganha +40 de bônus. Aparecer nele é opcional.';
    return 'Entendi. Pode me contar como andam frequência e notas, ou perguntar sobre seus marcos e credenciais.';
  }
  function sendChat(id) {
    const inp = $('#chatin'), v = (inp.value || '').trim(); if (!v) return;
    window.__chat = window.__chat || {}; const arr = window.__chat[id] || [{ me: false, t: 'Oi! Estou aqui pra te ajudar nessa jornada. Pode me contar como estão as coisas ou perguntar sobre seus marcos. 💜' }];
    arr.push({ me: true, t: v }); arr.push({ me: false, t: reply(stu(id), v) }); window.__chat[id] = arr; render();
    const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight;
  }
  async function refreshBal() { const el = $('#ibal'); if (!el) return; try { const b = await SOL.balance(); el.textContent = 'Saldo: ' + b.toFixed(4) + ' SOL (devnet)'; } catch (e) { el.textContent = 'Saldo indisponível (RPC da devnet instável).'; } }

  // ---------- roteador ----------
  function render() {
    const h = location.hash.slice(1) || '/', [path, qs] = h.split('?'), parts = path.split('/').filter(Boolean);
    nav(path);
    let html;
    if (!parts.length) html = home();
    else if (parts[0] === 'faculdade') html = parts[1] ? faculdadeAluno(parts[1]) : faculdade();
    else if (parts[0] === 'aluno') html = parts[2] === 'carteira' ? carteira(parts[1]) : parts[2] === 'ranking' ? rankingView(parts[1]) : jornada(parts[1] || 'marina');
    else if (parts[0] === 'empresa') html = empresa();
    else if (parts[0] === 'verificar') html = verificar(qs || '');
    else html = home();
    app.innerHTML = html + '<footer class="s"><span class="link" data-act="reset">Reiniciar dados da demo</span></footer>';
    if (parts[0] === 'faculdade' && !parts[1]) refreshBal();
    if (parts[0] === 'verificar' && !new URLSearchParams(qs || '').get('demo')) runVerify(qs || '');
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-act=reset]'); if (r) { try { localStorage.removeItem(LS); } catch (er) {} S = load(); window.__chat = {}; render(); return; } onClick(e); });
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', render);
  render();
})();
