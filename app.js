// Monta as telas a partir de MODULOS, valida os campos, calcula e desenha os resultados e o gráfico.
const $ = id => document.getElementById(id);

// ---------- Construção da interface ----------
function htmlCampo(c) {
  let ctl;
  if (c.tipo === "select") {
    ctl = `<select name="${c.n}">${c.opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
  } else if (c.tipo === "area") {
    ctl = `<textarea name="${c.n}" rows="4" placeholder="${c.ph || ""}"></textarea>`;
  } else {
    ctl = `<input name="${c.n}" type="number" step="any" inputmode="decimal" placeholder="${c.ph || ""}">`;
  }
  let un = "";
  if (c.k) {
    un = `<select class="un" name="${c.n}_u" aria-label="Unidade de ${c.l}">${Object.keys(Units[c.k]).map(u => `<option>${u}</option>`).join("")}</select>`;
  } else if (c.sufixo) {
    un = `<span class="suf">${c.sufixo}</span>`;
  }
  return `<label class="${c.tipo === "area" ? "wide" : ""}">${c.l}${c.ajuda ? `<small>${c.ajuda}</small>` : ""}<span class="row">${ctl}${un}</span><span class="err" data-err="${c.n}"></span></label>`;
}

function htmlSaidas(m) {
  const sel = (nome, kind, padrao, rotulo) =>
    `<label>${rotulo}<select data-saida="${nome}">${Object.keys(Units[kind]).map(u => `<option${u === padrao ? " selected" : ""}>${u}</option>`).join("")}</select></label>`;
  return m.saidas.map(s => (s === "potencia" ? sel("pu", "potencia", m.puPadrao || "W", "Potência em") : sel("tu", "torque", "N·m", "Torque em"))).join("");
}

Object.entries(MODULOS).forEach(([id, m], i) => {
  $("abas").insertAdjacentHTML("beforeend", `<button class="tab${i ? "" : " active"}" data-tab="${id}" role="tab">${m.titulo}</button>`);
  $("app").insertAdjacentHTML("beforeend",
    `<section id="${id}" class="panel${i ? "" : " active"}">
      <form autocomplete="off">${m.campos.map(htmlCampo).join("")}</form>
      <div class="saidas">${htmlSaidas(m)}</div>
      <div class="avisos" id="av-${id}"></div>
      <dl class="results" id="res-${id}"></dl>
      <p class="nota memo">Os campos são convertidos para N·m, RPM, W, V, A, mAh e cm³ antes do cálculo.</p>
      <figure class="grafico" id="graf-${id}"></figure>
    </section>`);
});

// ---------- Leitura e validação ----------
function ler(form, m) {
  const v = {}, erros = {};
  m.campos.forEach(c => {
    const el = form.elements[c.n];
    if (c.tipo === "select") { v[c.n] = el.value; return; }
    if (c.tipo === "area") { v[c.n] = el.value.trim(); v[c.n + "_u"] = form.elements[c.n + "_u"].value; return; }
    if (el.value === "") { v[c.n] = null; return; }
    const x = parseFloat(el.value);
    if (isNaN(x)) { v[c.n] = null; return; }
    if (c.min !== undefined && x < c.min) { erros[c.n] = `Valor mínimo: ${c.min}`; v[c.n] = null; return; }
    if (c.max !== undefined && x > c.max) { erros[c.n] = `Valor máximo: ${c.max}`; v[c.n] = null; return; }
    v[c.n] = c.k ? Units.toBase(c.k, x, form.elements[c.n + "_u"].value) : x;
  });
  return { v, erros };
}

// ---------- Gráfico (SVG) ----------
const nice = x => {
  if (!(x > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / e;
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => s >= f * 0.9999) || 10) * e;
};
const tick = x => Number(x.toPrecision(3)).toLocaleString("pt-BR");

function grafico(cv, pu) {
  const W = 420, H = 300, M = { l: 50, r: 50, t: 30, b: 42 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const tu = Math.max(...cv.pts.map(p => p.T)) < 0.1 ? "mN·m" : "N·m";
  const T = p => Units.fromBase("torque", p.T, tu);
  const P = p => Units.fromBase("potencia", p.P, pu);
  const xmax = nice(Math.max(...cv.pts.map(p => p.rpm)));
  const tmax = nice(Math.max(...cv.pts.map(T)));
  const pmax = nice(Math.max(...cv.pts.map(P)));
  const X = r => M.l + (iw * r) / xmax;
  const Yt = t => M.t + ih * (1 - t / tmax);
  const Yp = p => M.t + ih * (1 - p / pmax);

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curvas de torque e potência por rotação">`;
  for (let i = 0; i <= 5; i++) {
    const y = M.t + (ih * i) / 5, x = M.l + (iw * i) / 5;
    s += `<line class="grade" x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}"/>`;
    s += `<text class="tt" x="${M.l - 6}" y="${y + 4}" text-anchor="end">${tick((tmax * (5 - i)) / 5)}</text>`;
    s += `<text class="tp" x="${W - M.r + 6}" y="${y + 4}">${tick((pmax * (5 - i)) / 5)}</text>`;
    s += `<text class="tx" x="${x}" y="${H - M.b + 16}" text-anchor="middle">${tick((xmax * i) / 5)}</text>`;
  }
  s += `<text class="tt" x="${M.l}" y="14">Torque (${tu})</text>`;
  s += `<text class="tp" x="${W - M.r}" y="14" text-anchor="end">Potência (${pu})</text>`;
  s += `<text class="tx" x="${M.l + iw / 2}" y="${H - 6}" text-anchor="middle">Rotação (RPM)</text>`;
  const linha = (f, Y, cls) => `<polyline class="${cls}" points="${cv.pts.map(p => `${X(p.rpm).toFixed(1)},${Y(f(p)).toFixed(1)}`).join(" ")}"/>`;
  s += linha(T, Yt, "lt") + linha(P, Yp, "lp");
  if (cv.op) {
    const pOp = { T: cv.op.T, P: cv.op.T * Calc.omega(cv.op.rpm) };
    s += `<circle class="mt" cx="${X(cv.op.rpm)}" cy="${Yt(T(pOp))}" r="5"/><circle class="mp" cx="${X(cv.op.rpm)}" cy="${Yp(P(pOp))}" r="5"/>`;
  }
  s += "</svg>";

  const pp = cv.pts.reduce((a, p) => (P(p) > P(a) ? p : a));
  const tp = cv.pts.reduce((a, p) => (T(p) > T(a) ? p : a));
  const cap = `Pico de potência: ${fmt(P(pp))} ${pu} a ${fmt(pp.rpm, 0)} RPM. Pico de torque: ${fmt(T(tp))} ${tu} a ${fmt(tp.rpm, 0)} RPM. ${cv.op ? "Os círculos marcam o ponto de operação. " : ""}${cv.nota}`;
  return `${s}<figcaption>${cap}</figcaption>`;
}

// ---------- Renderização ----------
function render(id) {
  const m = MODULOS[id], painel = $(id), form = painel.querySelector("form");
  const { v, erros } = ler(form, m);
  form.querySelectorAll("[data-err]").forEach(s => (s.textContent = erros[s.dataset.err] || ""));
  form.querySelectorAll("input").forEach(i => i.classList.toggle("invalid", !!erros[i.name]));

  const ctx = {
    pu: painel.querySelector('[data-saida="pu"]')?.value || m.puPadrao || "W",
    tu: painel.querySelector('[data-saida="tu"]')?.value || "N·m"
  };
  const r = m.calcular(v, ctx);

  const preenchido = r.rows.some(x => x.v !== "—");
  $("res-" + id).innerHTML = preenchido
    ? r.rows.map(x => `<div class="item"><dt>${x.k}</dt><dd>${x.v}</dd>${x.m ? `<dd class="memo">${x.m}</dd>` : ""}</div>`).join("")
    : '<div class="vazio">Preencha os campos para ver os resultados.</div>';

  $("av-" + id).innerHTML = r.av.length ? `<ul>${r.av.map(a => `<li>${a}</li>`).join("")}</ul>` : "";

  $("graf-" + id).innerHTML = r.curva
    ? grafico(r.curva, ctx.pu)
    : m.dica ? `<p class="dica">${m.dica}</p>` : "";
}

// ---------- Eventos ----------
document.querySelectorAll(".tab").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  })
);

$("app").addEventListener("input", e => render(e.target.closest("section").id));
$("app").addEventListener("change", e => render(e.target.closest("section").id));
$("memo").addEventListener("change", e => document.body.classList.toggle("sem-memo", !e.target.checked));
document.querySelectorAll("form").forEach(f => f.addEventListener("submit", e => e.preventDefault()));

Object.keys(MODULOS).forEach(render);
