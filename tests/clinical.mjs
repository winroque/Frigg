// Testes clínicos dos módulos puros (sem DOM). Rode: node tests/clinical.mjs
import * as R from "../assets/js/references.js";
import * as C from "../assets/js/calc.js";
import { generateReport } from "../assets/js/report.js";

let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, cond, got) {
  if (cond) { pass++; console.log(`  ✓ ${name}` + (got != null ? `  (${got})` : "")); }
  else { fail++; console.log(`  ✗ ${name}  → ${got}`); }
}

console.log("\n== Datação ==");
// Robinson: CCN 60 mm ≈ 12s3d (≈87 dias)
const crl = R.gaFromCRL(60);
check("CCN 60mm ≈ 12s3d", approx(crl.days, 87, 3), R.formatGaDays(crl.days));
// CCN 45mm ≈ 11s2d (~79 dias)
const crl45 = R.gaFromCRL(45);
check("CCN 45mm ≈ 11s (77-80d)", approx(crl45.days, 78, 3), R.formatGaDays(crl45.days));
// Naegele: DUM 01/01 → DPP 08/10 (+280)
const edd = R.eddFromLMP(new Date("2025-01-01T00:00:00"));
check("Naegele DPP +280d", edd.toISOString().slice(0, 10) === "2025-10-08", edd.toISOString().slice(0, 10));

console.log("\n== Biometria / PFE ==");
// ~32 semanas típico: DBP 82, CC 292, CA 285, CF 62 → PFE ~1900-2100g
const efw = R.estimateEFW({ bpd: 82, hc: 292, ac: 285, fl: 62 });
check("PFE 32s ~1800-2200g", efw.grams > 1700 && efw.grams < 2300, efw.grams + "g / " + efw.formula);
const pct = R.efwPercentileHadlock(efw.grams, 32);
check("Percentil PFE ~30-70 (p50 32s=1953)", pct.percentile > 25 && pct.percentile < 75, "p" + Math.round(pct.percentile));
// PIG: peso muito baixo p/ 32s
const pig = R.efwPercentileHadlock(1300, 32);
check("PFE 1300g@32s < p10", pig.percentile < 10, "p" + Math.round(pig.percentile));
check("classifica PIG", R.classifyGrowth(pig.percentile).tag.includes("PIG"), R.classifyGrowth(pig.percentile).tag);

console.log("\n== Intergrowth-21st ==");
import * as REF from "../assets/js/refdata.js";
// 40s mediana verificada ≈ 3338 g
const ig40 = REF.efwPercentileIntergrowth(3338, 40);
check("IG21 mediana 40s ≈ 3338g (p~50)", approx(ig40.median, 3338, 5) && approx(ig40.percentile, 50, 3), ig40.median + "g p" + Math.round(ig40.percentile));
// 32s mediana ≈ 1755 g
const ig32 = REF.efwPercentileIntergrowth(1755, 32);
check("IG21 mediana 32s ≈ 1755g (p~50)", approx(ig32.median, 1755, 5) && approx(ig32.percentile, 50, 3), ig32.median + "g p" + Math.round(ig32.percentile));
// 32s 97th ≈ 2266 g
const ig32_97 = REF.efwPercentileIntergrowth(2266, 32);
check("IG21 2266g@32s ≈ p97", approx(ig32_97.percentile, 97, 2), "p" + ig32_97.percentile.toFixed(1));
// fórmula estimação Intergrowth (HC+AC)
const igEfw = R.estimateEFW({ hc: 330, ac: 350 }, "intergrowth");
check("IG21 estimação AC35/HC33 ≈ 3340g", approx(igEfw.grams, 3340, 60), igEfw.grams + "g");

console.log("\n== GA por biometria ==");
const gaB = R.gaFromBiometry({ bpd: 82, hc: 292, ac: 285, fl: 62 });
check("GA composto ~31-33s", approx(gaB.composite, 32, 1.5), gaB.composite.toFixed(1) + "s");

console.log("\n== Líquido (Moore & Cayle) ==");
const fluid = C.computeFluid({ ila_q1: 40, ila_q2: 45, ila_q3: 38, ila_q4: 37 }, 30); // 160mm=16cm
check("ILA 16cm@30s = normal", fluid.classificacao.tag === "normal", fluid.ilaCm + "cm / " + fluid.classificacao.tag);
const oli = C.computeFluid({ ila_q1: 10, ila_q2: 10, ila_q3: 10, ila_q4: 8 }, 30); // 38mm=3.8cm
check("ILA 3.8cm = oligoâmnio", oli.classificacao.tag === "oligoâmnio", oli.ilaCm + "cm");
const poli = C.computeFluid({ ila: 280 }, 30); // 28cm
check("ILA 28cm = polidrâmnio", poli.classificacao.tag === "polidrâmnio", poli.ilaCm + "cm");

console.log("\n== Doppler ==");
const dop = C.computeDoppler({ au_ip: 1.4, au_diastole: "reversa", acm_ip: 1.2 }, 32);
check("umbilical alterada (diástole reversa)", dop.umbilical.alterado === true, JSON.stringify(dop.umbilical.pct));
check("IPC calculada", dop.cpr != null && approx(dop.cpr, 1.2 / 1.4, 0.01), dop.cpr?.toFixed(2));
check("IPC < 1,08 → alterada", dop.cprAlterado === true, dop.cpr?.toFixed(2));
const psv = C.computeDoppler({ acm_psv: 80 }, 32);
check("ACM PSV MoM calculado", psv.acm.mom != null && psv.acm.mom > 1.5, psv.acm.mom?.toFixed(2) + " MoM");

console.log("\n== TN (FMF) ==");
const ft = C.computeFirstTri({ crl: 60, tn: 3.6, idade_materna: 38 });
check("TN 3.6mm aumentada", ft.ntAumentada === true, "p" + Math.round(ft.ntPct));
check("risco idade 38a ~1:117", approx(ft.riscoIdadeT21, 117, 5), "1:" + ft.riscoIdadeT21);

console.log("\n== Geração de laudo (obstétrica) ==");
const rep = generateReport("obstetrica", {
  pac_nome: "Teste", exam_data: "2026-07-16", dum: "2025-12-20",
  bpd: 82, hc: 292, ac: 285, fl: 62, ila_q1: 40, ila_q2: 45, ila_q3: 38, ila_q4: 37,
  placenta_local: "anterior", placenta_grau: "II", bcf: 145, apresentacao: "cefálica",
  au_ip: 0.9, acm_ip: 1.9,
}, { growthStd: "hadlock" }, {});
check("laudo tem título", /OBSTÉTRICA/.test(rep.title), rep.title);
check("laudo tem seções", rep.sections.length >= 4, rep.sections.length + " seções");
check("conclusão presente", rep.conclusion.length > 10, rep.conclusion.slice(0, 60) + "…");
console.log("\n--- Exemplo de conclusão ---\n" + rep.conclusion + "\n");

console.log("\n== Todos os exames geram laudo sem erro ==");
for (const ex of ["obstetrica", "primeiro_tri", "morfologico", "gemelar", "cervical", "pbf"]) {
  try {
    const r = generateReport(ex, { crl: 60, tn: 2, bpd: 50, hc: 180, ac: 160, fl: 33, idade_materna: 30, colo_comprimento: 32, pbf_resp: "2", pbf_mov: "2", pbf_tonus: "2", pbf_liquido: "2", pbf_cardio: "2", b_bpd: 49, b_hc: 178, b_ac: 158, b_fl: 32 }, {}, {});
    check(`exame ${ex}`, r.sections.length > 0, r.sections.length + " seções");
  } catch (e) { check(`exame ${ex}`, false, e.message); }
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
