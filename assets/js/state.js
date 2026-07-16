/*
 * state.js — Estado central + persistência offline (localStorage).
 */
import { DEFAULT_TEMPLATES } from "./templates.js";

const K_VALUES = "frigg:values";
const K_PREFS = "frigg:prefs";
const K_TEMPLATES = "frigg:templates";
const K_EXAM = "frigg:exam";

const DEFAULT_PREFS = {
  theme: "light",
  growthStd: "hadlock",
  efwFormula: "auto",
  clinicaHeader: "",
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* modo privado */ }
}

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(state)); }

export const state = {
  exam: load(K_EXAM, "obstetrica"),
  values: load(K_VALUES, {}),
  prefs: { ...DEFAULT_PREFS, ...load(K_PREFS, {}) },
  templates: { ...load(K_TEMPLATES, {}) }, // apenas sobrescritas do usuário
};

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setExam(id) {
  state.exam = id;
  save(K_EXAM, id);
  notify();
}

export function setValue(field, value) {
  if (value === "" || value == null) delete state.values[field];
  else state.values[field] = value;
  save(K_VALUES, state.values);
  notify();
}

export function setValues(patch) {
  Object.assign(state.values, patch);
  save(K_VALUES, state.values);
  notify();
}

export function clearValues() {
  state.values = {};
  save(K_VALUES, state.values);
  notify();
}

export function setPref(key, value) {
  state.prefs[key] = value;
  save(K_PREFS, state.prefs);
  notify();
}

export function setTemplate(key, value) {
  if (!value || value === DEFAULT_TEMPLATES[key]) delete state.templates[key];
  else state.templates[key] = value;
  save(K_TEMPLATES, state.templates);
  notify();
}

export function resetTemplates() {
  state.templates = {};
  save(K_TEMPLATES, state.templates);
  notify();
}

// Templates efetivos (default + sobrescritas)
export function effectiveTemplates() {
  return { ...DEFAULT_TEMPLATES, ...state.templates };
}
