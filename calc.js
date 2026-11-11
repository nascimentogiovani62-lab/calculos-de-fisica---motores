// Fórmulas puras: entram números (em unidades base), saem números (ou null se faltar dado).
// Torque em N·m, potência em W, rotação em RPM, volume em cm³.
const ok = (...v) => v.every(x => x !== null && x !== undefined && isFinite(x));

const Calc = {
  omega(rpm) { return (rpm * 2 * Math.PI) / 60; },

  // P = T · ω
  potenciaMecanica(T, rpm) { return ok(T, rpm) ? T * Calc.omega(rpm) : null; },

  eletrico({ V, I, rpm, T, mAh }) {
    const Pe = ok(V, I) ? V * I : null;
    const Pm = Calc.potenciaMecanica(T, rpm);
    const eficiencia = ok(Pe, Pm) && Pe > 0 ? (Pm / Pe) * 100 : null;
    const perdas = ok(Pe, Pm) ? Pe - Pm : null;
    const Wh = ok(V, mAh) ? (V * mAh) / 1000 : null;
    const horas = ok(Wh, Pe) && Pe > 0 ? Wh / Pe : null;
    return { Pe, Pm, eficiencia, perdas, Wh, horas };
  },

  // Modelo linear de motor DC: T = Tst · (1 − n / n0)
  curvaEletrica(n0, Tst, passos = 40) {
    if (!ok(n0, Tst) || n0 <= 0 || Tst <= 0) return null;
    return Array.from({ length: passos + 1 }, (_, i) => {
      const rpm = (n0 * i) / passos;
      const T = Tst * (1 - rpm / n0);
      return { rpm, T, P: T * Calc.omega(rpm) };
    });
  },

  // Texto com uma linha por ponto: "RPM; torque". fator converte o torque para N·m.
  curvaDeTexto(txt, fator) {
    const pts = [];
    String(txt).split(/\n/).forEach(l => {
      const t = l.trim().split(/[;\t ]+/);
      if (t.length < 2) return;
      const rpm = parseFloat(t[0].replace(",", "."));
      const x = parseFloat(t[1].replace(",", "."));
      if (ok(rpm, x) && rpm >= 0 && x >= 0) pts.push({ rpm, T: x * fator, P: x * fator * Calc.omega(rpm) });
    });
    pts.sort((a, b) => a.rpm - b.rpm);
    return pts.length >= 2 ? pts : null;
  },

  // tempos: 4 ou 2. bsfc em g/kWh, dens em kg/L, pci em kJ/kg.
  combustao({ Vd, rpm, T, tempos, bsfc, dens, preco, tanque, vel, pci }) {
    const Pm = Calc.potenciaMecanica(T, rpm);
    // PME = (tempos/2 · 2π · T) / Vd, em bar
    const pme = ok(T, Vd) && Vd > 0 ? ((tempos === 4 ? 4 : 2) * Math.PI * T) / (Vd * 1e-6) / 1e5 : null;
    const kgh = ok(Pm, bsfc) ? ((Pm / 1000) * bsfc) / 1000 : null;
    const lh = ok(kgh, dens) && dens > 0 ? kgh / dens : null;
    const custoH = ok(lh, preco) ? lh * preco : null;
    const horas = ok(lh, tanque) && lh > 0 ? tanque / lh : null;
    const kml = ok(lh, vel) && lh > 0 ? vel / lh : null;
    const etaTerm = ok(bsfc, pci) && bsfc > 0 ? 3.6e6 / (bsfc * pci) : null;
    return { Pm, pme, kgh, lh, custoH, horas, kml, etaTerm };
  },

  transmissao({ Ze, Zs, eta, rpm, T }) {
    const e = ok(eta) ? eta : 100;
    const i = ok(Ze, Zs) && Ze > 0 ? Zs / Ze : null;
    const rpmSaida = ok(rpm, i) && i > 0 ? rpm / i : null;
    const Tsaida = ok(T, i) ? (T * i * e) / 100 : null;
    const Pent = Calc.potenciaMecanica(T, rpm);
    const Psaida = ok(Pent) ? (Pent * e) / 100 : null;
    return { i, rpmSaida, Tsaida, Pent, Psaida, e };
  }
};
