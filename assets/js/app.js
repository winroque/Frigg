/*
 * app.js — Bootstrap e orquestração da interface.
 */
import { EXAMS, EXAM_ORDER } from "./exams.js";
import { generateReport } from "./report.js";
import { renderForm, refresh } from "./ui.js";
import * as refdata from "./refdata.js";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS } from "./templates.js";
import {
  state, onChange, setExam, clearValues, setPref, setTemplate, resetTemplates,
  effectiveTemplates,
} from "./state.js";

const $ = (sel) => document.querySelector(sel);

/* ---------- tema ---------- */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.prefs.theme || "light");
}

/* ---------- abas de exame ---------- */
function renderTabs() {
  const nav = $("#exam-tabs");
  nav.innerHTML = "";
  for (const id of EXAM_ORDER) {
    const e = EXAMS[id];
    const b = document.createElement("button");
    b.className = "exam-tab" + (state.exam === id ? " active" : "");
    b.innerHTML = `${e.icon} ${e.name}`;
    b.addEventListener("click", () => setExam(id));
    nav.appendChild(b);
  }
}

/* ---------- laudo ---------- */
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function renderLaudo() {
  const rep = generateReport(state.exam, state.values, state.prefs, effectiveTemplates());
  const parts = [];
  if (state.prefs.clinicaHeader) parts.push(`<div class="clinic">${esc(state.prefs.clinicaHeader)}</div>`);
  parts.push(`<div class="doc-title">${rep.title}</div>`);
  if (rep.meta.length) {
    parts.push('<div class="meta">' + rep.meta.map(([k, v]) =>
      `<div><span class="lbl">${esc(k)}:</span> <span>${esc(v)}</span></div>`).join("") + "</div>");
  }
  for (const sec of rep.sections) {
    parts.push(`<h3>${esc(sec.title)}</h3>`);
    for (const para of sec.text.split(/\n+/)) parts.push(`<p>${esc(para)}</p>`);
  }
  if (rep.conclusion) {
    parts.push(`<h3>Conclusão</h3><p class="concl">${esc(rep.conclusion)}</p>`);
  }
  const assinaturaNome = state.values.medico ? esc(state.values.medico) : "";
  const crm = state.values.crm ? " — CRM " + esc(state.values.crm) : "";
  if (assinaturaNome) {
    parts.push(`<div class="assinatura"><div class="line"></div>${assinaturaNome}${crm}</div>`);
  }
  $("#laudo").innerHTML = parts.join("\n");
}

/* ---------- render completo (troca de exame) ---------- */
function fullRender() {
  applyTheme();
  renderTabs();
  renderForm($("#forms"));
  renderLaudo();
}

/* ---------- reações a mudanças ---------- */
let lastExam = state.exam;
onChange(() => {
  applyTheme();
  if (state.exam !== lastExam) {
    lastExam = state.exam;
    renderTabs();
    renderForm($("#forms"));
  } else {
    refresh(); // atualiza notas + visibilidade
    // atualiza destaque das abas se necessário
  }
  renderLaudo();
});

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
}

/* ---------- ações ---------- */
function bindActions() {
  $("#btn-print").addEventListener("click", () => window.print());
  $("#btn-copy").addEventListener("click", async () => {
    const text = laudoPlainText();
    try {
      await navigator.clipboard.writeText(text);
      toast("Laudo copiado para a área de transferência");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      toast("Laudo copiado");
    }
  });
  $("#btn-copy-simple").addEventListener("click", copySimplified);
  $("#btn-theme").addEventListener("click", () => {
    setPref("theme", state.prefs.theme === "dark" ? "light" : "dark");
  });
  $("#btn-clear").addEventListener("click", () => {
    if (confirm("Limpar todos os campos preenchidos?")) {
      clearValues();
      renderForm($("#forms")); // reconstrói os campos (senão o DOM mantém os valores)
      renderLaudo();
      toast("Campos limpos");
    }
  });
  $("#btn-settings").addEventListener("click", openSettings);
  $("#settings-close").addEventListener("click", closeSettings);
  $("#settings-back").addEventListener("click", (e) => { if (e.target.id === "settings-back") closeSettings(); });
}

// Formato simplificado: título principal + títulos de seção em negrito + corpo
// simples. Copia como texto rico (HTML, preserva negrito) com fallback texto puro.
function buildSimplified() {
  const rep = generateReport(state.exam, state.values, state.prefs, effectiveTemplates());
  const H = [], T = [];
  const line = (h, t) => { H.push(h); T.push(t == null ? h.replace(/<[^>]+>/g, "") : t); };
  const blank = () => { H.push("<p></p>"); T.push(""); };

  if (state.prefs.clinicaHeader) {
    for (const l of state.prefs.clinicaHeader.split(/\n+/)) line(`<p style="text-align:center">${esc(l)}</p>`, l);
  }
  line(`<p style="text-align:center"><b>${esc(rep.title)}</b></p>`, rep.title);
  blank();
  for (const [k, v] of rep.meta) line(`<p>${esc(k)}: ${esc(v)}</p>`, `${k}: ${v}`);
  if (rep.meta.length) blank();

  for (const sec of rep.sections) {
    line(`<p><b>${esc(sec.title)}:</b></p>`, `${sec.title}:`);
    for (const para of sec.text.split(/\n+/)) line(`<p>${esc(para)}</p>`, para);
    blank();
  }
  if (rep.conclusion) {
    line(`<p><b>CONCLUSÃO:</b></p>`, "CONCLUSÃO:");
    for (const para of rep.conclusion.split(/\n+/)) line(`<p>${esc(para)}</p>`, para);
  }
  const nome = state.values.medico, crm = state.values.crm;
  if (nome) { blank(); line(`<p>${esc(nome)}${crm ? ` — CRM ${esc(crm)}` : ""}</p>`, `${nome}${crm ? ` — CRM ${crm}` : ""}`); }

  return { html: H.join(""), text: T.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

async function copySimplified() {
  const { html, text } = buildSimplified();
  try {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    toast("Laudo simples copiado (negrito preservado)");
  } catch {
    // fallback: seleciona um elemento oculto com o HTML e usa execCommand
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      div.setAttribute("style", "position:fixed;left:-9999px;top:0;white-space:pre-wrap;");
      document.body.appendChild(div);
      const range = document.createRange();
      range.selectNodeContents(div);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand("copy");
      sel.removeAllRanges(); div.remove();
      toast("Laudo simples copiado");
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast("Laudo simples copiado (texto)");
    }
  }
}

function laudoPlainText() {
  // converte o HTML do laudo em texto simples preservando quebras
  const node = $("#laudo").cloneNode(true);
  node.querySelectorAll("h3").forEach((h) => h.textContent = "\n" + h.textContent.toUpperCase() + "\n");
  node.querySelectorAll("p, div").forEach((p) => p.append("\n"));
  return node.textContent.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

/* ---------- configurações ---------- */
function openSettings() {
  const body = $("#settings-body");
  const stdOpts = Object.keys(refdata.growthStandards);
  const stdLabels = { hadlock: "Hadlock 1991", intergrowth: "Intergrowth-21st", fenton: "Fenton 2013" };
  body.innerHTML = `
    <div class="setting-row">
      <div><strong>Curva de crescimento (percentil do PFE)</strong><br>
      <span style="font-size:11.5px;color:var(--muted)">Referência para o percentil do peso fetal estimado.</span></div>
      <select id="set-growth">${stdOpts.map((k) => `<option value="${k}" ${state.prefs.growthStd === k ? "selected" : ""}>${stdLabels[k] || k}</option>`).join("")}</select>
    </div>
    <div class="setting-row">
      <div><strong>Fórmula do peso fetal</strong><br>
      <span style="font-size:11.5px;color:var(--muted)">"Automática" usa o melhor conjunto disponível.</span></div>
      <select id="set-efw">
        <option value="auto" ${state.prefs.efwFormula === "auto" ? "selected" : ""}>Automática (Hadlock)</option>
        <option value="hadlock4" ${state.prefs.efwFormula === "hadlock4" ? "selected" : ""}>Hadlock (DBP,CC,CA,CF)</option>
        <option value="hadlockHCACFL" ${state.prefs.efwFormula === "hadlockHCACFL" ? "selected" : ""}>Hadlock (CC,CA,CF)</option>
        <option value="hadlockBPDACFL" ${state.prefs.efwFormula === "hadlockBPDACFL" ? "selected" : ""}>Hadlock (DBP,CA,CF)</option>
        <option value="hadlockACFL" ${state.prefs.efwFormula === "hadlockACFL" ? "selected" : ""}>Hadlock (CA,CF)</option>
        <option value="intergrowth" ${state.prefs.efwFormula === "intergrowth" ? "selected" : ""}>Intergrowth-21st (CC,CA)</option>
      </select>
    </div>
    <div>
      <strong>Cabeçalho da clínica / médico (opcional)</strong><br>
      <span style="font-size:11.5px;color:var(--muted)">Aparece no topo do laudo impresso.</span>
      <textarea id="set-clinic" style="width:100%;min-height:52px;margin-top:5px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:var(--panel-2);color:var(--ink);font-family:inherit;font-size:12.5px" placeholder="Nome da clínica&#10;Endereço · telefone">${esc(state.prefs.clinicaHeader || "")}</textarea>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong>Frases-padrão (templates)</strong>
        <button class="btn ghost" id="set-tpl-reset" style="font-size:11.5px">Restaurar padrões</button>
      </div>
      <div class="tpl-list"></div>
    </div>
  `;
  // templates
  const list = body.querySelector(".tpl-list");
  const eff = effectiveTemplates();
  for (const key of Object.keys(DEFAULT_TEMPLATES)) {
    const box = document.createElement("div"); box.className = "tpl";
    box.innerHTML = `<label>${TEMPLATE_LABELS[key] || key}</label>`;
    const ta = document.createElement("textarea");
    ta.value = eff[key];
    ta.addEventListener("input", () => setTemplate(key, ta.value));
    box.appendChild(ta);
    list.appendChild(box);
  }
  body.querySelector("#set-growth").addEventListener("change", (e) => setPref("growthStd", e.target.value));
  body.querySelector("#set-efw").addEventListener("change", (e) => setPref("efwFormula", e.target.value));
  body.querySelector("#set-clinic").addEventListener("input", (e) => setPref("clinicaHeader", e.target.value));
  body.querySelector("#set-tpl-reset").addEventListener("click", () => {
    if (confirm("Restaurar todas as frases-padrão?")) { resetTemplates(); toast("Templates restaurados"); closeSettings(); }
  });
  $("#settings-back").classList.add("open");
}
function closeSettings() { $("#settings-back").classList.remove("open"); }

/* ---------- init ---------- */
bindActions();
fullRender();
