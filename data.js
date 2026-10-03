// Dados simulados do Persiste (hackathon). Nada aqui é dado real de aluno.
(function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fakeHash(seed) {
    const r = rng(seed); let h = '';
    for (let i = 0; i < 64; i++) h += Math.floor(r() * 16).toString(16);
    return h;
  }
  function mk(profile, seed) {
    const r = rng(seed);
    const f0 = 90 + r() * 8;
    const f1 = profile === 'alto' ? 48 + r() * 12 : profile === 'med' ? 66 + r() * 8 : 84 + r() * 10;
    const freq = Array.from({ length: 8 }, (_, i) => Math.round(f0 + (f1 - f0) * (i / 7) + (r() - 0.5) * 3));
    const base = profile === 'alto' ? 4.2 : profile === 'med' ? 5.6 : 7.2;
    const notas = Array.from({ length: 8 }, () => +Math.max(0, Math.min(10, base + (r() - 0.5) * 1.6)).toFixed(1));
    const ac = profile === 'alto' ? [12, 8, 4, 2] : profile === 'med' ? [10, 8, 7, 6] : [10, 11, 9, 11];
    const acessos = ac.map((v) => Math.max(0, v + Math.round((r() - 0.5) * 2)));
    const dias = profile === 'alto' ? 14 + Math.floor(r() * 14) : profile === 'med' ? 4 + Math.floor(r() * 8) : Math.floor(r() * 4);
    return { freq, notas, acessos, diasSemPortal: dias };
  }
  function cred(id, title, tipo, date, seed) {
    return { id, title, tipo, date, hash: fakeHash(seed), sig: null, issuer: null, payload: null, visible: true, revoked: false, real: false };
  }

  const hero = [
    {
      id: 'marina', name: 'Marina Souza', course: 'Engenharia Civil', period: 4,
      freq: [95, 92, 89, 85, 79, 72, 64, 55], notas: [5.2, 6.1, 4.8, 5.7, 4.1, 5.6, 3.9, 4.4],
      acessos: [12, 8, 5, 3], diasSemPortal: 21,
      milestones: [
        { id: 'm1', type: 'monitoria', title: 'Monitoria de Cálculo I', desc: 'Participação em monitoria para reforço de Cálculo I', state: 'pendente' },
        { id: 'm2', type: 'frequencia', title: 'Plano de Frequência', desc: 'Recuperação da frequência acima de 75%', state: 'pendente' },
      ],
      credentials: [], intervencao: false, rankOptIn: false, handle: 'engenharia401',
    },
    {
      id: 'rafael', name: 'Rafael Lima', course: 'Ciência da Computação', period: 2,
      freq: [78, 80, 80, 82, 81, 83, 82, 82], notas: [5.8, 5.6, 6.2, 8.0, 5.1, 7.0, 7.1, 5.2],
      acessos: [10, 12, 9, 11], diasSemPortal: 2,
      milestones: [
        { id: 'm1', type: 'nota', title: 'Recuperação de Programação I', desc: 'Recuperação da nota em Programação I', state: 'pendente' },
        { id: 'm2', type: 'projeto', title: 'Projeto de Banco de Dados', desc: 'Modelagem e implementação de banco relacional', state: 'emitida' },
      ],
      credentials: [cred('c-raf-1', 'Projeto de Banco de Dados', 'projeto', '2026-09-13', 11)],
      intervencao: false, rankOptIn: true, handle: 'ciencia401',
    },
    {
      id: 'camila', name: 'Camila Ferreira', course: 'Administração', period: 6,
      freq: [91, 88, 85, 82, 79, 76, 73, 70], notas: [6.0, 5.5, 5.9, 5.4, 5.7, 5.2, 5.8, 5.5],
      acessos: [10, 8, 7, 6], diasSemPortal: 5,
      milestones: [
        { id: 'm1', type: 'avaliacao', title: 'Avaliação Prática de Gestão', desc: 'Aprovação em avaliação prática', state: 'emitida' },
        { id: 'm2', type: 'monitoria', title: 'Monitoria de Contabilidade', desc: 'Participação em monitoria', state: 'emitida' },
        { id: 'm3', type: 'projeto', title: 'Projeto de Plano de Negócios', desc: 'Projeto avaliado por professor', state: 'emitida' },
      ],
      credentials: [
        cred('c-cam-1', 'Avaliação Prática de Gestão', 'avaliacao', '2026-08-20', 21),
        cred('c-cam-2', 'Monitoria de Contabilidade', 'monitoria', '2026-09-02', 22),
        cred('c-cam-3', 'Projeto de Plano de Negócios', 'projeto', '2026-09-20', 23),
      ],
      intervencao: false, rankOptIn: true, handle: 'administracao717',
    },
  ];

  const others = [
    ['Karen Oliveira', 'Engenharia Civil', 4, 'med'], ['Carla Costa', 'Psicologia', 7, 'med'],
    ['Bruno Tavares', 'Direito', 3, 'alto'], ['Larissa Mendes', 'Medicina', 5, 'ok'],
    ['Pedro Rocha', 'Engenharia Civil', 2, 'alto'], ['Julia Andrade', 'Administração', 8, 'ok'],
    ['Thiago Nunes', 'Ciência da Computação', 6, 'med'], ['Fernanda Alves', 'Psicologia', 3, 'ok'],
    ['Diego Martins', 'Direito', 5, 'med'], ['Isabela Cardoso', 'Medicina', 1, 'ok'],
    ['Lucas Barros', 'Administração', 4, 'alto'], ['Aline Pires', 'Engenharia Civil', 6, 'ok'],
    ['Gabriel Dias', 'Ciência da Computação', 3, 'med'], ['Renata Lopes', 'Direito', 7, 'ok'],
    ['Vitor Gomes', 'Psicologia', 2, 'med'], ['Beatriz Ramos', 'Medicina', 4, 'ok'],
    ['Caio Freitas', 'Administração', 2, 'ok'],
  ];
  const generated = others.map((o, i) => ({
    id: 'a' + i, name: o[0], course: o[1], period: o[2], ...mk(o[3], 100 + i * 7),
    milestones: [], credentials: [], intervencao: i % 5 === 0 && o[3] !== 'ok', rankOptIn: false, handle: '',
  }));

  window.SEED_STUDENTS = hero.concat(generated);
  // Ranking de demonstração (SIMULADO, fora da blockchain)
  window.RANK_SEED = [
    { handle: 'direito233', course: 'Direito', pts: 85, creds: 2, evol: true },
    { handle: 'medicina118', course: 'Medicina', pts: 70, creds: 2, evol: false },
  ];
  window.PTS = { monitoria: 20, nota: 25, projeto: 30, avaliacao: 30, frequencia: 15 };
})();
