/*
 * templates.js — Frases-padrão de normalidade (editáveis pelo usuário).
 * O usuário pode sobrescrever qualquer uma nas Configurações; as versões
 * personalizadas ficam em localStorage e têm prioridade.
 */

export const DEFAULT_TEMPLATES = {
  // Anatomia — morfológico
  snc: "Crânio de contornos e ecogenicidade normais. Estruturas da linha média, cavo do septo pelúcido, ventrículos laterais, plexos coróides, tálamos e fossa posterior (cerebelo e cisterna magna) de aspecto habitual.",
  face: "Perfil facial, órbitas, ossos próprios do nariz e lábio superior sem alterações evidentes.",
  torax: "Tórax simétrico, campos pulmonares homogêneos, sem derrames. Diafragma íntegro.",
  coracao: "Situs solitus. Coração em posição habitual, com quatro câmaras simétricas, septos íntegros e vias de saída de aspecto normal. Cruzamento das grandes artérias preservado. Frequência e ritmo cardíacos regulares.",
  abdome: "Estômago tópico e de aspecto habitual. Parede abdominal íntegra com inserção normal do cordão umbilical. Fígado, vesícula e alças intestinais sem alterações.",
  rins: "Rins tópicos, de morfologia e ecogenicidade normais, sem dilatação pielocalicinal. Bexiga urinária presente e de aspecto normal.",
  coluna: "Coluna vertebral com alinhamento e integridade dos arcos posteriores preservados, com pele íntegra sobrejacente.",
  membros: "Membros superiores e inferiores presentes, com ossos longos de comprimento e ecogenicidade normais; extremidades móveis.",
  cordao: "Cordão umbilical com três vasos (duas artérias e uma veia) e inserção placentária normal.",
  // Blocos gerais
  liquido_normal: "Volume de líquido amniótico normal.",
  placenta_normal: "Placenta de aspecto e espessura normais, com grau de maturidade compatível com a idade gestacional.",
  bcf_normal: "Batimentos cardíacos fetais presentes, rítmicos.",
  doppler_normal: "Estudo dopplervelocimétrico dentro dos limites da normalidade para a idade gestacional.",
  colo_normal: "Colo uterino com comprimento preservado, orifício interno fechado, sem afunilamento.",
  conclusao_normal: "Gestação tópica, feto único e vivo, com biometria e vitalidade adequadas para a idade gestacional.",
};

// Rótulos amigáveis para o editor de templates
export const TEMPLATE_LABELS = {
  snc: "Sistema nervoso central",
  face: "Face",
  torax: "Tórax / pulmões",
  coracao: "Coração",
  abdome: "Abdome / parede",
  rins: "Rins / trato urinário",
  coluna: "Coluna vertebral",
  membros: "Membros",
  cordao: "Cordão umbilical",
  liquido_normal: "Líquido amniótico (normal)",
  placenta_normal: "Placenta (normal)",
  bcf_normal: "Batimentos cardíacos (normal)",
  doppler_normal: "Doppler (normal)",
  colo_normal: "Colo uterino (normal)",
  conclusao_normal: "Conclusão (normal)",
};
