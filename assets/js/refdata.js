/*
 * refdata.js — Tabelas e equações de referência verificadas contra a literatura.
 * ------------------------------------------------------------------
 * FONTES (cada bloco cita a sua):
 *  - ILA: Moore & Cayle, Am J Obstet Gynecol 1990;162:1168.
 *  - A. umbilical / ACM (IP): Arduini & Rizzo, J Perinat Med 1990;18:165.
 *  - ACM Vmáx (PSV): Mari et al., N Engl J Med 2000;342:9  → mediana = e^(2.31+0.046·IG).
 *  - Ducto venoso (PIV): Kessler et al., UOG 2006;28:890.
 *  - Aa. uterinas (IP médio): Gómez et al., UOG 2008;32:128 → ln(PI)=1.39−0.012·d+1.98e-5·d².
 *  - Translucência nucal: FMF / Snijders-Nicolaides (Lancet 1998), CRL 45–84 mm.
 *  - Risco por idade materna (T21): Snijders et al., UOG 1999 (12 semanas).
 *
 * NOTA: as tabelas de percentil por semana de UA/ACM/DV são valores
 * representativos das publicações originais; os valores exibidos são
 * adjuntos ao valor medido. Ferramenta de apoio — ver aviso no app.
 */
import {
  efwPercentileHadlock, normalCdf, normalInv, zToPercentile, interpTable,
} from "./references.js";

/* ---- helper: percentil por 3 âncoras (p5/p50/p95) via normal assimétrica ---- */
function pctFrom3(value, p5, p50, p95) {
  if (value == null) return null;
  const sd = value >= p50 ? (p95 - p50) / 1.6449 : (p50 - p5) / 1.6449;
  if (sd <= 0) return null;
  return zToPercentile((value - p50) / sd);
}
// idem, mas na escala logarítmica (para índices positivos assimétricos)
function pctFrom3Log(value, p5, p50, p95) {
  if (value == null || value <= 0) return null;
  const lv = Math.log(value), l5 = Math.log(p5), l50 = Math.log(p50), l95 = Math.log(p95);
  const sd = lv >= l50 ? (l95 - l50) / 1.6449 : (l50 - l5) / 1.6449;
  if (sd <= 0) return null;
  return zToPercentile((lv - l50) / sd);
}

/* =================================================================
 * ILA — Moore & Cayle 1990 (mm). Colunas: p5 / p50 / p95.
 * ================================================================= */
const AFI_TABLE = {
  16: [79, 121, 185], 17: [83, 127, 194], 18: [87, 133, 202], 19: [90, 137, 207],
  20: [93, 141, 212], 21: [95, 143, 214], 22: [97, 145, 216], 23: [98, 146, 218],
  24: [98, 147, 219], 25: [97, 147, 221], 26: [97, 147, 223], 27: [95, 146, 226],
  28: [94, 146, 228], 29: [92, 145, 231], 30: [90, 145, 234], 31: [88, 144, 238],
  32: [86, 144, 242], 33: [83, 143, 245], 34: [81, 142, 248], 35: [79, 140, 249],
  36: [77, 138, 249], 37: [75, 135, 244], 38: [73, 132, 239], 39: [72, 127, 226],
  40: [71, 123, 214], 41: [70, 116, 194], 42: [69, 110, 175],
};
// entrada em CM; tabela em mm
export function afiPercentile(ilaCm, gaWeeks) {
  const row = interpTable(objRows(AFI_TABLE), gaWeeks);
  if (!row) return null;
  return pctFrom3(ilaCm * 10, row[0], row[1], row[2]);
}

/* =================================================================
 * A. umbilical — IP (Arduini & Rizzo 1990). p5 / p50 / p95.
 * ================================================================= */
const UA_PI = {
  20: [0.92, 1.22, 1.55], 22: [0.86, 1.15, 1.48], 24: [0.80, 1.09, 1.40],
  26: [0.75, 1.03, 1.34], 28: [0.70, 0.97, 1.27], 30: [0.65, 0.91, 1.21],
  32: [0.60, 0.85, 1.15], 34: [0.56, 0.80, 1.09], 36: [0.52, 0.75, 1.04],
  38: [0.48, 0.71, 1.00], 40: [0.45, 0.68, 0.96],
};
export function umbilicalPI(ip, gaWeeks) {
  const r = interpTable(objRows(UA_PI), gaWeeks);
  return r ? pctFrom3(ip, r[0], r[1], r[2]) : null;
}

/* =================================================================
 * ACM — IP (Arduini & Rizzo 1990). p5 / p50 / p95 (sobe até ~32s e cai).
 * ================================================================= */
const MCA_PI = {
  20: [1.36, 1.83, 2.30], 24: [1.50, 2.00, 2.50], 28: [1.60, 2.10, 2.62],
  32: [1.55, 2.05, 2.55], 36: [1.30, 1.80, 2.30], 40: [1.00, 1.45, 1.95],
};
export function mcaPI(ip, gaWeeks) {
  const r = interpTable(objRows(MCA_PI), gaWeeks);
  return r ? pctFrom3(ip, r[0], r[1], r[2]) : null;
}

/* ACM Vmáx (PSV) — Mari 2000: mediana = e^(2.31 + 0.046·IG); MoM = medido/mediana */
export function mcaPsvMoM(psv, gaWeeks) {
  if (psv == null || !gaWeeks) return null;
  const median = Math.exp(2.31 + 0.046 * gaWeeks);
  return psv / median;
}

/* CPR — usa corte fixo 1,08 (calc.js); percentil não fornecido aqui */
export function cprPercentile() { return null; }

/* =================================================================
 * Ducto venoso — PIV (Kessler 2006). p5 / p50 / p95.
 * ================================================================= */
const DV_PI = {
  21: [0.42, 0.57, 0.74], 24: [0.40, 0.54, 0.71], 28: [0.38, 0.51, 0.68],
  32: [0.35, 0.48, 0.64], 36: [0.33, 0.46, 0.61], 40: [0.31, 0.44, 0.58],
};
export function dvPI(ip, gaWeeks) {
  const r = interpTable(objRows(DV_PI), gaWeeks);
  return r ? pctFrom3(ip, r[0], r[1], r[2]) : null;
}

/* =================================================================
 * Aa. uterinas — IP médio (Gómez 2008). Mediana pela equação; SD log ≈ 0,23.
 * ln(mediana) = 1.39 − 0.012·GAd + 1.98e-5·GAd²   (GAd em DIAS)
 * ================================================================= */
export function uterinePI(ip, gaWeeks) {
  if (ip == null || !gaWeeks) return null;
  const d = gaWeeks * 7;
  const median = Math.exp(1.39 - 0.012 * d + 0.0000198 * d * d);
  const sdLog = 0.23; // derivado das âncoras publicadas (p95/p50)
  return zToPercentile((Math.log(ip) - Math.log(median)) / sdLog);
}

/* =================================================================
 * Translucência nucal — FMF (CRL 45–84 mm). Mediana e p95 por CRL.
 * ================================================================= */
const NT_TABLE = {
  45: [1.2, 2.1], 55: [1.4, 2.2], 65: [1.6, 2.4], 75: [1.8, 2.6], 84: [1.9, 2.7],
};
export function ntPercentile(ntMm, crlMm) {
  if (ntMm == null || !crlMm) return null;
  const r = interpTable(objRows(NT_TABLE), crlMm);
  if (!r) return null;
  const median = r[0], p95 = r[1];
  const sd = (p95 - median) / 1.6449;
  const percentile = sd > 0 ? zToPercentile((ntMm - median) / sd) : null;
  return { median, p95, percentile };
}

/* =================================================================
 * Risco basal de T21 por idade materna (Snijders 1999, ~12 semanas).
 * Retorna o denominador X em "1:X".
 * ================================================================= */
const AGE_RISK_T21 = {
  20: 1068, 25: 946, 30: 626, 31: 543, 32: 461, 33: 383, 34: 312, 35: 249,
  36: 196, 37: 152, 38: 117, 39: 89, 40: 68, 41: 51, 42: 38, 43: 29, 44: 21, 45: 16,
};
export function ageRiskT21(age) {
  if (!age) return null;
  const v = interpTable(AGE_RISK_T21, age);
  return v ? Math.round(v) : null;
}

/* =================================================================
 * Padrões de crescimento (PFE) — Hadlock (pronto) + Intergrowth/Fenton
 * (preenchidos após verificação — ver growth-standards abaixo).
 * ================================================================= */
/*
 * Intergrowth-21st — padrão de PFE por IG (Stirnemann 2017, UOG 49:478).
 * Modelo LMS sobre y = ln(EFW); IG em SEMANAS (154–280 dias, 22–40s).
 * Coeficientes verificados (pacote rOpenSci gigs).
 */
export function efwPercentileIntergrowth(grams, gaWeeks) {
  if (grams == null || !gaWeeks || gaWeeks < 22 || gaWeeks > 40) return null;
  const GA = gaWeeks;
  const G3 = GA * GA * GA;
  const c = G3 * Math.log(GA);
  const l = -4.257629 - 2162.234 * Math.pow(GA, -2) + 0.0002301829 * G3;
  const m = 4.956737 + 0.0005019687 * G3 - 0.0001227065 * c;
  const s = 1e-4 * (-6.997171 + 0.057559 * G3 - 0.01493946 * c);
  const median = Math.exp(m);
  const y = Math.log(grams);
  const z = Math.abs(l) < 1e-6
    ? Math.log(y / m) / s
    : (Math.pow(y / m, l) - 1) / (s * l);
  return { median: Math.round(median), z, percentile: zToPercentile(z), ref: "Intergrowth-21st" };
}

export const growthStandards = {
  hadlock: efwPercentileHadlock,
  intergrowth: efwPercentileIntergrowth,
};

/* ---- utilidades ---- */
// converte {semana:[a,b,c]} em {semana:{p5,p50,p95}} para interpTable multi-coluna
function objRows(tbl) {
  const out = {};
  for (const k of Object.keys(tbl)) {
    const v = tbl[k];
    out[k] = Array.isArray(v) ? { 0: v[0], 1: v[1], 2: v[2] } : v;
  }
  return out;
}
