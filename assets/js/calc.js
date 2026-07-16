/*
 * calc.js — Calculadoras clínicas de alto nível
 * Consome references.js e o estado do formulário para produzir os
 * valores derivados usados pelo laudo (IG, PFE, percentis, ILA, Doppler…).
 */
import * as R from "./references.js";
import * as REF from "./refdata.js"; // tabelas pesquisadas (Doppler, ILA, NT, curvas)

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};
const parseDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v + "T00:00:00");
  return isNaN(d) ? null : d;
};

// Data do exame (ou hoje)
export function examDate(s) {
  return parseDate(s.exam_data) || new Date();
}

/* ---------- Datação: reúne todas as fontes e escolhe a "melhor IG" ---------- */
export function computeDating(s) {
  const exam = examDate(s);
  const out = { exam, sources: [], best: null };

  // 1) DUM
  const dum = parseDate(s.dum);
  if (dum) {
    const gaDays = R.gaFromLMP(dum, exam);
    if (gaDays != null && gaDays > 0 && gaDays < 320) {
      out.dum = { date: dum, gaDays, confiavel: s.dum_confiavel !== "incerta" };
      out.sources.push({ key: "dum", label: "DUM", gaDays, edd: R.eddFromLMP(dum) });
    }
  }

  // 2) CCN (1º tri) — padrão-ouro quando disponível
  const crl = num(s.crl);
  if (crl) {
    const g = R.gaFromCRL(crl);
    if (g) {
      out.crl = { gaDays: g.days, valid: g.valid };
      out.sources.push({ key: "crl", label: "CCN", gaDays: g.days, edd: R.eddFromGa(g.days, exam) });
    }
  }

  // 3) Biometria (2º/3º tri)
  const bio = { bpd: num(s.bpd), hc: num(s.hc), ac: num(s.ac), fl: num(s.fl) };
  const gaBio = R.gaFromBiometry(bio);
  if (gaBio && gaBio.composite) {
    const gaDays = Math.round(gaBio.composite * 7);
    out.bio = { gaDays, parts: gaBio };
    out.sources.push({ key: "bio", label: "Biometria", gaDays, edd: R.eddFromGa(gaDays, exam) });
  }

  // Regra da melhor IG: CCN (1º tri) > DUM confiável ≈ biometria
  // Escolhe CCN se presente; senão DUM confiável; senão biometria; senão DUM.
  let best = null;
  const byKey = (k) => out.sources.find((x) => x.key === k);
  if (byKey("crl")) best = byKey("crl");
  else if (out.dum && out.dum.confiavel) best = byKey("dum");
  else if (byKey("bio")) best = byKey("bio");
  else if (byKey("dum")) best = byKey("dum");
  out.best = best;

  // Concordância US × DUM (limiares ISUOG/ACOG)
  if (out.dum && (byKey("crl") || byKey("bio"))) {
    const us = byKey("crl") || byKey("bio");
    const diff = Math.abs(us.gaDays - out.dum.gaDays);
    const wk = out.dum.gaDays / 7;
    // tolerância: <9s: 5d; 9–14s: 7d; 14–16s: 7d; 16–22s: 10d; 22–28s: 14d; >28s: 21d
    let tol = 5;
    if (wk >= 9 && wk < 16) tol = 7;
    else if (wk >= 16 && wk < 22) tol = 10;
    else if (wk >= 22 && wk < 28) tol = 14;
    else if (wk >= 28) tol = 21;
    out.agreement = { diffDays: diff, tol, concordante: diff <= tol, usKey: us.key };
  }

  if (best) {
    out.bestGaDays = best.gaDays;
    out.bestGaWeeks = best.gaDays / 7;
    out.edd = best.edd;
  }
  return out;
}

/* ---------- Biometria & PFE ---------- */
export function computeBiometry(s, gaWeeks, prefs) {
  const meas = { bpd: num(s.bpd), hc: num(s.hc), ac: num(s.ac), fl: num(s.fl) };
  const hasAny = Object.values(meas).some((v) => v);
  if (!hasAny) return null;
  const out = { meas };

  const efw = R.estimateEFW(meas, prefs?.efwFormula || "auto");
  if (efw) {
    out.efw = efw;
    if (gaWeeks) {
      const std = (prefs && prefs.growthStd) || "hadlock";
      const fn = REF.growthStandards[std] || R.growthStandards.hadlock;
      out.efwPct = fn(efw.grams, gaWeeks);
      if (out.efwPct) out.growth = R.classifyGrowth(out.efwPct.percentile);
    }
  }
  // Relações
  if (meas.hc && meas.ac) out.hcac = meas.hc / meas.ac;
  if (meas.fl && meas.ac) out.flac = (meas.fl / meas.ac) * 100; // %
  return out;
}

/* ---------- Líquido amniótico ---------- */
export function computeFluid(s, gaWeeks) {
  const out = {};
  // ILA por 4 quadrantes (mm) ou valor direto
  const q = [num(s.ila_q1), num(s.ila_q2), num(s.ila_q3), num(s.ila_q4)];
  let ila = num(s.ila);
  if (q.some((v) => v != null)) ila = q.reduce((a, b) => a + (b || 0), 0);
  if (ila != null) {
    out.ila = ila; // mm
    const ilaCm = ila / 10;
    out.ilaCm = ilaCm;
    out.classificacao = classifyAFI(ilaCm, gaWeeks);
  }
  const sdp = num(s.maior_bolsao);
  if (sdp != null) {
    out.sdp = sdp; // mm
    const cm = sdp / 10;
    out.sdpClass = cm < 2 ? "oligoâmnio" : cm > 8 ? "polidrâmnio" : "normal";
  }
  return Object.keys(out).length ? out : null;
}

function classifyAFI(ilaCm, gaWeeks) {
  // Percentil por IG quando disponível (Moore & Cayle); senão cortes fixos
  let pct = null;
  if (gaWeeks && REF.afiPercentile) pct = REF.afiPercentile(ilaCm, gaWeeks);
  let tag;
  if (ilaCm < 5) tag = "oligoâmnio";
  else if (ilaCm <= 8) tag = "líquido no limite inferior";
  else if (ilaCm <= 24) tag = "normal";
  else tag = "polidrâmnio";
  return { tag, percentile: pct };
}

/* ---------- Doppler ---------- */
export function computeDoppler(s, gaWeeks) {
  const out = {};
  const au_ip = num(s.au_ip), au_ir = num(s.au_ir), au_sd = num(s.au_sd);
  if (au_ip != null || au_ir != null || au_sd != null || s.au_diastole) {
    out.umbilical = { ip: au_ip, ir: au_ir, sd: au_sd, diastole: s.au_diastole || "presente" };
    if (au_ip != null && gaWeeks && REF.umbilicalPI) {
      out.umbilical.pct = REF.umbilicalPI(au_ip, gaWeeks);
    }
    out.umbilical.alterado =
      (out.umbilical.pct != null && out.umbilical.pct > 95) ||
      s.au_diastole === "zero" || s.au_diastole === "reversa";
  }
  const acm_ip = num(s.acm_ip), acm_psv = num(s.acm_psv);
  if (acm_ip != null || acm_psv != null) {
    out.acm = { ip: acm_ip, psv: acm_psv };
    if (acm_ip != null && gaWeeks && REF.mcaPI) out.acm.pct = REF.mcaPI(acm_ip, gaWeeks);
    if (acm_psv != null && gaWeeks && REF.mcaPsvMoM) {
      out.acm.mom = REF.mcaPsvMoM(acm_psv, gaWeeks);
      out.acm.anemia = out.acm.mom != null && out.acm.mom >= 1.5;
    }
    out.acm.centralizacao = out.acm.pct != null && out.acm.pct < 5;
  }
  // Relação cérebro-placentária
  if (au_ip && acm_ip) {
    out.cpr = acm_ip / au_ip;
    out.cprPct = gaWeeks && REF.cprPercentile ? REF.cprPercentile(out.cpr, gaWeeks) : null;
    // corte prático amplamente usado: CPR < 1,08 (ou < p5 quando disponível)
    out.cprAlterado = out.cprPct != null ? out.cprPct < 5 : out.cpr < 1.08;
  }
  const dv_ip = num(s.dv_ip);
  if (dv_ip != null || s.dv_onda_a) {
    out.dv = { ip: dv_ip, ondaA: s.dv_onda_a || "positiva" };
    if (dv_ip != null && gaWeeks && REF.dvPI) out.dv.pct = REF.dvPI(dv_ip, gaWeeks);
    out.dv.alterado = (out.dv.pct != null && out.dv.pct > 95) ||
      s.dv_onda_a === "ausente" || s.dv_onda_a === "reversa";
  }
  const ut_ip = num(s.ut_ip_med);
  if (ut_ip != null || s.ut_incisura) {
    out.uterinas = { ipMedio: ut_ip, incisura: s.ut_incisura || "ausente" };
    if (ut_ip != null && gaWeeks && REF.uterinePI) out.uterinas.pct = REF.uterinePI(ut_ip, gaWeeks);
    out.uterinas.alterado = (out.uterinas.pct != null && out.uterinas.pct > 95) ||
      s.ut_incisura === "bilateral";
  }
  return Object.keys(out).length ? out : null;
}

/* ---------- 1º trimestre / TN ---------- */
export function computeFirstTri(s) {
  const out = {};
  const crl = num(s.crl), tn = num(s.tn);
  if (tn != null) {
    out.tn = tn;
    if (crl && REF.ntPercentile) {
      const p = REF.ntPercentile(tn, crl);
      if (p) { out.ntMediana = p.median; out.ntP95 = p.p95; out.ntPct = p.percentile; }
    }
    out.ntAumentada = tn >= 3.5 || (out.ntP95 != null && tn > out.ntP95);
  }
  // Risco basal por idade materna (T21) — tabela publicada (Snijders/FMF)
  const idade = num(s.idade_materna) || num(s.pac_idade);
  if (idade && REF.ageRiskT21) out.riscoIdadeT21 = REF.ageRiskT21(idade);
  return Object.keys(out).length ? out : null;
}

/* ---------- Perfil biofísico fetal ---------- */
export function computeBPP(s) {
  const items = ["pbf_resp", "pbf_mov", "pbf_tonus", "pbf_liquido", "pbf_cardio"];
  const vals = items.map((k) => (s[k] === "2" || s[k] === 2 ? 2 : s[k] === "0" || s[k] === 0 ? 0 : null));
  if (vals.every((v) => v == null)) return null;
  const score = vals.reduce((a, v) => a + (v || 0), 0);
  const maxScore = vals.filter((v) => v != null).length * 2;
  return { score, max: maxScore };
}

/* ---------- Colo uterino ---------- */
export function computeCervix(s) {
  const c = num(s.colo_comprimento);
  if (c == null && !s.afunilamento && !s.sludge) return null;
  return {
    comprimento: c,
    curto: c != null && c < 25,
    muitoCurto: c != null && c < 15,
    afunilamento: s.afunilamento && s.afunilamento !== "ausente" ? s.afunilamento : null,
    sludge: s.sludge === "presente",
  };
}

/* ---------- Placenta / cordão ---------- */
export function computePlacenta(s) {
  const out = {};
  if (s.placenta_local) out.local = s.placenta_local;
  if (s.placenta_grau) out.grau = s.placenta_grau;
  const dist = num(s.placenta_dist_oci);
  if (dist != null) {
    out.distOCI = dist;
    out.previa = s.placenta_local === "prévia" || dist <= 0;
    out.baixa = dist > 0 && dist < 20;
  }
  if (s.cordao_vasos) out.vasos = s.cordao_vasos;
  if (s.cordao_insercao) out.insercao = s.cordao_insercao;
  return Object.keys(out).length ? out : null;
}

/* ---------- Discordância gemelar ---------- */
export function twinDiscordance(efw1, efw2) {
  if (!efw1 || !efw2) return null;
  const maior = Math.max(efw1, efw2), menor = Math.min(efw1, efw2);
  return ((maior - menor) / maior) * 100;
}

export const helpers = { num, parseDate };
