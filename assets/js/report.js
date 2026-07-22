/*
 * report.js — Motor de geração do laudo narrativo (estilo Turing).
 * Recebe o estado do formulário + preferências e devolve seções de texto
 * e a conclusão/impressão diagnóstica em português médico.
 */
import * as C from "./calc.js";
import * as R from "./references.js";
import { DEFAULT_TEMPLATES } from "./templates.js";

/* ---------- formatação ---------- */
const nf = (v, dec = 1) =>
  v == null || !isFinite(v) ? "—" : Number(v).toFixed(dec).replace(".", ",");
const fmtDate = (d) => {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const pctTxt = (p) =>
  p == null ? null : `percentil ${p < 1 ? "<1" : p > 99 ? ">99" : Math.round(p)}`;

function tpl(templates, key) {
  return (templates && templates[key]) || DEFAULT_TEMPLATES[key];
}

/* ================================================================= */
export function generateReport(examId, s, prefs = {}, templates = {}) {
  const dating = C.computeDating(s);
  const gaW = dating.bestGaWeeks || null;
  const ctx = { s, prefs, templates, dating, gaW };
  const flags = []; // achados p/ a conclusão

  const sections = [];
  const push = (title, text) => { if (text && text.trim()) sections.push({ title, text: text.trim() }); };

  const isGeneral = examId === "abdome";
  // Cabeçalho (metadados)
  const meta = isGeneral ? buildMetaGeneral(s) : buildMeta(s, dating);

  switch (examId) {
    case "primeiro_tri": buildFirstTri(ctx, push, flags); break;
    case "morfologico": buildMorfo(ctx, push, flags); break;
    case "gemelar": buildGemelar(ctx, push, flags); break;
    case "cervical": buildCervical(ctx, push, flags); break;
    case "pbf": buildPBF(ctx, push, flags); break;
    case "abdome": buildAbdome(ctx, push, flags); break;
    default: buildObstetrica(ctx, push, flags);
  }

  const conclusion = buildConclusion(examId, ctx, flags);
  return { title: titleFor(examId, s), meta, sections, conclusion };
}

function titleFor(id, s = {}) {
  if (id === "abdome") {
    return {
      total: "ULTRASSONOGRAFIA DE ABDOME TOTAL",
      superior: "ULTRASSONOGRAFIA DE ABDOME SUPERIOR",
      rins_vias: "ULTRASSONOGRAFIA DE RINS E VIAS URINÁRIAS",
      prostata: "ULTRASSONOGRAFIA DE PRÓSTATA (VIA ABDOMINAL)",
    }[s.abdome_tipo || "total"];
  }
  return {
    obstetrica: "ULTRASSONOGRAFIA OBSTÉTRICA",
    primeiro_tri: "ULTRASSONOGRAFIA OBSTÉTRICA — 1º TRIMESTRE",
    morfologico: "ULTRASSONOGRAFIA MORFOLÓGICA FETAL",
    gemelar: "ULTRASSONOGRAFIA OBSTÉTRICA — GESTAÇÃO GEMELAR",
    cervical: "ULTRASSONOGRAFIA — MEDIDA DO COLO UTERINO",
    pbf: "PERFIL BIOFÍSICO FETAL",
  }[id] || "ULTRASSONOGRAFIA OBSTÉTRICA";
}

// Metadados para exames não-obstétricos
function buildMetaGeneral(s) {
  const rows = [];
  if (s.pac_nome) rows.push(["Paciente", s.pac_nome]);
  const d = [s.pac_idade ? `${s.pac_idade} anos` : null, s.pac_sexo].filter(Boolean).join(" · ");
  if (d) rows.push(["Dados", d]);
  rows.push(["Data do exame", fmtDate(C.examDate(s))]);
  if (s.indicacao) rows.push(["Indicação", s.indicacao]);
  return rows;
}

function buildMeta(s, dating) {
  const rows = [];
  if (s.pac_nome) rows.push(["Paciente", s.pac_nome]);
  const idadeGP = [s.pac_idade ? `${s.pac_idade} anos` : null, s.gesta].filter(Boolean).join(" · ");
  if (idadeGP) rows.push(["Dados", idadeGP]);
  rows.push(["Data do exame", fmtDate(dating.exam)]);
  if (s.indicacao) rows.push(["Indicação", s.indicacao]);
  if (dating.bestGaDays != null)
    rows.push(["Idade gestacional", `${R.formatGaDays(dating.bestGaDays)} (${dating.best.label})`]);
  if (dating.presumida && dating.presumedLMP) rows.push(["DUM presumida", fmtDate(dating.presumedLMP)]);
  if (dating.edd) rows.push(["DPP", fmtDate(dating.edd)]);
  return rows;
}

/* ---------- blocos reutilizáveis ---------- */
function datingText(ctx) {
  const d = ctx.dating;
  if (!d.best) return "Idade gestacional não determinada por dados insuficientes.";
  const parts = [];
  parts.push(
    `Idade gestacional estimada em ${R.formatGaDays(d.bestGaDays)} pela ${labelLower(d.best.label)}` +
    (d.edd ? `, com data provável do parto em ${fmtDate(d.edd)}.` : ".")
  );
  if (d.previa && d.best.key === "previa") {
    parts.push(`Datação ancorada no ultrassom anterior de ${fmtDate(d.previa.date)} (${R.formatGaDays(d.previa.prevIg)} naquele exame).`);
  }
  if (d.presumida && d.presumedLMP) {
    parts.push(`Data da última menstruação presumida em ${fmtDate(d.presumedLMP)}.`);
  }
  if (d.agreement) {
    const a = d.agreement;
    parts.push(
      a.concordante
        ? `Há concordância entre a idade ultrassonográfica e a idade menstrual (diferença de ${a.diffDays} dia(s)).`
        : `Observa-se discordância entre a idade menstrual e a ultrassonográfica (${a.diffDays} dias, acima da tolerância de ${a.tol} dias) — sugere-se considerar a datação ultrassonográfica.`
    );
  }
  // fontes alternativas informadas
  const extras = d.sources.filter((x) => x.key !== d.best.key)
    .map((x) => `${x.label} ${R.formatGaDays(x.gaDays)}`);
  if (extras.length) parts.push(`Outras estimativas: ${extras.join("; ")}.`);
  return parts.join(" ");
}
const labelLower = (l) => ({
  CCN: "medida do comprimento cabeça-nádega (CCN)",
  DUM: "data da última menstruação (DUM)",
  Biometria: "biometria fetal atual",
  "USG anterior": "datação de ultrassom anterior",
  "Informada pela mãe": "idade gestacional referida pela paciente",
}[l] || l);

// Parâmetros biométricos — uma medida por linha
function biometryText(ctx, flags) {
  const { s, gaW, prefs, dating } = ctx;
  const bio = C.computeBiometry(s, gaW, prefs);
  if (!bio) return "";
  const m = bio.meas;
  const dof = C.helpers.num(s.dof);
  const lines = [];
  const mm = (label, v) => { if (v != null && v > 0) lines.push(`${label}: ${nf(v, 1)} mm.`); };
  mm("Diâmetro biparietal (DBP)", m.bpd);
  mm("Diâmetro occipitofrontal (DOF)", dof);
  mm("Circunferência cefálica (CC)", m.hc);
  // CA: medida direta ou calculada de DAP + DLL
  if (m.ac != null && m.ac > 0) {
    const dap = C.helpers.num(s.ca_dap), dll = C.helpers.num(s.ca_dll);
    const derivada = C.helpers.num(s.ac) == null && dap != null && dll != null;
    lines.push(`Circunferência abdominal (CA): ${nf(m.ac, 1)} mm${derivada ? ` (calculada de DAP ${nf(dap, 1)} × DLL ${nf(dll, 1)} mm)` : ""}.`);
  }
  mm("Comprimento femoral (CF)", m.fl);
  mm("Comprimento do úmero", C.helpers.num(s.hl));
  mm("Diâmetro transverso do cerebelo (DTC)", C.helpers.num(s.tcd));
  if (bio.efw) {
    lines.push(`Peso fetal estimado: ${bio.efw.grams} g (variação de ± 15%).`);
    if (bio.efwPct) {
      const ref = dating.override ? `, referência ${dating.best.label}` : "";
      let w = `Percentil de peso para a idade gestacional: ${bio.efwPct.percentile < 1 ? "< 1" : bio.efwPct.percentile > 99 ? "> 99" : Math.round(bio.efwPct.percentile)}`;
      if (bio.growth) {
        w += ` (${bio.growth.tag}${ref}).`;
        if (bio.growth.cls !== "ok") {
          flags.push(bio.growth.cls === "grave" ? `feto ${bio.growth.tag} (PFE ${bio.growth.txt})` : `PFE no limite (${bio.growth.tag})`);
        }
      } else w += ".";
      lines.push(w);
    }
  }
  // Ganho ponderal desde o exame anterior
  const ig = C.intervalGrowth(dating, bio.efw ? bio.efw.grams : null);
  if (ig) {
    lines.push(`Ganho ponderal desde o exame anterior (${fmtDate(ig.from)}): ${ig.gain >= 0 ? "+" : ""}${ig.gain} g em ${ig.days} dias (≈ ${nf(ig.perDay, 0)} g/dia).`);
    if (ig.perDay < 5 && ig.days >= 10) flags.push("baixo ganho ponderal no intervalo");
  }
  return lines.join("\n");
}

// Índices biométricos — uma relação por linha (formato "(×100): X % (status)")
function ratiosText(ctx, flags) {
  const ratios = C.computeRatios(ctx.s, ctx.gaW);
  if (!ratios) return "";
  const labelMap = {
    hcac: "Relação CC/CA (×100)", flac: "Relação CF/CA (×100)",
    flbpd: "Relação CF/DBP (×100)", ic: "Relação DBP/DOF (×100)",
  };
  const lines = ratios.map((r) => {
    const pctVal = r.unit === "%" ? r.value : r.value * 100;
    const label = labelMap[r.key] || r.label;
    const st = r.status === "ok" ? "normal" : r.status === "alto" ? "acima do esperado" : r.status === "baixo" ? "abaixo do esperado" : null;
    if (r.status === "alto" || r.status === "baixo") flags.push(`${label} ${st}`);
    return `${label}: ${nf(pctVal, 1)} %${st ? ` (${st})` : ""}`;
  });
  const icAlt = ratios.find((r) => r.key === "ic" && (r.status === "alto" || r.status === "baixo"));
  if (icAlt) lines.push("Índice cefálico alterado — o DBP pode ser menos confiável para a datação; priorizar a CC.");
  return lines.join("\n");
}

function fluidText(ctx, flags) {
  const f = C.computeFluid(ctx.s, ctx.gaW);
  if (!f) return "";
  if (f.ila != null) {
    const p = f.classificacao.percentile != null ? ` (${pctTxt(f.classificacao.percentile)})` : "";
    const tag = f.classificacao.tag;
    if (tag !== "normal") flags.push(tag === "oligoâmnio" ? "oligoâmnio" : tag === "polidrâmnio" ? "polidrâmnio" : tag);
    return `Índice de líquido amniótico (ILA) de ${nf(f.ilaCm, 1)} cm${p}, caracterizando volume ${tag === "normal" ? "normal" : tag}.`;
  }
  if (f.sdp != null) {
    if (f.sdpClass !== "normal") flags.push(f.sdpClass);
    return `Maior bolsão vertical de líquido amniótico de ${nf(f.sdp / 10, 1)} cm, compatível com volume ${f.sdpClass}.`;
  }
  return "";
}

function placentaText(ctx, flags) {
  const p = C.computePlacenta(ctx.s);
  if (!p) return "";
  const parts = [];
  let base = "Placenta";
  if (p.local) base += ` de localização ${p.local}`;
  if (p.ecotextura) base += `, de ecotextura ${p.ecotextura}`;
  if (p.grau) base += `, grau ${p.grau} de Grannum`;
  base += ".";
  parts.push(base);
  if (p.ecotextura === "heterogênea") flags.push("placenta heterogênea");
  if (p.distOCI != null) {
    if (p.previa) { parts.push("Placenta prévia (recobre o orifício interno do colo)."); flags.push("placenta prévia"); }
    else if (p.baixa) { parts.push(`Inserção placentária baixa, a ${nf(p.distOCI, 0)} mm do orifício interno.`); flags.push("placenta baixa"); }
    else parts.push(`Borda placentária a ${nf(p.distOCI, 0)} mm do orifício interno do colo.`);
  }
  if (p.vasos === "2") { parts.push("Cordão umbilical com dois vasos (artéria umbilical única)."); flags.push("artéria umbilical única"); }
  else if (p.vasos === "3") parts.push("Cordão umbilical com três vasos.");
  if (p.insercao && !/normal/.test(p.insercao)) { parts.push(`Inserção do cordão do tipo ${p.insercao}.`); flags.push(`inserção ${p.insercao} do cordão`); }
  return parts.join(" ");
}

function dopplerText(ctx, flags) {
  const d = C.computeDoppler(ctx.s, ctx.gaW);
  if (!d) return "";
  const parts = [];
  if (d.umbilical) {
    const u = d.umbilical;
    const vals = [];
    if (u.ip != null) vals.push(`IP ${nf(u.ip, 2)}${u.pct != null ? ` (${pctTxt(u.pct)})` : ""}`);
    if (u.ir != null) vals.push(`IR ${nf(u.ir, 2)}`);
    let t = `Artéria umbilical: ${vals.join(", ") || "avaliada"}`;
    if (u.diastole === "zero") { t += ", com diástole zero"; flags.push("diástole zero na artéria umbilical"); }
    else if (u.diastole === "reversa") { t += ", com fluxo diastólico reverso"; flags.push("diástole reversa na artéria umbilical"); }
    t += ".";
    if (u.alterado && u.diastole === "presente") { t += " Índices de resistência acima do esperado."; flags.push("resistência umbilical aumentada"); }
    parts.push(t);
  }
  if (d.acm) {
    const a = d.acm;
    const vals = [];
    if (a.ip != null) vals.push(`IP ${nf(a.ip, 2)}${a.pct != null ? ` (${pctTxt(a.pct)})` : ""}`);
    if (a.psv != null) vals.push(`Vmáx ${nf(a.psv, 1)} cm/s${a.mom != null ? ` (${nf(a.mom, 2)} MoM)` : ""}`);
    let t = `Artéria cerebral média: ${vals.join(", ")}.`;
    if (a.centralizacao) { t += " Redução do IP sugestiva de centralização hemodinâmica."; flags.push("centralização hemodinâmica"); }
    if (a.anemia) { t += " Velocidade de pico sistólico ≥1,5 MoM, sugestiva de anemia fetal."; flags.push("ACM sugestiva de anemia fetal"); }
    parts.push(t);
  }
  if (d.cpr != null) {
    let t = `Relação cérebro-placentária de ${nf(d.cpr, 2)}${d.cprPct != null ? ` (${pctTxt(d.cprPct)})` : ""}.`;
    if (d.cprAlterado) { t += " Abaixo do percentil 5."; flags.push("relação cérebro-placentária reduzida"); }
    parts.push(t);
  }
  if (d.dv) {
    let t = `Ducto venoso: ${d.dv.ip != null ? `IP ${nf(d.dv.ip, 2)}${d.dv.pct != null ? ` (${pctTxt(d.dv.pct)})` : ""}, ` : ""}onda a ${d.dv.ondaA}.`;
    if (d.dv.alterado) flags.push("alteração no ducto venoso");
    parts.push(t);
  }
  if (d.uterinas) {
    let t = `Artérias uterinas: IP médio ${nf(d.uterinas.ipMedio, 2)}${d.uterinas.pct != null ? ` (${pctTxt(d.uterinas.pct)})` : ""}, incisura protodiastólica ${d.uterinas.incisura}.`;
    if (d.uterinas.alterado) { t += " Padrão de resistência aumentada."; flags.push("resistência aumentada nas artérias uterinas"); }
    parts.push(t);
  }
  if (!parts.length) return "";
  const anyAbn = [d.umbilical, d.acm, d.dv, d.uterinas].some((x) => x && x.alterado) || d.cprAlterado;
  if (!anyAbn) parts.push(tpl(ctx.templates, "doppler_normal"));
  return parts.join(" ");
}

function cervixText(ctx, flags) {
  const c = C.computeCervix(ctx.s);
  if (!c) return "";
  if (c.comprimento == null && !c.afunilamento && !c.sludge)
    return tpl(ctx.templates, "colo_normal");
  const parts = [];
  const via = ctx.s.colo_via ? ` (via ${ctx.s.colo_via})` : "";
  if (c.comprimento != null) parts.push(`Colo uterino${via} medindo ${nf(c.comprimento, 0)} mm.`);
  if (c.afunilamento) { parts.push(`Afunilamento ${c.afunilamento} do orifício interno.`); flags.push("afunilamento do colo"); }
  if (c.sludge) { parts.push("Presença de debris/sludge no líquido amniótico junto ao orifício interno."); flags.push("sludge"); }
  if (c.muitoCurto) { parts.push("Colo acentuadamente encurtado (< 15 mm) — risco elevado de parto prematuro."); flags.push("colo curto (<15 mm)"); }
  else if (c.curto) { parts.push("Colo encurtado (< 25 mm) — considerar risco aumentado de parto prematuro."); flags.push("colo curto (<25 mm)"); }
  else parts.push("Comprimento do colo preservado.");
  return parts.join(" ");
}

/* ---------- exames ---------- */
function buildObstetrica(ctx, push, flags) {
  const { s } = ctx;
  push("Idade gestacional", datingText(ctx));
  // Situação fetal
  const sit = [];
  sit.push(s.num_fetos && s.num_fetos !== "único" ? `Gestação múltipla (${s.num_fetos} fetos).` : "Gestação única.");
  const pos = [];
  if (s.situacao) pos.push(`situação ${s.situacao}`);
  if (s.apresentacao) pos.push(`apresentação ${s.apresentacao}`);
  if (s.dorso) pos.push(`dorso ${s.dorso}`);
  if (pos.length) sit.push(cap(pos.join(", ")) + ".");
  sit.push(s.mov_fetais === "ausentes"
    ? "Feto vivo; movimentos fetais não observados durante o exame."
    : "Feto vivo, com movimentação ativa.");
  sit.push(s.bcf ? `Frequência cardíaca fetal: ${nf(s.bcf, 0)} bpm.` : "Batimentos cardíacos fetais presentes, rítmicos.");
  if (s.sexo && s.sexo !== "não avaliado") sit.push(`Sexo fetal: ${s.sexo}.`);
  push("Situação e vitalidade fetal", sit.join("\n"));
  push("Parâmetros biométricos", biometryText(ctx, flags));
  const idx = ratiosText(ctx, flags);
  if (idx) push("Índices biométricos", idx);
  push("Líquido amniótico", fluidText(ctx, flags) || tpl(ctx.templates, "liquido_normal"));
  push("Placenta e cordão umbilical", placentaText(ctx, flags) || tpl(ctx.templates, "placenta_normal"));
  const dop = dopplerText(ctx, flags);
  if (dop) push("Dopplervelocimetria", dop);
  const col = ctx.s.colo_comprimento != null ? cervixText(ctx, flags) : "";
  if (col) push("Colo uterino", col);
  if (s.obs_texto) push("Observações", s.obs_texto);
}

function buildFirstTri(ctx, push, flags) {
  const { s } = ctx;
  push("Idade gestacional", datingText(ctx));

  // Saco gestacional e implantação
  const gs = C.computeGestSac(s);
  if (gs) {
    const p = [];
    const nSac = gs.num && gs.num !== "1" ? `Observados ${gs.num} sacos gestacionais` : "Saco gestacional único";
    let situ = gs.situacao === "não visualizado" ? "não visualizado" : gs.situacao === "irregular" ? "tópico, de contornos irregulares" : "tópico, de contornos regulares";
    p.push(`${nSac}, ${situ}.`);
    if (gs.trofoblasto) p.push(`Trofoblasto de inserção ${gs.trofoblasto}.`);
    if (gs.msd != null) {
      p.push(`Diâmetro médio do saco gestacional (DMSG) de ${nf(gs.msd, 1)} mm, correspondente a idade gestacional de ${R.formatGaDays(gs.gaDays)} pelo saco.`);
    }
    if (gs.vv) {
      if (gs.vv.presente) {
        p.push(`Vesícula vitelina presente${gs.vv.diam != null ? `, medindo ${nf(gs.vv.diam, 1)} mm` : ""}.`);
        if (gs.vv.alterada) { p.push("Vesícula vitelina aumentada (> 6 mm) — associada a pior prognóstico."); flags.push("vesícula vitelina alterada"); }
      } else {
        p.push("Vesícula vitelina não identificada.");
        if (gs.vv.alterada) flags.push("vesícula vitelina ausente");
      }
    }
    push("Saco gestacional e implantação", p.join(" "));
  }

  // Embrião e vitalidade
  const emb = [];
  if (s.embriao_visualizado === "não") {
    emb.push("Embrião não visualizado.");
  } else {
    if (s.crl) emb.push(`Embrião com comprimento cabeça-nádega (CCN) de ${nf(s.crl, 1)} mm.`);
    if (s.atividade_cardiaca === "presente") emb.push(`Atividade cardíaca presente${s.bcf ? `, com frequência de ${nf(s.bcf, 0)} bpm` : ""}.`);
    else if (s.atividade_cardiaca === "ausente") { emb.push("Atividade cardíaca não detectada."); }
  }
  const viab = C.computeViability(s);
  if (viab) {
    emb.push(`${cap(viab.txt)}.`);
    if (viab.status === "inviavel") flags.push("gestação inviável");
    else if (viab.status === "suspeito") flags.push("viabilidade indeterminada");
  }
  if (emb.length) push("Embrião e vitalidade", emb.join(" "));

  // TN e marcadores
  const ft = C.computeFirstTri(s);
  const tnParts = [];
  if (ft && ft.tn != null) {
    let t = `Translucência nucal de ${nf(ft.tn, 1)} mm`;
    if (ft.ntMediana != null) t += ` (mediana esperada ${nf(ft.ntMediana, 1)} mm${ft.ntP95 != null ? `, p95 ${nf(ft.ntP95, 1)} mm` : ""})`;
    t += ".";
    if (ft.ntAumentada) { t += " Translucência nucal aumentada."; flags.push("translucência nucal aumentada"); }
    tnParts.push(t);
  }
  if (s.osso_nasal) { tnParts.push(`Osso nasal ${s.osso_nasal}.`); if (s.osso_nasal === "ausente") flags.push("osso nasal ausente/hipoplásico"); }
  if (s.dv_onda_a && s.dv_onda_a !== "positiva") { tnParts.push(`Ducto venoso com onda a ${s.dv_onda_a}.`); flags.push("ducto venoso alterado"); }
  if (s.regurg_tricuspide === "presente") { tnParts.push("Presença de regurgitação tricúspide."); flags.push("regurgitação tricúspide"); }
  if (ft && ft.riscoIdadeT21) tnParts.push(`Risco basal para trissomia do 21 pela idade materna: 1:${ft.riscoIdadeT21}. (Estimativa; não substitui rastreio combinado certificado.)`);
  if (tnParts.length) push("Translucência nucal e marcadores", tnParts.join(" "));

  // Descolamento / coleções
  const dsc = descolamentoText(ctx, flags);
  if (dsc) push("Coleções / descolamento", dsc);

  // Colo uterino
  if (s.colo_comprimento != null || s.afunilamento || s.sludge) {
    const col = cervixText(ctx, flags);
    if (col) push("Colo uterino", col);
  }

  // Útero, ovários e anexos
  const anx = [];
  const cl = C.computeCorpoLuteo(s);
  if (cl && cl.ovario && cl.ovario !== "não identificado") {
    anx.push(`Corpo lúteo no ovário ${cl.ovario}${cl.medida != null ? `, medindo ${nf(cl.medida, 0)} mm` : ""}.`);
  }
  if (s.ovarios_obs) anx.push(s.ovarios_obs);
  if (s.utero_obs) anx.push(s.utero_obs);
  if (anx.length) push("Útero, ovários e anexos", anx.join(" "));

  if (s.anat_precoce === "alterado" && s.anat_precoce_desc) push("Anatomia precoce", s.anat_precoce_desc);
  else push("Anatomia precoce", "Anatomia embrionária/fetal precoce sem alterações grosseiras detectáveis nesta idade gestacional.");
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function descolamentoText(ctx, flags) {
  const d = C.computeDescolamento(ctx.s);
  if (!d) return "";
  const p = [];
  const dims = [d.d1, d.d2, d.d3].filter((v) => v != null && v > 0).map((v) => nf(v, 0)).join(" × ");
  if (d.tipo === "descolamento") {
    let t = `Imagem sugestiva de descolamento subcoriônico (hematoma)${dims ? `, medindo ${dims} mm` : ""}`;
    if (d.areaCm2 != null) t += `, com área estimada de ${nf(d.areaCm2, 1)} cm²`;
    if (d.volMl != null) t += ` e volume de ${nf(d.volMl, 1)} mL`;
    t += ".";
    if (d.pctSac != null) { t += ` Corresponde a aproximadamente ${nf(d.pctSac, 0)}% do volume do saco gestacional (descolamento ${d.sizeTag}).`; flags.push(`descolamento subcoriônico ${d.sizeTag}`); }
    else flags.push("descolamento subcoriônico");
    t += " Diagnóstico diferencial com fusão incompleta das decíduas; correlacionar com sangramento e ecogenicidade do conteúdo.";
    p.push(t);
  } else if (d.tipo === "fusao_deciduas") {
    p.push(`Imagem anecoica peri-sacular${dims ? ` (${dims} mm)` : ""} compatível com fusão incompleta das decíduas capsular e parietal, achado fisiológico habitual antes de ~16 semanas — sem características de coleção hemática. Diferencial com descolamento subcoriônico.`);
  } else if (d.tipo === "separacao_corioamniotica") {
    p.push(`Separação corioamniótica (âmnio ainda não fundido ao córion)${dims ? `, com espaço de ${dims} mm` : ""} — achado que pode ser fisiológico antes de ~14–16 semanas; recomendável acompanhamento.`);
  }
  return p.join(" ");
}

function buildMorfo(ctx, push, flags) {
  const { s, templates } = ctx;
  push("Idade gestacional", datingText(ctx));
  const sit = [];
  sit.push(s.num_fetos && s.num_fetos !== "único" ? "Gestação múltipla." : "Gestação única.");
  if (s.apresentacao) sit.push(`Apresentação ${s.apresentacao}.`);
  sit.push("Feto vivo, com movimentação ativa.");
  if (s.bcf) sit.push(`Frequência cardíaca fetal: ${nf(s.bcf, 0)} bpm.`);
  if (s.sexo && s.sexo !== "não avaliado") sit.push(`Sexo fetal: ${s.sexo}.`);
  push("Situação fetal", sit.join("\n"));
  push("Parâmetros biométricos", biometryText(ctx, flags));
  const idxM = ratiosText(ctx, flags);
  if (idxM) push("Índices biométricos", idxM);

  // Anatomia por sistema
  const systems = [["snc", "Sistema nervoso central"], ["face", "Face e pescoço"], ["torax", "Tórax e pulmões"], ["coracao", "Coração"], ["abdome", "Abdome e parede"], ["rins", "Rins e trato urinário"], ["coluna", "Coluna vertebral"], ["membros", "Membros"], ["cordao", "Cordão umbilical"]];
  const anat = [];
  for (const [id] of systems) {
    if (s[`an_${id}`] === "alterado" && s[`an_${id}_desc`]) { anat.push(s[`an_${id}_desc`]); flags.push(`alteração — ${id}`); }
    else anat.push(tpl(templates, id));
  }
  push("Avaliação anatômica", anat.join(" "));

  // Soft markers
  const markers = [
    ["m_prega", "prega nucal espessada"], ["m_foco", "foco ecogênico intracardíaco"],
    ["m_intestino", "intestino hiperecogênico"], ["m_pielectasia", "pielectasia renal"],
    ["m_femur", "fêmur/úmero curto"], ["m_plexo", "cisto de plexo coróide"],
    ["m_osso_nasal", "osso nasal ausente/hipoplásico"], ["m_ventriculo", "ventriculomegalia leve"],
  ].filter(([k]) => s[k]);
  if (markers.length) {
    push("Marcadores de aneuploidia", `Identificado(s): ${markers.map((m) => m[1]).join(", ")}.`);
    markers.forEach((m) => flags.push(m[1]));
  } else {
    push("Marcadores de aneuploidia", "Não foram identificados marcadores ecográficos de aneuploidia.");
  }
  push("Líquido amniótico", fluidText(ctx, flags) || tpl(templates, "liquido_normal"));
  push("Placenta e cordão umbilical", placentaText(ctx, flags) || tpl(templates, "placenta_normal"));
  if (s.obs_texto) push("Observações", s.obs_texto);
}

function buildGemelar(ctx, push, flags) {
  const { s, gaW, prefs } = ctx;
  push("Idade gestacional", datingText(ctx));
  const cor = [];
  if (s.corionicidade) cor.push(`Gestação gemelar ${s.corionicidade} e ${s.amnionicidade || "diamniótica"}`);
  if (s.sinal_membrana) cor.push(`sinal ${s.sinal_membrana === "lambda" ? "do lambda (λ)" : "do T"} na inserção da membrana`);
  if (cor.length) push("Corionicidade", cor.join(", ") + ".");

  const efwA = C.computeBiometry({ bpd: s.bpd, hc: s.hc, ac: s.ac, fl: s.fl }, gaW, prefs);
  const efwB = C.computeBiometry({ bpd: s.b_bpd, hc: s.b_hc, ac: s.b_ac, fl: s.b_fl }, gaW, prefs);
  const fa = [];
  fa.push(`Feto A em apresentação ${s.apresentacao || "—"}.`);
  if (efwA) fa.push(biometryLine(efwA));
  if (s.bolsao_a) fa.push(`Maior bolsão de líquido do saco A: ${nf(s.bolsao_a / 10, 1)} cm.`);
  push("Feto A", fa.join(" "));
  const fb = [];
  fb.push(`Feto B em apresentação ${s.b_apresentacao || "—"}.`);
  if (efwB) fb.push(biometryLine(efwB));
  if (s.bolsao_b) fb.push(`Maior bolsão de líquido do saco B: ${nf(s.bolsao_b / 10, 1)} cm.`);
  push("Feto B", fb.join(" "));

  if (efwA?.efw && efwB?.efw) {
    const disc = C.twinDiscordance(efwA.efw.grams, efwB.efw.grams);
    let t = `Discordância de peso estimada entre os fetos de ${nf(disc, 1)}%.`;
    if (disc >= 25) { t += " Discordância significativa (≥25%)."; flags.push("discordância de peso ≥25%"); }
    else if (disc >= 20) { t += " Discordância a acompanhar (≥20%)."; flags.push("discordância de peso ≥20%"); }
    // TTTS (monocoriônica): sequência oligo-poli
    if (s.corionicidade === "monocoriônica" && s.bolsao_a && s.bolsao_b) {
      const a = s.bolsao_a / 10, b = s.bolsao_b / 10;
      const poli = Math.max(a, b) > 8, oligo = Math.min(a, b) < 2;
      if (poli && oligo) { t += " Sequência polidrâmnio–oligoâmnio, sugestiva de STFF (síndrome de transfusão feto-fetal)."; flags.push("suspeita de STFF"); }
    }
    push("Discordância e vitalidade", t);
  }
  push("Placenta e cordão umbilical", placentaText(ctx, flags) || tpl(ctx.templates, "placenta_normal"));
}

function biometryLine(bio) {
  const m = bio.meas, bl = [];
  if (m.bpd) bl.push(`DBP ${nf(m.bpd, 0)}`);
  if (m.hc) bl.push(`CC ${nf(m.hc, 0)}`);
  if (m.ac) bl.push(`CA ${nf(m.ac, 0)}`);
  if (m.fl) bl.push(`CF ${nf(m.fl, 0)}`);
  let t = bl.length ? `Biometria (mm): ${bl.join(", ")}.` : "";
  if (bio.efw) {
    t += ` PFE ${bio.efw.grams} g`;
    if (bio.efwPct) t += ` (${pctTxt(bio.efwPct.percentile)}${bio.growth ? `, ${bio.growth.tag}` : ""})`;
    t += ".";
  }
  return t;
}

function buildCervical(ctx, push, flags) {
  push("Idade gestacional", datingText(ctx));
  push("Colo uterino", cervixText(ctx, flags));
  if (ctx.s.obs_texto) push("Observações", ctx.s.obs_texto);
}

function buildPBF(ctx, push, flags) {
  const { s } = ctx;
  push("Idade gestacional", datingText(ctx));
  if (s.bcf) push("Vitalidade", `Batimentos cardíacos fetais presentes, com frequência de ${nf(s.bcf, 0)} bpm.`);
  const bpp = C.computeBPP(s);
  if (bpp) {
    const labels = { pbf_resp: "movimentos respiratórios", pbf_mov: "movimentos corporais", pbf_tonus: "tônus fetal", pbf_liquido: "líquido amniótico", pbf_cardio: "cardiotocografia" };
    const lines = Object.keys(labels).filter((k) => s[k] != null && s[k] !== "").map((k) => `${labels[k]}: ${s[k]}/2`);
    let interp;
    if (bpp.score >= 8) interp = "Perfil biofísico tranquilizador (baixo risco de asfixia).";
    else if (bpp.score === 6) interp = "Perfil biofísico equívoco — considerar reavaliação.";
    else interp = "Perfil biofísico alterado — correlacionar com a conduta obstétrica.";
    if (bpp.score < 8) flags.push(`perfil biofísico ${bpp.score}/${bpp.max}`);
    push("Perfil biofísico fetal", `${lines.join("; ")}. Escore total: ${bpp.score}/${bpp.max}. ${interp}`);
  }
  const fl = fluidText(ctx, flags);
  if (fl) push("Líquido amniótico", fl);
}

/* ---------- Abdome (total / superior / rins e vias / próstata) ---------- */
const estLabel = (v) => ({ leve: "grau I (leve)", moderada: "grau II (moderada)", acentuada: "grau III (acentuada)" }[v] || v);

function kidneyText(s, pfx, label, flags) {
  const num = C.helpers.num;
  if (s[pfx + "_status"] === "alterado" && s[pfx + "_desc"]) { flags.push(`alteração renal à ${label.includes("direito") ? "direita" : "esquerda"}`); return `${label}: ${s[pfx + "_desc"]}`; }
  const comp = num(s[pfx + "_comp"]);
  const dimTxt = comp != null ? (comp < 90 ? "reduzidas" : comp > 120 ? "aumentadas" : "normais") : "normais";
  let t = `${label} tópico, de dimensões ${dimTxt}${comp != null ? ` (${nf(comp, 0)} mm)` : ""}, com boa diferenciação corticomedular`;
  const dil = s[pfx + "_dilatacao"];
  if (dil && dil !== "ausente") { t += `, com dilatação pielocalicinal ${dil}`; flags.push(`dilatação pielocalicinal ${dil}`); }
  else t += ", sem dilatação pielocalicinal";
  if (s[pfx + "_calculo"] === "presente") { t += `, com cálculo${num(s[pfx + "_calc_maior"]) ? ` de ${nf(num(s[pfx + "_calc_maior"]), 0)} mm` : ""}`; flags.push("cálculo renal"); }
  else t += ", sem cálculos";
  return t + " ou imagens expansivas.";
}

function buildAbdome(ctx, push, flags) {
  const { s } = ctx;
  const num = C.helpers.num;
  const tipo = s.abdome_tipo || "total";
  const inc = (...t) => t.includes(tipo);
  if (s.abd_tecnica) push("Técnica", s.abd_tecnica);

  if (inc("total", "superior")) {
    if (s.figado_status === "alterado" && s.figado_desc) { push("Fígado", s.figado_desc); flags.push("alteração hepática"); }
    else {
      let t = `Fígado de dimensões normais${num(s.figado_lobo_dir) ? ` (lobo direito ${nf(num(s.figado_lobo_dir), 0)} mm)` : ""}, contornos regulares e ecotextura homogênea, sem lesões focais. Veias hepáticas e sistema porta de calibre normal.`;
      if (s.esteatose && s.esteatose !== "ausente") { t += ` Ecotextura hepática compatível com esteatose ${estLabel(s.esteatose)}.`; flags.push(`esteatose hepática ${estLabel(s.esteatose)}`); }
      push("Fígado", t);
    }
    if (s.vb_status === "alterado" && s.vb_desc) { push("Vesícula e vias biliares", s.vb_desc); flags.push("alteração das vias biliares"); }
    else {
      const parts = [];
      if (s.vb_situacao === "ausente") parts.push("Ausência da vesícula biliar (colecistectomia prévia).");
      else {
        let v = `Vesícula biliar ${s.vb_situacao || "normodistendida"}, de paredes finas`;
        if (s.vb_calculos === "presente") { v += `, contendo cálculo(s)${num(s.vb_calc_maior) ? ` (maior de ${nf(num(s.vb_calc_maior), 0)} mm)` : ""}`; flags.push("colelitíase"); }
        else v += ", sem cálculos ou lama biliar em seu interior";
        parts.push(v + ".");
      }
      parts.push(`Vias biliares intra e extra-hepáticas não dilatadas${num(s.coledoco) ? ` (colédoco ${nf(num(s.coledoco), 0)} mm)` : ""}.`);
      push("Vesícula e vias biliares", parts.join(" "));
    }
    if (s.panc_status === "alterado" && s.panc_desc) { push("Pâncreas", s.panc_desc); flags.push("alteração pancreática"); }
    else if (s.panc_status === "prejudicado") push("Pâncreas", "Pâncreas parcialmente avaliado por interposição gasosa; a porção visualizada não apresenta alterações e o ducto de Wirsung não se encontra dilatado.");
    else push("Pâncreas", `Pâncreas de forma, dimensões e ecotextura normais, com ducto de Wirsung não dilatado${num(s.wirsung) ? ` (${nf(num(s.wirsung), 0)} mm)` : ""}.`);

    if (s.baco_status === "alterado" && s.baco_desc) { push("Baço", s.baco_desc); flags.push("alteração esplênica"); }
    else {
      const sp = C.computeSpleen(s);
      if (sp && sp.esplenomegalia) flags.push("esplenomegalia");
      push("Baço", `Baço de ${sp && sp.esplenomegalia ? "dimensões aumentadas" : "dimensões normais"}${sp ? ` (maior eixo ${nf(sp.eixo, 0)} mm)` : ""} e ecotextura homogênea, sem lesões focais.`);
    }
    if (num(s.aorta_calibre) != null || s.aorta_desc) {
      const a = C.computeAorta(s);
      const parts = [];
      if (a) {
        let t = `Aorta abdominal de calibre ${a.aneurisma ? "aumentado" : a.ectasia ? "no limite superior" : "normal"} (${nf(a.calibre, 0)} mm)`;
        if (a.aneurisma) { t += ", caracterizando aneurisma"; flags.push("aneurisma de aorta abdominal"); }
        else if (a.ectasia) { t += " (ectasia)"; flags.push("ectasia aórtica"); }
        else t += ", sem dilatações";
        parts.push(t + ".");
      }
      if (s.aorta_desc) parts.push(s.aorta_desc);
      push("Aorta e retroperitônio", parts.join(" "));
    }
  }

  if (inc("total", "rins_vias")) {
    push("Rins", kidneyText(s, "rd", "Rim direito", flags) + "\n" + kidneyText(s, "re", "Rim esquerdo", flags));
  }

  if (inc("total", "rins_vias", "prostata")) {
    if (s.bexiga_status === "alterado" && s.bexiga_desc) { push("Bexiga", s.bexiga_desc); flags.push("alteração vesical"); }
    else {
      const b = C.computeBladder(s);
      let t = "Bexiga com adequada repleção, paredes finas e regulares, conteúdo anecoico, sem cálculos ou imagens ecogênicas.";
      if (b && b.volume != null) t += ` Volume vesical estimado: ${nf(b.volume, 0)} mL.`;
      if (b && b.rpm != null) { t += ` Resíduo pós-miccional: ${nf(b.rpm, 0)} mL.`; if (b.rpmAlterado) flags.push("resíduo pós-miccional elevado"); }
      push("Bexiga", t);
    }
  }

  if (inc("total", "prostata")) {
    if (s.prost_status === "alterado" && s.prost_desc) { push("Próstata", s.prost_desc); flags.push("alteração prostática"); }
    else {
      const p = C.computeProstate(s);
      let t = `Próstata de textura ${s.prost_textura || "homogênea"}, contornos regulares`;
      if (p && p.volume != null) { t += `, com volume estimado de ${nf(p.volume, 1)} cm³`; if (p.aumentada) { t += " (aumentada)"; flags.push("aumento do volume prostático"); } }
      t += ".";
      if (p && p.density != null) { t += ` PSA de ${nf(p.psa, 2)} ng/mL; densidade de PSA de ${nf(p.density, 2)} ng/mL/cm³${p.densAlterada ? " (elevada)" : ""}.`; if (p.densAlterada) flags.push("densidade de PSA elevada"); }
      push("Próstata", t);
    }
  }

  if (s.obs_texto) push("Observações", s.obs_texto);
}

/* ---------- conclusão ---------- */
function buildConclusion(examId, ctx, flags) {
  const { dating } = ctx;
  const lines = [];
  const ga = dating.bestGaDays != null ? R.formatGaDays(dating.bestGaDays) : null;

  if (examId === "primeiro_tri") {
    const s = ctx.s;
    const nSac = s.num_sacos && s.num_sacos !== "1" ? `gemelar (${s.num_sacos} sacos)` : "única";
    const viab = C.computeViability(s);
    const gsrc = dating.best ? ` (${dating.best.label})` : "";
    if (viab && viab.status === "inviavel") {
      lines.push(`Gestação tópica ${nSac} inviável — ${viab.txt}.`);
    } else if (viab && (viab.status === "suspeito" || viab.status === "inicial")) {
      lines.push(`Gestação tópica ${nSac} inicial, de viabilidade indeterminada — recomendável reavaliação ultrassonográfica em 7–14 dias.`);
    } else {
      lines.push(`Gestação tópica ${nSac}, embrião vivo${ga ? `, com idade gestacional de ${ga}${gsrc}` : ""}${dating.edd ? ` e DPP em ${fmtDate(dating.edd)}` : ""}.`);
    }
  } else if (examId === "cervical") {
    const c = C.computeCervix(ctx.s);
    if (c && c.comprimento != null) {
      lines.push(c.curto ? `Colo uterino encurtado (${nf(c.comprimento, 0)} mm).` : `Colo uterino de comprimento preservado (${nf(c.comprimento, 0)} mm).`);
    }
  } else if (examId === "pbf") {
    const bpp = C.computeBPP(ctx.s);
    if (bpp) lines.push(`Perfil biofísico fetal ${bpp.score}/${bpp.max}.`);
  } else if (examId === "abdome") {
    // conclusão tratada pelo bloco de achados abaixo
  } else {
    const base = examId === "gemelar" ? "Gestação gemelar tópica" : "Gestação tópica, feto único e vivo";
    // Dupla referência de IG: quando a IG adotada não vem da biometria e há
    // biometria disponível, informa também a IG biométrica para comparação.
    let gaClause = ga ? `com idade gestacional de ${ga}` : null;
    if (ga && dating.bio && dating.best && dating.best.key !== "bio") {
      gaClause = `com idade gestacional compatível com ${ga} pela ${labelLower(dating.best.label)} e ${R.formatGaDays(dating.bio.gaDays)} pela biometria`;
    }
    lines.push(gaClause ? `${base}, ${gaClause}.` : `${base}.`);
    if (dating.edd) lines.push(`Data provável do parto em ${fmtDate(dating.edd)}.`);
    // PFE percentil
    const bio = C.computeBiometry(ctx.s, ctx.dating.bestGaWeeks, ctx.prefs);
    if (bio?.efwPct) lines.push(`Peso fetal estimado de ${bio.efw.grams} g (${pctTxt(bio.efwPct.percentile)}) — ${bio.growth ? bio.growth.tag : "avaliar"}.`);
  }

  const uniq = [...new Set(flags)];
  if (uniq.length) {
    lines.push("Achados a destacar: " + uniq.join("; ") + ".");
  } else if (examId === "morfologico") {
    lines.push("Estudo morfológico sem evidência de malformações maiores; anatomia fetal compatível com a idade gestacional.");
  } else if (examId === "primeiro_tri") {
    lines.push("Demais estruturas avaliadas sem alterações para a idade gestacional.");
  } else if (examId === "abdome") {
    lines.push("Exame ecográfico dentro dos limites da normalidade.");
  } else if (examId !== "cervical" && examId !== "pbf") {
    lines.push("Vitalidade fetal preservada e demais parâmetros dentro da normalidade para a idade gestacional.");
  }
  return lines.join("\n");
}
