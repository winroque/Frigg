/*
 * ui.js — Renderização dos formulários e das notas de cálculo ao vivo.
 */
import { EXAMS } from "./exams.js";
import * as C from "./calc.js";
import * as R from "./references.js";
import { state, setValue } from "./state.js";

const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const nf = (v, d = 1) => (v == null || !isFinite(v) ? "—" : Number(v).toFixed(d).replace(".", ","));
const fmtDate = (dt) => dt ? `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}` : "—";

let noteRefs = [];   // {key, node, field}
let condRefs = [];   // {field, wrapper}

export function renderForm(container) {
  container.innerHTML = "";
  noteRefs = []; condRefs = [];
  const exam = EXAMS[state.exam];
  if (exam.subtitle) {
    const st = el("div", "card");
    st.innerHTML = `<div class="body" style="padding:10px 15px;color:var(--muted);font-size:12.5px">${exam.icon} <strong style="color:var(--ink)">${exam.name}</strong> — ${exam.subtitle}</div>`;
    container.appendChild(st);
  }
  for (const sec of exam.sections) {
    const card = renderSection(sec);
    container.appendChild(card);
    if (sec.showIf) condRefs.push({ field: sec, wrapper: card });
  }
  refresh(); // preenche notas
}

function renderSection(sec) {
  const card = el("div", "card");
  const h = el("h2");
  h.appendChild(el("span", null, sec.title));
  if (sec.optional) h.appendChild(el("span", "badge-opt", "opcional"));
  card.appendChild(h);
  const body = el("div", "body");
  const grid = el("div", "fields");
  for (const f of sec.fields) {
    const wrap = renderField(f);
    grid.appendChild(wrap);
    if (f.showIf) condRefs.push({ field: f, wrapper: wrap });
  }
  body.appendChild(grid);
  card.appendChild(body);
  return card;
}

function renderField(f) {
  const span = f.cols === 3 ? "col3" : f.cols === 2 ? "col2" : "col1";

  if (f.type === "note") {
    const note = el("div", "calcnote col3");
    note.dataset.k = f.compute;
    noteRefs.push({ key: f.compute, node: note, field: f });
    return note;
  }

  const wrap = el("div", `field ${span}${f.type === "check" ? " check" : ""}`);
  const cur = state.values[f.id];

  if (f.type === "check") {
    const input = el("input"); input.type = "checkbox"; input.id = `fld_${f.id}`;
    input.checked = !!cur;
    input.addEventListener("change", () => setValue(f.id, input.checked ? "1" : ""));
    const lab = el("label", null, f.label); lab.htmlFor = `fld_${f.id}`;
    wrap.append(input, lab);
    return wrap;
  }

  const lab = el("label");
  lab.append(document.createTextNode(f.label));
  if (f.hint) lab.appendChild(el("span", "hint", ` — ${f.hint}`));
  wrap.appendChild(lab);

  if (f.type === "seg") {
    const seg = el("div", "seg");
    const val = cur != null ? cur : f.default;
    for (const opt of f.opts) {
      const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
      const b = el("button", val === v ? "on" : null, label); b.type = "button";
      b.addEventListener("click", () => { setValue(f.id, v); });
      seg.appendChild(b);
    }
    wrap.appendChild(seg);
    return wrap;
  }

  if (f.type === "select") {
    const sel = el("select");
    if (!f.default) sel.appendChild(new Option("—", ""));
    for (const opt of f.opts) {
      const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
      sel.appendChild(new Option(label, v));
    }
    sel.value = cur != null ? cur : (f.default || "");
    if (f.default && cur == null) setValueSilent(f.id, f.default);
    sel.addEventListener("change", () => setValue(f.id, sel.value));
    wrap.appendChild(sel);
    return wrap;
  }

  if (f.type === "textarea") {
    const ta = el("textarea"); ta.value = cur || ""; if (f.placeholder) ta.placeholder = f.placeholder;
    ta.addEventListener("input", () => setValue(f.id, ta.value));
    wrap.appendChild(ta);
    return wrap;
  }

  // num / text / date
  const mkInput = () => {
    const input = el("input");
    if (f.type === "num") { input.type = "number"; input.step = "any"; input.inputMode = "decimal"; }
    else if (f.type === "date") input.type = "date";
    else input.type = "text";
    if (f.placeholder) input.placeholder = f.placeholder;
    input.value = cur != null ? cur : "";
    input.addEventListener("input", () => setValue(f.id, input.value));
    return input;
  };
  if (f.unit) {
    const uw = el("div", "with-unit");
    uw.appendChild(mkInput());
    uw.appendChild(el("span", "unit", f.unit));
    wrap.appendChild(uw);
  } else wrap.appendChild(mkInput());
  return wrap;
}

// escreve default sem re-render/loop
function setValueSilent(id, v) { if (state.values[id] == null) state.values[id] = v; }

/* ---------- atualização das notas + visibilidade condicional ---------- */
export function refresh() {
  const s = state.values;
  // visibilidade condicional
  for (const { field, wrapper } of condRefs) {
    wrapper.style.display = field.showIf(s) ? "" : "none";
  }
  const dating = C.computeDating(s);
  const gaW = dating.bestGaWeeks || null;
  for (const { key, node } of noteRefs) {
    node.innerHTML = computeNoteHtml(key, s, dating, gaW);
  }
}

function chip(txt, cls = "neutro") { return `<span class="chip ${cls}">${txt}</span>`; }

function computeNoteHtml(key, s, dating, gaW) {
  switch (key) {
    case "dating": {
      if (!dating.best) return `<span class="k">Informe DUM, IG (mãe), USG anterior, CCN ou biometria.</span>`;
      let h = `<span class="k">IG:</span> ${chip(R.formatGaDays(dating.bestGaDays))} <span class="k">por ${dating.best.label}</span>`;
      if (dating.override) h += ` ${chip("referência escolhida", "neutro")}`;
      if (dating.presumida && dating.presumedLMP) h += ` · <span class="k">DUM presumida:</span> ${fmtDate(dating.presumedLMP)}`;
      if (dating.edd) h += ` · <span class="k">DPP:</span> ${fmtDate(dating.edd)}`;
      if (dating.agreement) {
        h += dating.agreement.concordante
          ? ` · ${chip("concordante c/ DUM", "ok")}`
          : ` · ${chip(`discorda da DUM (${dating.agreement.diffDays}d)`, "alerta")}`;
      }
      // fontes múltiplas
      if (dating.sources.length > 1) {
        const others = dating.sources.map((x) => `${x.label} ${R.formatGaDays(x.gaDays)}`).join(" · ");
        h += `<br><span class="k" style="font-size:11px">${others}</span>`;
      }
      return h;
    }
    case "ratios": {
      const rs = C.computeRatios(s, gaW);
      if (!rs) return `<span class="k">Preencha as biometrias (e DOF para o índice cefálico).</span>`;
      return rs.map((r) => {
        const cls = r.status === "ok" ? "ok" : r.status === "na" ? "neutro" : "alerta";
        const val = r.unit === "%" ? `${Math.round(r.value)}%` : r.value.toFixed(2);
        return `<span class="k">${r.label}:</span> ${chip(val, cls)}`;
      }).join(" ");
    }
    case "efw":
    case "efwB": {
      const meas = key === "efwB"
        ? { bpd: s.b_bpd, hc: s.b_hc, ac: s.b_ac, fl: s.b_fl }
        : { bpd: s.bpd, hc: s.hc, ac: s.ac, fl: s.fl };
      const bio = C.computeBiometry(meas, gaW, state.prefs);
      if (!bio || !bio.efw) return `<span class="k">Preencha as biometrias para calcular o peso fetal estimado.</span>`;
      let h = `<span class="k">PFE:</span> ${chip(bio.efw.grams + " g")} <span class="k">(${bio.efw.label})</span>`;
      if (bio.efwPct) {
        const cls = bio.growth ? bio.growth.cls : "neutro";
        h += ` · ${chip("p" + Math.round(bio.efwPct.percentile), cls)}`;
        if (bio.growth) h += ` ${chip(bio.growth.tag, cls)}`;
      } else if (gaW) h += ` · <span class="k">informe a IG p/ percentil</span>`;
      return h;
    }
    case "fluid": {
      const f = C.computeFluid(s, gaW);
      if (!f) return `<span class="k">Informe os quadrantes (ILA) ou o maior bolsão.</span>`;
      if (f.ila != null) {
        const cls = f.classificacao.tag === "normal" ? "ok" : f.classificacao.tag === "polidrâmnio" || f.classificacao.tag === "oligoâmnio" ? "grave" : "alerta";
        let h = `<span class="k">ILA:</span> ${chip(nf(f.ilaCm, 1) + " cm")} · ${chip(f.classificacao.tag, cls)}`;
        if (f.classificacao.percentile != null) h += ` <span class="k">(p${Math.round(f.classificacao.percentile)})</span>`;
        return h;
      }
      const cls = f.sdpClass === "normal" ? "ok" : "grave";
      return `<span class="k">Maior bolsão:</span> ${chip(nf(f.sdp / 10, 1) + " cm")} · ${chip(f.sdpClass, cls)}`;
    }
    case "cpr": {
      const d = C.computeDoppler(s, gaW);
      if (!d || d.cpr == null) return `<span class="k">IPC = IP-ACM ÷ IP-umbilical (preencha ambos).</span>`;
      return `<span class="k">IPC:</span> ${chip(nf(d.cpr, 2), d.cprAlterado ? "grave" : "ok")}${d.cprAlterado ? " " + chip("reduzida (<1,08)", "grave") : ""}`;
    }
    case "doppler": {
      const d = C.computeDoppler(s, gaW);
      if (!d) return `<span class="k">Interpretação aparece ao preencher os índices Doppler.</span>`;
      const alt = [];
      if (d.umbilical?.alterado) alt.push("umbilical alterada");
      if (d.acm?.centralizacao) alt.push("centralização");
      if (d.acm?.anemia) alt.push("Vmáx ACM ↑ (anemia)");
      if (d.cprAlterado) alt.push("IPC reduzida");
      if (d.dv?.alterado) alt.push("ducto venoso alterado");
      if (d.uterinas?.alterado) alt.push("uterinas ↑");
      return alt.length
        ? `<span class="k">Achados:</span> ${alt.map((a) => chip(a, "alerta")).join(" ")}`
        : `${chip("Doppler normal para a IG", "ok")}`;
    }
    case "firsttri": {
      const ft = C.computeFirstTri(s);
      if (!ft) return `<span class="k">Informe a TN (e a idade materna) para interpretação.</span>`;
      let h = "";
      if (ft.tn != null) {
        h += `<span class="k">TN:</span> ${chip(nf(ft.tn, 1) + " mm", ft.ntAumentada ? "grave" : "ok")}`;
        if (ft.ntMediana != null) h += ` <span class="k">(mediana ${nf(ft.ntMediana, 1)}, p95 ${nf(ft.ntP95, 1)})</span>`;
        if (ft.ntAumentada) h += ` ${chip("aumentada", "grave")}`;
      }
      if (ft.riscoIdadeT21) h += ` · <span class="k">risco idade T21:</span> ${chip("1:" + ft.riscoIdadeT21)}`;
      return h || `<span class="k">Informe a TN.</span>`;
    }
    case "cervix": {
      const c = C.computeCervix(s);
      if (!c || c.comprimento == null) return `<span class="k">Informe o comprimento do colo.</span>`;
      const cls = c.muitoCurto ? "grave" : c.curto ? "alerta" : "ok";
      return `<span class="k">Colo:</span> ${chip(nf(c.comprimento, 0) + " mm", cls)} ${chip(c.muitoCurto ? "muito curto" : c.curto ? "encurtado" : "preservado", cls)}`;
    }
    case "bpp": {
      const b = C.computeBPP(s);
      if (!b) return `<span class="k">Marque cada componente (2 ou 0).</span>`;
      const cls = b.score >= 8 ? "ok" : b.score === 6 ? "alerta" : "grave";
      return `<span class="k">Escore:</span> ${chip(b.score + "/" + b.max, cls)}`;
    }
    case "dmsg": {
      const gs = C.computeGestSac(s);
      if (!gs || gs.msd == null) return `<span class="k">Informe os 3 diâmetros do saco gestacional.</span>`;
      let h = `<span class="k">DMSG:</span> ${chip(nf(gs.msd, 1) + " mm")} · <span class="k">IG:</span> ${chip(R.formatGaDays(gs.gaDays))}`;
      if (gs.vv && gs.vv.alterada) h += ` ${chip("vesícula vitelina alterada", "alerta")}`;
      return h;
    }
    case "viability": {
      const v = C.computeViability(s);
      if (!v) return `<span class="k">Preencha embrião/CCN/atividade cardíaca (ou DMSG).</span>`;
      const cls = v.status === "viavel" ? "ok" : v.status === "inviavel" ? "grave" : "alerta";
      const tag = v.status === "viavel" ? "viável" : v.status === "inviavel" ? "inviável" : v.status === "inicial" ? "gestação inicial" : "indeterminada";
      return `${chip(tag, cls)} <span class="k">${v.txt}</span>`;
    }
    case "descolamento": {
      const d = C.computeDescolamento(s);
      if (!d) return `<span class="k">Informe as medidas da coleção.</span>`;
      if (d.tipo !== "descolamento") return `<span class="k">Diferencial fisiológico registrado no laudo.</span>`;
      let h = "";
      if (d.areaCm2 != null) h += `<span class="k">Área:</span> ${chip(nf(d.areaCm2, 1) + " cm²")} `;
      if (d.volMl != null) h += `<span class="k">Vol:</span> ${chip(nf(d.volMl, 1) + " mL")} `;
      if (d.sizeTag) h += chip(d.sizeTag + (d.pctSac != null ? ` (${nf(d.pctSac, 0)}% do saco)` : ""), d.sizeTag === "grande" ? "grave" : d.sizeTag === "moderado" ? "alerta" : "ok");
      return h || `<span class="k">Informe pelo menos 2 diâmetros.</span>`;
    }
    case "twins": {
      const gaW2 = gaW;
      const a = C.computeBiometry({ bpd: s.bpd, hc: s.hc, ac: s.ac, fl: s.fl }, gaW2, state.prefs);
      const b = C.computeBiometry({ bpd: s.b_bpd, hc: s.b_hc, ac: s.b_ac, fl: s.b_fl }, gaW2, state.prefs);
      if (!a?.efw || !b?.efw) return `<span class="k">Preencha as biometrias dos dois fetos.</span>`;
      const disc = C.twinDiscordance(a.efw.grams, b.efw.grams);
      const cls = disc >= 25 ? "grave" : disc >= 20 ? "alerta" : "ok";
      let h = `<span class="k">PFE A/B:</span> ${a.efw.grams} g / ${b.efw.grams} g · ${chip("discordância " + nf(disc, 1) + "%", cls)}`;
      return h;
    }
    case "spleen": {
      const sp = C.computeSpleen(s);
      if (!sp) return `<span class="k">Informe o maior eixo do baço.</span>`;
      return sp.esplenomegalia ? chip("esplenomegalia (> 120 mm)", "alerta") : chip("dimensões normais", "ok");
    }
    case "aorta": {
      const a = C.computeAorta(s);
      if (!a) return `<span class="k">Informe o calibre da aorta.</span>`;
      if (a.aneurisma) return chip("aneurisma (≥ 30 mm)", "grave");
      if (a.ectasia) return chip("ectasia (25–29 mm)", "alerta");
      return chip("calibre normal", "ok");
    }
    case "bladder": {
      const b = C.computeBladder(s);
      if (!b) return `<span class="k">Informe os diâmetros ou o resíduo pós-miccional.</span>`;
      let h = "";
      if (b.volume != null) h += `<span class="k">Volume:</span> ${chip(nf(b.volume, 0) + " mL")} `;
      if (b.rpm != null) h += `<span class="k">RPM:</span> ${chip(nf(b.rpm, 0) + " mL", b.rpmAlterado ? "alerta" : "ok")}`;
      return h || `<span class="k">—</span>`;
    }
    case "prostate": {
      const p = C.computeProstate(s);
      if (!p) return `<span class="k">Informe os 3 diâmetros (e o PSA, se desejar).</span>`;
      let h = "";
      if (p.volume != null) h += `<span class="k">Volume:</span> ${chip(nf(p.volume, 1) + " cm³", p.aumentada ? "alerta" : "ok")} `;
      if (p.density != null) h += `<span class="k">Densidade PSA:</span> ${chip(nf(p.density, 2), p.densAlterada ? "alerta" : "ok")}`;
      return h || `<span class="k">—</span>`;
    }
    default: return "";
  }
}
