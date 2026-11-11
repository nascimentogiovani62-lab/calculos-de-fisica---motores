// Definição dos módulos: campos, fórmulas com memória de cálculo e avisos.
const fmt = (n, d = 3) =>
  n === null || n === undefined || !isFinite(n) ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
const n4 = x => fmt(x, 4);
const tempo = h => (h < 1 ? `${fmt(h * 60, 1)} min` : `${fmt(h, 2)} h`);

// Linha de resultado: rótulo, valor formatado e memória de cálculo
const L = (k, x, fv, memo) => {
  const vazio = x === null || x === undefined || !isFinite(x);
  return { k, v: vazio ? "—" : fv(x), m: vazio ? null : memo() };
};

// Densidade (kg/L) e poder calorífico inferior (kJ/kg)
const COMB = {
  gasolina: { nome: "Gasolina (0,75 kg/L)", d: 0.75, pci: 43500 },
  etanol: { nome: "Etanol (0,79 kg/L)", d: 0.79, pci: 26900 },
  diesel: { nome: "Diesel (0,84 kg/L)", d: 0.84, pci: 42600 }
};

const MODULOS = {
  eletrico: {
    titulo: "Elétrico",
    saidas: ["potencia"],
    puPadrao: "W",
    dica: "Para ver o gráfico, preencha a rotação sem carga e o torque de travamento.",
    campos: [
      { n: "V", l: "Tensão", k: "tensao", min: 0 },
      { n: "I", l: "Corrente", k: "corrente", min: 0 },
      { n: "rpm", l: "Rotação de operação", k: "rotacao", min: 0 },
      { n: "T", l: "Torque de operação", k: "torque", min: 0 },
      { n: "n0", l: "Rotação sem carga", k: "rotacao", min: 0, ajuda: "para o gráfico" },
      { n: "Tst", l: "Torque de travamento", k: "torque", min: 0, ajuda: "para o gráfico" },
      { n: "mAh", l: "Capacidade da bateria", k: "carga", min: 0 }
    ],
    calcular(v, c) {
      const r = Calc.eletrico({ V: v.V, I: v.I, rpm: v.rpm, T: v.T, mAh: v.mAh });
      const pot = x => `${fmt(Units.fromBase("potencia", x, c.pu))} ${c.pu}`;
      const pmax = ok(v.Tst, v.n0) ? (v.Tst * Calc.omega(v.n0)) / 4 : null;
      const rows = [
        L("Potência elétrica", r.Pe, pot, () => `P = V × I = ${n4(v.V)} × ${n4(v.I)} = ${n4(r.Pe)} W`),
        L("Potência mecânica", r.Pm, pot, () => `P = T × ω = ${n4(v.T)} × (2π × ${n4(v.rpm)} ÷ 60) = ${n4(r.Pm)} W`),
        L("Eficiência", r.eficiencia, x => `${fmt(x, 1)} %`, () => `η = Pmec ÷ Pelé × 100 = ${n4(r.Pm)} ÷ ${n4(r.Pe)} × 100 = ${n4(r.eficiencia)} %`),
        L("Perdas (calor)", r.perdas, pot, () => `Pelé − Pmec = ${n4(r.Pe)} − ${n4(r.Pm)} = ${n4(r.perdas)} W`),
        L("Energia da bateria", r.Wh, x => `${fmt(x)} Wh`, () => `E = V × C ÷ 1000 = ${n4(v.V)} × ${n4(v.mAh)} ÷ 1000 = ${n4(r.Wh)} Wh`),
        L("Autonomia", r.horas, tempo, () => `t = E ÷ P = ${n4(r.Wh)} Wh ÷ ${n4(r.Pe)} W = ${n4(r.horas)} h`),
        L("Potência máxima do motor", pmax, pot, () => `Pmáx = Tst × ω0 ÷ 4 = ${n4(v.Tst)} × (2π × ${n4(v.n0)} ÷ 60) ÷ 4 = ${n4(pmax)} W`)
      ];
      const av = [];
      if (r.eficiencia > 100) av.push("Eficiência acima de 100%: a potência mecânica não pode superar a elétrica. Confira tensão, corrente, torque e rotação.");
      if (ok(v.rpm, v.n0) && v.rpm > v.n0) av.push("A rotação de operação é maior que a rotação sem carga.");
      if (ok(v.T, v.Tst) && v.T > v.Tst) av.push("O torque de operação é maior que o torque de travamento.");
      if (ok(v.rpm, v.n0, v.T, v.Tst) && v.rpm <= v.n0) {
        const Te = v.Tst * (1 - v.rpm / v.n0);
        if (Te > 0 && Math.abs(v.T - Te) / Te > 0.5) av.push("O ponto de operação está longe da curva do motor (mais de 50% de diferença no torque).");
      }
      const pts = Calc.curvaEletrica(v.n0, v.Tst);
      const curva = pts ? { pts, op: ok(v.rpm, v.T) ? { rpm: v.rpm, T: v.T } : null, nota: "Modelo linear de motor DC: T = Tst × (1 − n ÷ n₀)." } : null;
      return { rows, av, curva };
    }
  },

  combustao: {
    titulo: "Combustão",
    saidas: ["potencia"],
    puPadrao: "kW",
    dica: "Para ver o gráfico, cole pontos medidos no campo de curva (RPM; torque, um por linha).",
    campos: [
      { n: "Vd", l: "Cilindrada total", k: "volume", min: 0 },
      { n: "tempos", l: "Ciclo", tipo: "select", opcoes: [["4", "4 tempos"], ["2", "2 tempos"]] },
      { n: "rpm", l: "Rotação", k: "rotacao", min: 0 },
      { n: "T", l: "Torque", k: "torque", min: 0 },
      { n: "bsfc", l: "Consumo específico (BSFC)", sufixo: "g/kWh", min: 0, ph: "ex.: 250" },
      { n: "comb", l: "Combustível", tipo: "select", opcoes: Object.entries(COMB).map(([k, x]) => [k, x.nome]) },
      { n: "preco", l: "Preço do combustível", sufixo: "R$/L", min: 0 },
      { n: "tanque", l: "Tanque", k: "litros", min: 0 },
      { n: "vel", l: "Velocidade (opcional)", k: "velocidade", min: 0 },
      { n: "curva", l: "Curva medida (opcional)", tipo: "area", k: "torque", ajuda: "um ponto por linha: RPM; torque", ph: "3000; 110&#10;4000; 125&#10;5000; 120" }
    ],
    calcular(v, c) {
      const cb = COMB[v.comb];
      const t = parseInt(v.tempos, 10);
      const r = Calc.combustao({ Vd: v.Vd, rpm: v.rpm, T: v.T, tempos: t, bsfc: v.bsfc, dens: cb.d, preco: v.preco, tanque: v.tanque, vel: v.vel, pci: cb.pci });
      const pot = x => `${fmt(Units.fromBase("potencia", x, c.pu))} ${c.pu}`;
      const rows = [
        L("Potência", r.Pm, pot, () => `P = T × ω = ${n4(v.T)} × (2π × ${n4(v.rpm)} ÷ 60) = ${n4(r.Pm)} W`),
        L("Pressão média efetiva", r.pme, x => `${fmt(x, 2)} bar`, () => `PME = ${t === 4 ? "4π" : "2π"} × T ÷ Vd = ${t === 4 ? "4π" : "2π"} × ${n4(v.T)} ÷ ${n4(v.Vd * 1e-6)} m³ ÷ 10⁵ = ${n4(r.pme)} bar`),
        L("Consumo em massa", r.kgh, x => `${fmt(x)} kg/h`, () => `ṁ = P(kW) × BSFC ÷ 1000 = ${n4(r.Pm / 1000)} × ${n4(v.bsfc)} ÷ 1000 = ${n4(r.kgh)} kg/h`),
        L("Consumo em volume", r.lh, x => `${fmt(x)} L/h`, () => `V̇ = ṁ ÷ ρ = ${n4(r.kgh)} ÷ ${cb.d} = ${n4(r.lh)} L/h`),
        L("Custo por hora", r.custoH, x => `R$ ${fmt(x, 2)}/h`, () => `custo = V̇ × preço = ${n4(r.lh)} × ${n4(v.preco)} = R$ ${n4(r.custoH)}/h`),
        L("Autonomia do tanque", r.horas, tempo, () => `t = tanque ÷ V̇ = ${n4(v.tanque)} ÷ ${n4(r.lh)} = ${n4(r.horas)} h`),
        L("Rendimento", r.kml, x => `${fmt(x, 2)} km/L`, () => `v ÷ V̇ = ${n4(v.vel)} ÷ ${n4(r.lh)} = ${n4(r.kml)} km/L`),
        L("Eficiência térmica", r.etaTerm, x => `${fmt(x * 100, 1)} %`, () => `η = 3,6×10⁶ ÷ (BSFC × PCI) = 3,6×10⁶ ÷ (${n4(v.bsfc)} × ${cb.pci}) = ${n4(r.etaTerm * 100)} %`)
      ];
      const av = [];
      if (r.pme > 30) av.push("Pressão média efetiva acima de 30 bar: fora do realista, mesmo para motores turbo. Confira torque e cilindrada.");
      if (r.etaTerm > 0.5) av.push("Eficiência térmica acima de 50%: acima do melhor motor de combustão existente. Confira o consumo específico.");
      if (ok(v.rpm) && v.rpm > 20000) av.push("Rotação acima de 20.000 RPM: confira se a unidade está correta.");
      let curva = null;
      if (v.curva) {
        const pts = Calc.curvaDeTexto(v.curva, Units.torque[v.curva_u]);
        if (pts) curva = { pts, op: ok(v.rpm, v.T) ? { rpm: v.rpm, T: v.T } : null, nota: "Curva feita com os pontos informados." };
        else av.push("Curva: informe pelo menos 2 linhas no formato RPM; torque.");
      }
      return { rows, av, curva };
    }
  },

  transmissao: {
    titulo: "Transmissão",
    saidas: ["potencia", "torque"],
    puPadrao: "W",
    campos: [
      { n: "Ze", l: "Dentes da engrenagem motora", sufixo: "dentes", min: 1 },
      { n: "Zs", l: "Dentes da engrenagem movida", sufixo: "dentes", min: 1 },
      { n: "eta", l: "Eficiência", sufixo: "%", min: 0, max: 100, ph: "100" },
      { n: "rpm", l: "Rotação de entrada", k: "rotacao", min: 0 },
      { n: "T", l: "Torque de entrada", k: "torque", min: 0 }
    ],
    calcular(v, c) {
      const r = Calc.transmissao({ Ze: v.Ze, Zs: v.Zs, eta: v.eta, rpm: v.rpm, T: v.T });
      const pot = x => `${fmt(Units.fromBase("potencia", x, c.pu))} ${c.pu}`;
      const tq = x => `${fmt(Units.fromBase("torque", x, c.tu), 4)} ${c.tu}`;
      const rows = [
        L("Relação de transmissão", r.i, x => `${fmt(x)} : 1`, () => `i = Zs ÷ Ze = ${v.Zs} ÷ ${v.Ze} = ${n4(r.i)}`),
        L("Rotação de saída", r.rpmSaida, x => `${fmt(x, 2)} RPM`, () => `n₂ = n₁ ÷ i = ${n4(v.rpm)} ÷ ${n4(r.i)} = ${n4(r.rpmSaida)} RPM`),
        L("Torque de saída", r.Tsaida, tq, () => `T₂ = T₁ × i × η ÷ 100 = ${n4(v.T)} × ${n4(r.i)} × ${n4(r.e)} ÷ 100 = ${n4(r.Tsaida)} N·m`),
        L("Potência de entrada", r.Pent, pot, () => `P₁ = T₁ × ω₁ = ${n4(v.T)} × (2π × ${n4(v.rpm)} ÷ 60) = ${n4(r.Pent)} W`),
        L("Potência de saída", r.Psaida, pot, () => `P₂ = P₁ × η ÷ 100 = ${n4(r.Pent)} × ${n4(r.e)} ÷ 100 = ${n4(r.Psaida)} W`)
      ];
      const av = [];
      if (ok(v.Ze) && !Number.isInteger(v.Ze)) av.push("O número de dentes da engrenagem motora deve ser inteiro.");
      if (ok(v.Zs) && !Number.isInteger(v.Zs)) av.push("O número de dentes da engrenagem movida deve ser inteiro.");
      if (v.eta === 0) av.push("Eficiência de 0%: nenhuma potência chega à saída.");
      return { rows, av, curva: null };
    }
  }
};
