/*
 * exams.js — Definição declarativa dos tipos de exame e seus campos.
 * Cada exame tem seções; cada seção tem campos. O renderizador (ui.js)
 * transforma isto em formulário; report.js gera o laudo.
 *
 * Tipos de campo: num | text | textarea | date | select | check | seg (segmented) | note
 */

// ---- Blocos reutilizáveis ----
const identSection = () => ({
  id: "ident",
  title: "Identificação",
  fields: [
    { id: "pac_nome", label: "Paciente", type: "text", cols: 2 },
    { id: "pac_idade", label: "Idade materna", type: "num", unit: "anos", cols: 1 },
    { id: "gesta", label: "G/P/A", type: "text", cols: 1, placeholder: "ex.: G2P1A0" },
    { id: "exam_data", label: "Data do exame", type: "date", cols: 1 },
    { id: "dum", label: "DUM", type: "date", cols: 1 },
    { id: "dum_confiavel", label: "DUM", type: "select", cols: 1,
      opts: [["confiavel", "confiável"], ["incerta", "incerta/desconhecida"]] },
    { id: "indicacao", label: "Indicação clínica", type: "text", cols: 3 },
    { id: "medico", label: "Médico(a)", type: "text", cols: 2 },
    { id: "crm", label: "CRM", type: "text", cols: 1 },
  ],
});

const bcfField = {
  id: "bcf", label: "BCF", type: "num", unit: "bpm", cols: 1, min: 60, max: 220,
};

// Datação: DUM (na identificação) + IG informada pela mãe + USG anterior + seletor
const datingSection = () => ({
  id: "datacao",
  title: "Datação / Idade gestacional",
  fields: [
    { id: "ig_mae_sem", label: "IG informada (mãe)", type: "num", unit: "sem", cols: 1, hint: "referida pela paciente" },
    { id: "ig_mae_dias", label: "+ dias", type: "num", unit: "d", cols: 1 },
    { id: "ga_ref", label: "IG de referência", type: "select", cols: 1, default: "auto",
      hint: "comanda laudo e percentis",
      opts: [["auto", "Automática (melhor IG)"], ["previa", "USG anterior"], ["dum", "DUM"],
        ["informada", "Informada pela mãe"], ["bio", "Biometria atual"], ["crl", "CCN"]] },
    { id: "prev_data", label: "Data do USG anterior", type: "date", cols: 1 },
    { id: "prev_ig_sem", label: "IG naquele exame", type: "num", unit: "sem", cols: 1 },
    { id: "prev_ig_dias", label: "+ dias", type: "num", unit: "d", cols: 1 },
    { id: "prev_pfe", label: "PFE anterior", type: "num", unit: "g", cols: 1, opt: true, hint: "p/ ganho ponderal" },
    { id: "dating_out", label: "Idade gestacional", type: "note", compute: "dating", cols: 3 },
  ],
});

const biometrySection = (title = "Biometria fetal") => ({
  id: "biometria",
  title,
  fields: [
    { id: "bpd", label: "DBP", type: "num", unit: "mm", cols: 1, hint: "diâmetro biparietal" },
    { id: "dof", label: "DOF", type: "num", unit: "mm", cols: 1, hint: "diâmetro occipitofrontal" },
    { id: "hc", label: "CC", type: "num", unit: "mm", cols: 1, hint: "circunferência cefálica" },
    { id: "ac", label: "CA", type: "num", unit: "mm", cols: 1, hint: "circunferência abdominal" },
    { id: "fl", label: "CF", type: "num", unit: "mm", cols: 1, hint: "comprimento do fêmur" },
    { id: "hl", label: "Úmero", type: "num", unit: "mm", cols: 1, opt: true },
    { id: "tcd", label: "Cerebelo (DTC)", type: "num", unit: "mm", cols: 1, opt: true },
    { id: "efw_out", label: "Peso fetal estimado", type: "note", compute: "efw", cols: 3 },
    { id: "ratios_out", label: "Relações biométricas", type: "note", compute: "ratios", cols: 3 },
  ],
});

const fluidSection = () => ({
  id: "liquido",
  title: "Líquido amniótico",
  fields: [
    { id: "liquido_metodo", label: "Método", type: "select", cols: 1,
      opts: [["ila", "ILA (4 quadrantes)"], ["bolsao", "Maior bolsão (SDP)"]] },
    { id: "ila_q1", label: "Q1", type: "num", unit: "mm", cols: 1, showIf: (s) => s.liquido_metodo !== "bolsao" },
    { id: "ila_q2", label: "Q2", type: "num", unit: "mm", cols: 1, showIf: (s) => s.liquido_metodo !== "bolsao" },
    { id: "ila_q3", label: "Q3", type: "num", unit: "mm", cols: 1, showIf: (s) => s.liquido_metodo !== "bolsao" },
    { id: "ila_q4", label: "Q4", type: "num", unit: "mm", cols: 1, showIf: (s) => s.liquido_metodo !== "bolsao" },
    { id: "maior_bolsao", label: "Maior bolsão", type: "num", unit: "mm", cols: 1, showIf: (s) => s.liquido_metodo === "bolsao" },
    { id: "liquido_out", label: "Resultado", type: "note", compute: "fluid", cols: 3 },
  ],
});

const placentaSection = () => ({
  id: "placenta",
  title: "Placenta e cordão",
  fields: [
    { id: "placenta_local", label: "Localização", type: "select", cols: 1,
      opts: ["anterior", "posterior", "fúndica", "lateral direita", "lateral esquerda", "prévia"] },
    { id: "placenta_ecotextura", label: "Ecotextura", type: "select", cols: 1,
      opts: [["homogênea", "homogênea"], ["heterogênea", "heterogênea"]], hint: "alternativa ao grau" },
    { id: "placenta_grau", label: "Grau (Grannum)", type: "select", cols: 1, opts: ["0", "I", "II", "III"], hint: "opcional" },
    { id: "placenta_dist_oci", label: "Borda–OCI", type: "num", unit: "mm", cols: 1, hint: "distância ao orifício interno", opt: true },
    { id: "cordao_vasos", label: "Vasos do cordão", type: "select", cols: 1, opts: [["3", "3 vasos"], ["2", "2 vasos"]] },
    { id: "cordao_insercao", label: "Inserção do cordão", type: "select", cols: 2,
      opts: ["normal (central/paracentral)", "marginal", "velamentosa"] },
  ],
});

const dopplerSection = () => ({
  id: "doppler",
  title: "Dopplervelocimetria",
  optional: true,
  fields: [
    { id: "au_ip", label: "A. umbilical — IP", type: "num", cols: 1 },
    { id: "au_ir", label: "A. umbilical — IR", type: "num", cols: 1, opt: true },
    { id: "au_diastole", label: "Diástole umbilical", type: "select", cols: 1,
      opts: [["presente", "presente"], ["zero", "diástole zero"], ["reversa", "diástole reversa"]] },
    { id: "acm_ip", label: "ACM — IP", type: "num", cols: 1 },
    { id: "acm_psv", label: "ACM — Vmáx (PSV)", type: "num", unit: "cm/s", cols: 1, opt: true },
    { id: "cpr_out", label: "Relação cérebro-placentária", type: "note", compute: "cpr", cols: 1 },
    { id: "dv_ip", label: "Ducto venoso — IP", type: "num", cols: 1, opt: true },
    { id: "dv_onda_a", label: "Ducto venoso — onda a", type: "select", cols: 1,
      opts: [["positiva", "positiva"], ["ausente", "ausente"], ["reversa", "reversa"]] },
    { id: "ut_ip_med", label: "Aa. uterinas — IP médio", type: "num", cols: 1, opt: true },
    { id: "ut_incisura", label: "Incisura protodiastólica", type: "select", cols: 1,
      opts: [["ausente", "ausente"], ["unilateral", "unilateral"], ["bilateral", "bilateral"]] },
    { id: "doppler_out", label: "Interpretação", type: "note", compute: "doppler", cols: 3 },
  ],
});

const cervixFields = () => ([
  { id: "colo_via", label: "Via", type: "select", cols: 1, opts: ["transvaginal", "transabdominal", "transperineal"] },
  { id: "colo_comprimento", label: "Comprimento do colo", type: "num", unit: "mm", cols: 1 },
  { id: "afunilamento", label: "Afunilamento", type: "select", cols: 1,
    opts: [["ausente", "ausente"], ["presente", "presente"]] },
  { id: "sludge", label: "Sludge (debris)", type: "select", cols: 1,
    opts: [["ausente", "ausente"], ["presente", "presente"]] },
  { id: "colo_out", label: "Resultado", type: "note", compute: "cervix", cols: 3 },
]);

// Anatomia — soft markers (morfológico)
const softMarkers = () => ({
  id: "marcadores",
  title: "Marcadores de aneuploidia",
  fields: [
    { id: "m_prega", label: "Prega nucal ≥6 mm", type: "check", cols: 1 },
    { id: "m_foco", label: "Foco ecogênico cardíaco", type: "check", cols: 1 },
    { id: "m_intestino", label: "Intestino hiperecogênico", type: "check", cols: 1 },
    { id: "m_pielectasia", label: "Pielectasia (≥4 mm)", type: "check", cols: 1 },
    { id: "m_femur", label: "Fêmur/úmero curto", type: "check", cols: 1 },
    { id: "m_plexo", label: "Cisto de plexo coróide", type: "check", cols: 1 },
    { id: "m_osso_nasal", label: "Osso nasal ausente/hipoplásico", type: "check", cols: 1 },
    { id: "m_ventriculo", label: "Ventriculomegalia leve", type: "check", cols: 1 },
  ],
});

// Sistemas anatômicos (morfológico) — cada um: normal/alterado + descrição
const anatomySystems = [
  ["snc", "Sistema nervoso central"],
  ["face", "Face e pescoço"],
  ["torax", "Tórax e pulmões"],
  ["coracao", "Coração"],
  ["abdome", "Abdome e parede"],
  ["rins", "Rins e trato urinário"],
  ["coluna", "Coluna vertebral"],
  ["membros", "Membros"],
  ["cordao", "Cordão umbilical"],
];

const anatomySection = () => ({
  id: "anatomia",
  title: "Avaliação anatômica",
  fields: anatomySystems.flatMap(([id, label]) => ([
    { id: `an_${id}`, label, type: "seg", cols: 1,
      opts: [["normal", "Normal"], ["alterado", "Alterado"]], default: "normal" },
    { id: `an_${id}_desc`, label: `${label} — descrição do achado`, type: "textarea", cols: 2,
      showIf: (s) => s[`an_${id}`] === "alterado" },
  ])),
});

// ---- Exames ----
export const EXAMS = {
  obstetrica: {
    id: "obstetrica",
    name: "Obstétrica / Doppler",
    icon: "🤰",
    subtitle: "US obstétrica de 2º/3º trimestre com biometria, vitalidade e Doppler",
    sections: [
      identSection(),
      datingSection(),
      {
        id: "geral", title: "Situação fetal", fields: [
          { id: "num_fetos", label: "Nº de fetos", type: "select", cols: 1, opts: ["único", "dois", "três"], default: "único" },
          { id: "situacao", label: "Situação", type: "select", cols: 1, opts: ["longitudinal", "transversa", "oblíqua"] },
          { id: "apresentacao", label: "Apresentação", type: "select", cols: 1, opts: ["cefálica", "pélvica", "córmica", "instável"] },
          { id: "dorso", label: "Dorso", type: "select", cols: 1, opts: ["à esquerda", "à direita", "anterior", "posterior"] },
          bcfField,
          { id: "mov_fetais", label: "Movimentos fetais", type: "select", cols: 1, opts: [["presentes", "presentes"], ["ausentes", "ausentes"]] },
          { id: "sexo", label: "Sexo fetal", type: "select", cols: 1, opts: [["não avaliado", "não avaliado"], ["feminino", "feminino"], ["masculino", "masculino"]] },
        ],
      },
      biometrySection(),
      fluidSection(),
      placentaSection(),
      dopplerSection(),
      { id: "colo", title: "Colo uterino (opcional)", optional: true, fields: cervixFields() },
      { id: "obs", title: "Observações / achados adicionais", fields: [
        { id: "obs_texto", label: "Texto livre", type: "textarea", cols: 3 }] },
    ],
  },

  primeiro_tri: {
    id: "primeiro_tri",
    name: "1º Trimestre / TN",
    icon: "🫧",
    subtitle: "US de 1º trimestre: saco gestacional, viabilidade, TN e anexos",
    sections: [
      identSection(),
      {
        id: "saco", title: "Saco gestacional e implantação", fields: [
          { id: "num_sacos", label: "Nº de sacos gestacionais", type: "select", cols: 1, opts: ["1", "2", "3"], default: "1" },
          { id: "saco_situacao", label: "Situação", type: "select", cols: 1, opts: [["tópico", "tópico"], ["não visualizado", "não visualizado"], ["irregular", "contornos irregulares"]] },
          { id: "trofoblasto", label: "Inserção do trofoblasto", type: "select", cols: 1, opts: ["fúndica", "anterior", "posterior", "lateral direita", "lateral esquerda"] },
          { id: "sac_d1", label: "SG — diâmetro 1", type: "num", unit: "mm", cols: 1 },
          { id: "sac_d2", label: "SG — diâmetro 2", type: "num", unit: "mm", cols: 1 },
          { id: "sac_d3", label: "SG — diâmetro 3", type: "num", unit: "mm", cols: 1 },
          { id: "vesicula", label: "Vesícula vitelina", type: "select", cols: 1, opts: [["presente", "presente"], ["ausente", "ausente"]] },
          { id: "vv_diam", label: "VV — diâmetro", type: "num", unit: "mm", cols: 1, showIf: (s) => s.vesicula === "presente" },
          { id: "dmsg_out", label: "Diâmetro médio do saco (DMSG)", type: "note", compute: "dmsg", cols: 3 },
        ],
      },
      {
        id: "embriao", title: "Embrião / vitalidade", fields: [
          { id: "embriao_visualizado", label: "Embrião", type: "select", cols: 1, opts: [["sim", "visualizado"], ["não", "não visualizado"]], default: "sim" },
          { id: "crl", label: "CCN (CRL)", type: "num", unit: "mm", cols: 1, hint: "cabeça-nádega", showIf: (s) => s.embriao_visualizado !== "não" },
          { id: "atividade_cardiaca", label: "Atividade cardíaca", type: "select", cols: 1, opts: [["presente", "presente"], ["ausente", "ausente"], ["não avaliada", "não avaliada"]], showIf: (s) => s.embriao_visualizado !== "não" },
          { id: "bcf", label: "FCF", type: "num", unit: "bpm", cols: 1, showIf: (s) => s.atividade_cardiaca === "presente" },
          { id: "dating_out", label: "Idade gestacional", type: "note", compute: "dating", cols: 3 },
          { id: "viab_out", label: "Viabilidade (critérios SRU/Doubilet)", type: "note", compute: "viability", cols: 3 },
        ],
      },
      {
        id: "tn", title: "Translucência nucal e marcadores", fields: [
          { id: "idade_materna", label: "Idade materna", type: "num", unit: "anos", cols: 1 },
          { id: "tn", label: "Translucência nucal", type: "num", unit: "mm", cols: 1 },
          { id: "osso_nasal", label: "Osso nasal", type: "select", cols: 1, opts: [["presente", "presente"], ["ausente", "ausente/hipoplásico"]] },
          { id: "dv_onda_a", label: "Ducto venoso — onda a", type: "select", cols: 1, opts: [["positiva", "positiva"], ["ausente", "ausente"], ["reversa", "reversa"]] },
          { id: "regurg_tricuspide", label: "Regurgitação tricúspide", type: "select", cols: 1, opts: [["ausente", "ausente"], ["presente", "presente"]] },
          { id: "tn_out", label: "Interpretação da TN / risco", type: "note", compute: "firsttri", cols: 3 },
        ],
      },
      {
        id: "colecao", title: "Descolamento / coleções", fields: [
          { id: "colecao_tipo", label: "Achado", type: "select", cols: 2, default: "ausente",
            opts: [["ausente", "ausente"], ["descolamento", "descolamento subcoriônico (hematoma)"],
              ["fusao_deciduas", "fusão incompleta das decíduas"], ["separacao_corioamniotica", "separação corioamniótica"]] },
          { id: "desc_d1", label: "Coleção — diâmetro 1", type: "num", unit: "mm", cols: 1, showIf: (s) => s.colecao_tipo && s.colecao_tipo !== "ausente" },
          { id: "desc_d2", label: "diâmetro 2", type: "num", unit: "mm", cols: 1, showIf: (s) => s.colecao_tipo && s.colecao_tipo !== "ausente" },
          { id: "desc_d3", label: "diâmetro 3", type: "num", unit: "mm", cols: 1, showIf: (s) => s.colecao_tipo && s.colecao_tipo !== "ausente" },
          { id: "desc_out", label: "Área/volume e diferencial", type: "note", compute: "descolamento", cols: 3, showIf: (s) => s.colecao_tipo && s.colecao_tipo !== "ausente" },
        ],
      },
      { id: "colo1t", title: "Colo uterino", optional: true, fields: cervixFields() },
      {
        id: "anexos", title: "Útero, ovários e anexos", fields: [
          { id: "corpo_luteo_ovario", label: "Corpo lúteo", type: "select", cols: 1, opts: [["direito", "ovário direito"], ["esquerdo", "ovário esquerdo"], ["não identificado", "não identificado"]] },
          { id: "corpo_luteo_med", label: "Corpo lúteo — medida", type: "num", unit: "mm", cols: 1, showIf: (s) => s.corpo_luteo_ovario && s.corpo_luteo_ovario !== "não identificado" },
          { id: "ovarios_obs", label: "Ovários / anexos", type: "textarea", cols: 3, placeholder: "cistos, massas anexiais, líquido livre…" },
          { id: "utero_obs", label: "Útero", type: "textarea", cols: 3, placeholder: "miomas, malformações, DIU…" },
          { id: "anat_precoce", label: "Anatomia precoce", type: "select", cols: 1, opts: [["normal", "sem alterações"], ["alterado", "com achados"]], default: "normal" },
          { id: "anat_precoce_desc", label: "Descrição", type: "textarea", cols: 2, showIf: (s) => s.anat_precoce === "alterado" },
        ],
      },
    ],
  },

  morfologico: {
    id: "morfologico",
    name: "Morfológico 2º tri",
    icon: "🔬",
    subtitle: "Avaliação morfológica detalhada da anatomia fetal",
    sections: [
      identSection(),
      datingSection(),
      {
        id: "geral", title: "Situação fetal", fields: [
          { id: "num_fetos", label: "Nº de fetos", type: "select", cols: 1, opts: ["único", "dois"], default: "único" },
          { id: "apresentacao", label: "Apresentação", type: "select", cols: 1, opts: ["cefálica", "pélvica", "córmica", "instável"] },
          bcfField,
          { id: "sexo", label: "Sexo fetal", type: "select", cols: 1, opts: [["não avaliado", "não avaliado"], ["feminino", "feminino"], ["masculino", "masculino"]] },
        ],
      },
      biometrySection(),
      anatomySection(),
      softMarkers(),
      fluidSection(),
      placentaSection(),
      { id: "obs", title: "Observações", fields: [{ id: "obs_texto", label: "Texto livre", type: "textarea", cols: 3 }] },
    ],
  },

  gemelar: {
    id: "gemelar",
    name: "Gemelar",
    icon: "👶👶",
    subtitle: "Gestação múltipla: corionicidade, biometria por feto e discordância",
    sections: [
      identSection(),
      datingSection(),
      {
        id: "corion", title: "Corionicidade", fields: [
          { id: "corionicidade", label: "Corionicidade", type: "select", cols: 1,
            opts: ["dicoriônica", "monocoriônica"] },
          { id: "amnionicidade", label: "Amnionicidade", type: "select", cols: 1,
            opts: ["diamniótica", "monoamniótica"] },
          { id: "sinal_membrana", label: "Sinal da membrana", type: "select", cols: 1,
            opts: [["lambda", "lambda (λ) — dicoriônica"], ["t", "T — monocoriônica"]] },
        ],
      },
      {
        id: "fetoA", title: "Feto A", fields: [
          { id: "apresentacao", label: "Apresentação", type: "select", cols: 1, opts: ["cefálica", "pélvica", "córmica"] },
          { id: "bpd", label: "DBP", type: "num", unit: "mm", cols: 1 },
          { id: "hc", label: "CC", type: "num", unit: "mm", cols: 1 },
          { id: "ac", label: "CA", type: "num", unit: "mm", cols: 1 },
          { id: "fl", label: "CF", type: "num", unit: "mm", cols: 1 },
          { id: "efw_out", label: "PFE feto A", type: "note", compute: "efw", cols: 2 },
          { id: "bolsao_a", label: "Maior bolsão (saco A)", type: "num", unit: "mm", cols: 1 },
          { id: "au_ip", label: "A. umbilical IP (A)", type: "num", cols: 1, opt: true },
        ],
      },
      {
        id: "fetoB", title: "Feto B", fields: [
          { id: "b_apresentacao", label: "Apresentação", type: "select", cols: 1, opts: ["cefálica", "pélvica", "córmica"] },
          { id: "b_bpd", label: "DBP", type: "num", unit: "mm", cols: 1 },
          { id: "b_hc", label: "CC", type: "num", unit: "mm", cols: 1 },
          { id: "b_ac", label: "CA", type: "num", unit: "mm", cols: 1 },
          { id: "b_fl", label: "CF", type: "num", unit: "mm", cols: 1 },
          { id: "efwB_out", label: "PFE feto B", type: "note", compute: "efwB", cols: 2 },
          { id: "bolsao_b", label: "Maior bolsão (saco B)", type: "num", unit: "mm", cols: 1 },
          { id: "b_au_ip", label: "A. umbilical IP (B)", type: "num", cols: 1, opt: true },
        ],
      },
      { id: "discord", title: "Discordância / TTTS", fields: [
        { id: "twin_out", label: "Discordância de peso e líquido", type: "note", compute: "twins", cols: 3 }] },
      placentaSection(),
    ],
  },

  cervical: {
    id: "cervical",
    name: "Colo / Cervicometria",
    icon: "📏",
    subtitle: "Medida do colo uterino para rastreio de parto prematuro",
    sections: [
      identSection(),
      datingSection(),
      { id: "colo", title: "Colo uterino", fields: cervixFields() },
      { id: "obs", title: "Observações", fields: [{ id: "obs_texto", label: "Texto livre", type: "textarea", cols: 3 }] },
    ],
  },

  pbf: {
    id: "pbf",
    name: "Perfil Biofísico",
    icon: "❤️",
    subtitle: "Perfil biofísico fetal (escore de Manning)",
    sections: [
      identSection(),
      datingSection(),
      {
        id: "gest", title: "Vitalidade", fields: [
          bcfField,
        ],
      },
      {
        id: "pbf", title: "Componentes (0 ou 2 pontos)", fields: [
          { id: "pbf_resp", label: "Movimentos respiratórios", type: "seg", cols: 1, opts: [["2", "2"], ["0", "0"]] },
          { id: "pbf_mov", label: "Movimentos corporais", type: "seg", cols: 1, opts: [["2", "2"], ["0", "0"]] },
          { id: "pbf_tonus", label: "Tônus fetal", type: "seg", cols: 1, opts: [["2", "2"], ["0", "0"]] },
          { id: "pbf_liquido", label: "Líquido amniótico", type: "seg", cols: 1, opts: [["2", "2"], ["0", "0"]] },
          { id: "pbf_cardio", label: "Cardiotocografia (NST)", type: "seg", cols: 1, opts: [["2", "2"], ["0", "0"]] },
          { id: "pbf_out", label: "Escore", type: "note", compute: "bpp", cols: 3 },
        ],
      },
      fluidSection(),
    ],
  },
};

export const EXAM_ORDER = ["obstetrica", "primeiro_tri", "morfologico", "gemelar", "cervical", "pbf"];
