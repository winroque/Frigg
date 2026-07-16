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

  // Cabeçalho (metadados)
  const meta = buildMeta(s, dating);

  switch (examId) {
    case "primeiro_tri": buildFirstTri(ctx, push, flags); break;
    case "morfologico": buildMorfo(ctx, push, flags); break;
    case "gemelar": buildGemelar(ctx, push, flags); break;
    case "cervical": buildCervical(ctx, push, flags); break;
    case "pbf": buildPBF(ctx, push, flags); break;
    default: buildObstetrica(ctx, push, flags);
  }

  const conclusion = buildConclusion(examId, ctx, flags);
  return { title: titleFor(examId), meta, sections, conclusion };
}

function titleFor(id) {
  return {
    obstetrica: "ULTRASSONOGRAFIA OBSTÉTRICA",
    primeiro_tri: "ULTRASSONOGRAFIA OBSTÉTRICA — 1º TRIMESTRE",
    morfologico: "ULTRASSONOGRAFIA MORFOLÓGICA FETAL",
    gemelar: "ULTRASSONOGRAFIA OBSTÉTRICA — GESTAÇÃO GEMELAR",
    cervical: "ULTRASSONOGRAFIA — MEDIDA DO COLO UTERINO",
    pbf: "PERFIL BIOFÍSICO FETAL",
  }[id] || "ULTRASSONOGRAFIA OBSTÉTRICA";
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
  if (d.agreement) {
    const a = d.agreement;
    parts.push(
      a.concordante
        ? `Há concordância entre a biometria/CCN e a idade menstrual (diferença de ${a.diffDays} dia(s)).`
        : `Observa-se discordância entre a idade menstrual e a ultrassonográfica (${a.diffDays} dias, acima da tolerância de ${a.tol} dias) — sugere-se considerar a datação ultrassonográfica.`
    );
  }
  return parts.join(" ");
}
const labelLower = (l) => ({ CCN: "medida do comprimento cabeça-nádega (CCN)", DUM: "data da última menstruação (DUM)", Biometria: "biometria fetal" }[l] || l);

function biometryText(ctx, flags, silentNormalConcl = false) {
  const { s, gaW, prefs } = ctx;
  const bio = C.computeBiometry(s, gaW, prefs);
  if (!bio) return "";
  const m = bio.meas;
  const parts = [];
  const bl = [];
  if (m.bpd) bl.push(`DBP ${nf(m.bpd, 0)} mm`);
  if (m.hc) bl.push(`CC ${nf(m.hc, 0)} mm`);
  if (m.ac) bl.push(`CA ${nf(m.ac, 0)} mm`);
  if (m.fl) bl.push(`CF ${nf(m.fl, 0)} mm`);
  if (bl.length) parts.push(`Biometria: ${bl.join(", ")}.`);
  if (bio.efw) {
    let w = `Peso fetal estimado de ${bio.efw.grams} g (${bio.efw.label})`;
    if (bio.efwPct) {
      const p = pctTxt(bio.efwPct.percentile);
      w += `, correspondente ao ${p}`;
      if (bio.growth) {
        w += ` para a idade gestacional (${bio.growth.tag}).`;
        if (bio.growth.cls !== "ok") {
          flags.push(
            bio.growth.cls === "grave"
              ? `feto ${bio.growth.tag} (PFE ${bio.growth.txt})`
              : `PFE no limite (${bio.growth.tag})`
          );
        }
      } else w += ".";
    } else w += ".";
    parts.push(w);
  }
  if (bio.hcac || bio.flac) {
    const rel = [];
    if (bio.hcac) rel.push(`CC/CA ${nf(bio.hcac, 2)}`);
    if (bio.flac) rel.push(`CF/CA ${nf(bio.flac, 0)}%`);
    parts.push(`Relações biométricas: ${rel.join(", ")}.`);
  }
  return parts.join(" ");
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
  if (p.grau) base += `, grau ${p.grau} de Grannum`;
  base += ".";
  parts.push(base);
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
  const nf_ = s.num_fetos && s.num_fetos !== "único" ? `Gestação com ${s.num_fetos} fetos.` : "Gestação única.";
  sit.push(nf_ + " Feto vivo.");
  if (s.situacao || s.apresentacao) {
    sit.push(`Situação ${s.situacao || "longitudinal"}, apresentação ${s.apresentacao || "cefálica"}${s.dorso ? `, dorso ${s.dorso}` : ""}.`);
  }
  if (s.bcf) sit.push(`Batimentos cardíacos fetais presentes e rítmicos, com frequência de ${nf(s.bcf, 0)} bpm.`);
  else sit.push(tpl(ctx.templates, "bcf_normal"));
  if (s.mov_fetais === "ausentes") { sit.push("Movimentos fetais não observados durante o exame."); }
  push("Situação e vitalidade fetal", sit.join(" "));
  push("Biometria fetal", biometryText(ctx, flags));
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
  const sit = [];
  sit.push((s.num_fetos && s.num_fetos !== "único" ? `Gestação com ${s.num_fetos} embriões` : "Gestação única, tópica") + ".");
  sit.push("Embrião/feto com atividade cardíaca presente" + (s.bcf ? `, frequência de ${nf(s.bcf, 0)} bpm.` : "."));
  if (s.crl) sit.push(`Comprimento cabeça-nádega (CCN) de ${nf(s.crl, 1)} mm.`);
  push("Avaliação embrionária/fetal", sit.join(" "));

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

  if (s.anat_precoce === "alterado" && s.anat_precoce_desc) push("Anatomia precoce", s.anat_precoce_desc);
  else push("Anatomia precoce", "Anatomia fetal precoce sem alterações grosseiras detectáveis nesta idade gestacional.");
  if (s.utero_anexos) push("Útero e anexos", s.utero_anexos);
}

function buildMorfo(ctx, push, flags) {
  const { s, templates } = ctx;
  push("Idade gestacional", datingText(ctx));
  const sit = [`Gestação ${s.num_fetos && s.num_fetos !== "único" ? "múltipla" : "única"}, feto vivo em apresentação ${s.apresentacao || "cefálica"}.`];
  if (s.bcf) sit.push(`FCF ${nf(s.bcf, 0)} bpm.`);
  if (s.sexo && s.sexo !== "não avaliado") sit.push(`Sexo fetal aparente: ${s.sexo}.`);
  push("Situação fetal", sit.join(" "));
  push("Biometria fetal", biometryText(ctx, flags));

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

/* ---------- conclusão ---------- */
function buildConclusion(examId, ctx, flags) {
  const { dating } = ctx;
  const lines = [];
  const ga = dating.bestGaDays != null ? R.formatGaDays(dating.bestGaDays) : null;

  if (examId === "cervical") {
    const c = C.computeCervix(ctx.s);
    if (c && c.comprimento != null) {
      lines.push(c.curto ? `Colo uterino encurtado (${nf(c.comprimento, 0)} mm).` : `Colo uterino de comprimento preservado (${nf(c.comprimento, 0)} mm).`);
    }
  } else if (examId === "pbf") {
    const bpp = C.computeBPP(ctx.s);
    if (bpp) lines.push(`Perfil biofísico fetal ${bpp.score}/${bpp.max}.`);
  } else {
    const base = examId === "gemelar" ? "Gestação gemelar tópica" : "Gestação tópica, feto único e vivo";
    lines.push(ga ? `${base}, com idade gestacional de ${ga}${dating.edd ? ` e DPP em ${fmtDate(dating.edd)}` : ""}.` : `${base}.`);
    // PFE percentil
    const bio = C.computeBiometry(ctx.s, ctx.dating.bestGaWeeks, ctx.prefs);
    if (bio?.efwPct) lines.push(`Peso fetal estimado de ${bio.efw.grams} g (${pctTxt(bio.efwPct.percentile)}) — ${bio.growth ? bio.growth.tag : "avaliar"}.`);
  }

  const uniq = [...new Set(flags)];
  if (uniq.length) {
    lines.push("Achados a destacar: " + uniq.join("; ") + ".");
  } else if (examId === "morfologico") {
    lines.push("Estudo morfológico sem evidência de malformações maiores; anatomia fetal compatível com a idade gestacional.");
  } else if (examId !== "cervical" && examId !== "pbf") {
    lines.push("Vitalidade fetal preservada e demais parâmetros dentro da normalidade para a idade gestacional.");
  }
  return lines.join("\n");
}
