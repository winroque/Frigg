/*
 * references.js — Núcleo científico do Frigg
 * ------------------------------------------------------------------
 * Funções e tabelas de referência para ultrassonografia obstétrica.
 * Todas as fontes estão citadas em comentário junto de cada bloco.
 *
 * Convenção de unidades:
 *   - Biometrias (DBP/CC/CA/CF) em MILÍMETROS na interface; convertidas
 *     internamente para cm quando a fórmula exige (Hadlock usa cm).
 *   - Idade gestacional (IG) manipulada em DIAS; exibida em "Xs Yd".
 *   - Peso em GRAMAS.
 *
 * AVISO: ferramenta de apoio à elaboração de laudos. Não substitui
 * julgamento clínico nem software de rastreio certificado.
 */

/* =================================================================
 * 1. Estatística — distribuição normal (percentil ⇄ z-score)
 * ================================================================= */

// Função erro (Abramowitz & Stegun 7.1.26), erro |ε| < 1.5e-7
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

// CDF da normal padrão: probabilidade acumulada até z
export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Inversa da CDF normal (Acklam / Beasley-Springer-Moro), p ∈ (0,1)
export function normalInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= ph) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// z-score → percentil (0-100)
export function zToPercentile(z) {
  return normalCdf(z) * 100;
}

// Interpolação linear de uma tabela {x: valor} para x arbitrário
export function interpTable(table, x, keyFn = Number) {
  const keys = Object.keys(table).map(keyFn).sort((a, b) => a - b);
  if (x <= keys[0]) return table[keys[0]];
  if (x >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  let lo = keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i]) {
      const hi = keys[i];
      const f = (x - lo) / (hi - lo);
      const vlo = table[lo], vhi = table[hi];
      if (typeof vlo === "number") return vlo + f * (vhi - vlo);
      // objeto com múltiplas colunas (p3/p10/p50/…): interpola cada uma
      const out = {};
      for (const k of Object.keys(vlo)) out[k] = vlo[k] + f * (vhi[k] - vlo[k]);
      return out;
    }
    lo = keys[i];
  }
  return table[keys[keys.length - 1]];
}

/* =================================================================
 * 2. Idade gestacional & datação
 * ================================================================= */

export const MS_DAY = 86400000;

// Diferença em dias entre duas datas (Date)
export function daysBetween(a, b) {
  return Math.round((b - a) / MS_DAY);
}

// IG (dias) → "Xs Yd"
export function formatGaDays(days) {
  if (days == null || !isFinite(days)) return "—";
  const d = Math.round(days);
  const w = Math.floor(d / 7);
  const r = d - w * 7;
  return `${w}s${r}d`;
}

// IG decimal em semanas → dias
export function weeksToDays(weeks) { return Math.round(weeks * 7); }
export function daysToWeeks(days) { return days / 7; }

// DUM → IG (dias) na data do exame
export function gaFromLMP(lmp, examDate) {
  if (!lmp || !examDate) return null;
  return daysBetween(lmp, examDate);
}

// Naegele: DPP = DUM + 280 dias
export function eddFromLMP(lmp) {
  if (!lmp) return null;
  return new Date(lmp.getTime() + 280 * MS_DAY);
}

// DPP a partir de uma IG conhecida numa data (retrocede para "DUM efetiva")
export function eddFromGa(gaDays, onDate) {
  if (gaDays == null || !onDate) return null;
  const remaining = 280 - gaDays;
  return new Date(onDate.getTime() + remaining * MS_DAY);
}

/*
 * CCN (CRL) → IG. Robinson & Fleming (1975):
 *   IG(dias) = 8.052 · √(CRL·1.037) + 23.73    [CRL em mm]
 * Faixa validada: CRL 10–84 mm (≈ 7–14 semanas).
 */
export function gaFromCRL(crlMm) {
  if (!crlMm || crlMm <= 0) return null;
  const days = 8.052 * Math.sqrt(crlMm * 1.037) + 23.73;
  return { days, weeks: days / 7, valid: crlMm >= 5 && crlMm <= 95 };
}

/*
 * IG por biometria — regressões de Hadlock (1984), medidas em CM.
 * Retorna IG em semanas para cada parâmetro (quando informado).
 * Hadlock FP et al. Am J Obstet Gynecol 1984;150:97.
 */
export function gaFromBiometry({ bpd, hc, ac, fl }) {
  // parâmetros recebidos em mm → converte p/ cm
  const out = {};
  if (bpd) { const x = bpd / 10; out.bpd = 9.54 + 1.482 * x + 0.1676 * x * x; }
  if (hc)  { const x = hc / 10;  out.hc  = 8.96 + 0.540 * x + 0.0003 * x * x * x; }
  if (ac)  { const x = ac / 10;  out.ac  = 8.14 + 0.753 * x + 0.0036 * x * x; }
  if (fl)  { const x = fl / 10;  out.fl  = 10.35 + 2.460 * x + 0.170 * x * x; }
  const vals = Object.values(out).filter((v) => isFinite(v));
  if (!vals.length) return null;
  out.composite = vals.reduce((s, v) => s + v, 0) / vals.length; // média (semanas)
  return out; // semanas
}

/* =================================================================
 * 3. Peso fetal estimado (PFE / EFW) — fórmulas de Hadlock (1985)
 *    Medidas em CM, resultado em gramas. Hadlock FP, Radiology 1984/85.
 * ================================================================= */

export const EFW_FORMULAS = {
  // 4 parâmetros (BPD, HC, AC, FL) — padrão quando todos disponíveis
  hadlock4: {
    label: "Hadlock (DBP, CC, CA, CF)",
    need: ["bpd", "hc", "ac", "fl"],
    fn: ({ bpd, hc, ac, fl }) => {
      const B = bpd / 10, H = hc / 10, A = ac / 10, F = fl / 10;
      const log = 1.3596 - 0.00386 * A * F + 0.0064 * H + 0.00061 * B * A +
        0.0424 * A + 0.174 * F;
      return Math.pow(10, log);
    },
  },
  // 3 parâmetros (HC, AC, FL)
  hadlockHCACFL: {
    label: "Hadlock (CC, CA, CF)",
    need: ["hc", "ac", "fl"],
    fn: ({ hc, ac, fl }) => {
      const H = hc / 10, A = ac / 10, F = fl / 10;
      const log = 1.326 - 0.00326 * A * F + 0.0107 * H + 0.0438 * A + 0.158 * F;
      return Math.pow(10, log);
    },
  },
  // 3 parâmetros (BPD, AC, FL)
  hadlockBPDACFL: {
    label: "Hadlock (DBP, CA, CF)",
    need: ["bpd", "ac", "fl"],
    fn: ({ bpd, ac, fl }) => {
      const B = bpd / 10, A = ac / 10, F = fl / 10;
      const log = 1.335 - 0.0034 * A * F + 0.0316 * B + 0.0457 * A + 0.1623 * F;
      return Math.pow(10, log);
    },
  },
  // 2 parâmetros (AC, FL)
  hadlockACFL: {
    label: "Hadlock (CA, CF)",
    need: ["ac", "fl"],
    fn: ({ ac, fl }) => {
      const A = ac / 10, F = fl / 10;
      const log = 1.304 + 0.05281 * A + 0.1938 * F - 0.004 * A * F;
      return Math.pow(10, log);
    },
  },
  // Intergrowth-21st (Stirnemann 2017) — usa CC e CA (cm)
  intergrowth: {
    label: "Intergrowth-21st (CC, CA)",
    need: ["hc", "ac"],
    fn: ({ hc, ac }) => {
      const A = ac / 10 / 100, H = hc / 10 / 100; // cm → /100
      const ln = 5.084820 - 54.06633 * Math.pow(A, 3) -
        95.80076 * Math.pow(A, 3) * Math.log(A) + 3.136370 * H;
      return Math.exp(ln);
    },
  },
};

// Escolhe a melhor fórmula disponível dado o conjunto de medidas
export function estimateEFW(meas, prefer = "auto") {
  const has = (k) => meas[k] != null && meas[k] > 0;
  const order = prefer !== "auto" && EFW_FORMULAS[prefer]
    ? [prefer, "hadlock4", "hadlockHCACFL", "hadlockBPDACFL", "hadlockACFL"]
    : ["hadlock4", "hadlockHCACFL", "hadlockBPDACFL", "hadlockACFL"];
  for (const key of order) {
    const f = EFW_FORMULAS[key];
    if (f.need.every(has)) return { grams: Math.round(f.fn(meas)), formula: key, label: f.label };
  }
  return null;
}

/* =================================================================
 * 4. Percentil do PFE por IG
 * ================================================================= */

/*
 * HADLOCK (1991) — percentis de peso fetal por IG.
 * Hadlock FP et al. Radiology 1991;181:129. Modelo de coeficiente de
 * variação ~constante: p10 ≈ 0,75·p50 e p90 ≈ 1,25·p50.
 * Tabela do 50º percentil (g) por semana completa.
 */
const HADLOCK_EFW_P50 = {
  10: 35, 11: 45, 12: 58, 13: 73, 14: 93, 15: 117, 16: 146, 17: 181,
  18: 223, 19: 273, 20: 331, 21: 399, 22: 478, 23: 568, 24: 670, 25: 785,
  26: 913, 27: 1055, 28: 1210, 29: 1379, 30: 1559, 31: 1751, 32: 1953,
  33: 2162, 34: 2377, 35: 2595, 36: 2813, 37: 3028, 38: 3236, 39: 3435,
  40: 3619, 41: 3787, 42: 3934,
};
// CV constante de Hadlock (SD como fração da média)
const HADLOCK_EFW_CV = 0.195; // ⇒ p90/p50 = 1,25 ; p10/p50 = 0,75

// Percentil e z-score de um PFE para dada IG (semanas decimais) — Hadlock
export function efwPercentileHadlock(grams, gaWeeks) {
  const median = interpTable(HADLOCK_EFW_P50, gaWeeks);
  if (!median) return null;
  const sd = HADLOCK_EFW_CV * median;
  const z = (grams - median) / sd;
  return { median: Math.round(median), sd: Math.round(sd), z, percentile: zToPercentile(z), ref: "Hadlock 1991" };
}

// Espera-se preenchimento posterior (referências pesquisadas): Intergrowth / Fenton
export const growthStandards = {
  hadlock: { label: "Hadlock 1991", fn: efwPercentileHadlock },
  // intergrowth / fenton adicionados abaixo, após verificação das tabelas
};

/* =================================================================
 * 5. Adequação do crescimento / classificação
 * ================================================================= */

export function classifyGrowth(percentile) {
  if (percentile == null) return null;
  if (percentile < 3) return { tag: "PIG grave", cls: "grave", txt: "abaixo do percentil 3" };
  if (percentile < 10) return { tag: "PIG", cls: "alerta", txt: "entre os percentis 3 e 10" };
  if (percentile > 97) return { tag: "GIG grave", cls: "grave", txt: "acima do percentil 97" };
  if (percentile > 90) return { tag: "GIG", cls: "alerta", txt: "entre os percentis 90 e 97" };
  return { tag: "AIG", cls: "ok", txt: "adequado para a idade gestacional (percentis 10–90)" };
}
