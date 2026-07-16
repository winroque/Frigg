# Frigg — Gerador de Laudos de Obstetrícia

Aplicativo **web, estático e 100% offline** para elaboração de laudos de
**ultrassonografia obstétrica**, no estilo de sistemas como o *Turing* e o
*Ultrasystem*: você preenche os campos e o **laudo narrativo em português** é
gerado ao vivo, com **calculadoras clínicas embutidas** (idade gestacional,
peso fetal estimado, percentis, Doppler, líquido amniótico, etc.).

> ⚕️ **Ferramenta de apoio à elaboração de laudos.** Os cálculos e percentis
> baseiam-se em referências publicadas e **não substituem o julgamento clínico**
> nem software de rastreio certificado. Confira sempre os valores.

## Tipos de exame

| Exame | Conteúdo |
|-------|----------|
| **Obstétrica / Doppler** | Datação, biometria, PFE + percentil, líquido, placenta/cordão, Dopplers (a. umbilical, ACM, IPC, ducto venoso, aa. uterinas), colo (opcional) |
| **1º Trimestre / TN** | Datação por CCN, translucência nucal + percentil, osso nasal, ducto venoso, risco basal por idade materna |
| **Morfológico 2º tri** | Anatomia fetal por sistema (SNC, face, tórax, coração, abdome, rins, coluna, membros, cordão) + marcadores de aneuploidia |
| **Gemelar** | Corionicidade/amnionicidade, biometria por feto, discordância de peso, sinais de STFF |
| **Colo / Cervicometria** | Comprimento do colo, afunilamento, sludge, risco de parto prematuro |
| **Perfil Biofísico** | Escore de Manning (5 componentes) |

## Recursos

- **Cálculos ao vivo**: idade gestacional (DUM, CCN, biometria) com regra da
  "melhor IG" e concordância US × DUM; peso fetal estimado e percentil;
  classificação PIG/AIG/GIG; ILA/maior bolsão; índices Doppler com percentis.
- **Referências selecionáveis** para o percentil de peso: **Hadlock 1991** e
  **Intergrowth-21st**. Fórmula de PFE selecionável (Hadlock 1–4 param. / Intergrowth).
- **Exportar PDF / imprimir** com layout profissional A4 (botão *Imprimir / PDF* →
  "Salvar como PDF" do navegador).
- **Salvamento offline** (localStorage): dados do exame, preferências e
  **frases-padrão (templates) editáveis** persistem no navegador.
- **Laudo editável** antes de exportar; botão *Copiar laudo*.
- Tema claro/escuro. **Nenhum dado é enviado à internet.**

## Fundamentação científica (fontes)

- **Datação por CCN**: Robinson & Fleming, 1975.
- **IG por biometria / PFE**: Hadlock FP et al., 1984/1985; percentis de peso: Hadlock 1991.
- **Curva de crescimento Intergrowth-21st**: Stirnemann J et al., *UOG* 2017;49:478.
- **Líquido amniótico (ILA)**: Moore & Cayle, *AJOG* 1990;162:1168.
- **Doppler a. umbilical / ACM (IP)**: Arduini & Rizzo, *J Perinat Med* 1990.
- **ACM Vmáx (anemia)**: Mari G et al., *NEJM* 2000;342:9.
- **Aa. uterinas (IP médio)**: Gómez O et al., *UOG* 2008;32:128.
- **Ducto venoso**: Kessler J et al., *UOG* 2006;28:890.
- **Translucência nucal**: Fetal Medicine Foundation / Snijders-Nicolaides, 1998.
- **Comprimento do colo**: Iams JD et al., *NEJM* 1996;334:567.
- **Risco por idade materna (T21)**: Snijders RJM et al., *UOG* 1999.

> As tabelas de percentil por semana para alguns índices Doppler são valores
> representativos das publicações originais e servem como adjunto ao valor medido.
> A curva de **Fenton** não foi incluída por depender de dados sob licença; caso
> seja necessária, os coeficientes LMS oficiais podem ser adicionados a
> `assets/js/refdata.js`.

## Como publicar (GitHub Pages)

O site é estático puro na raiz do repositório (com `.nojekyll`), então a
forma mais simples de publicar é o modo **"Deploy from a branch"**:

1. **Settings ▸ Pages ▸ Build and deployment ▸ Source** → **Deploy from a branch**.
2. Em **Branch**, selecione **`main`** e a pasta **`/ (root)`**; clique **Save**.
3. Em ~1 minuto o site fica no ar em: `https://<seu-usuário>.github.io/Frigg/`.

Como é um site estático puro, você também pode simplesmente abrir o
`index.html` localmente no navegador.

## Executar localmente

```bash
python3 -m http.server 8099
# abra http://localhost:8099
```

## Testes

Testes clínicos dos módulos de cálculo (sem navegador):

```bash
node tests/clinical.mjs
```

## Estrutura

```
index.html
assets/css/    styles.css (UI) · print.css (laudo A4)
assets/js/
  references.js  fórmulas (Hadlock, Robinson, PFE, percentil, estatística)
  refdata.js     tabelas verificadas (ILA, Doppler, TN, Intergrowth, risco idade)
  calc.js        calculadoras clínicas de alto nível
  exams.js       definição declarativa dos 6 tipos de exame
  report.js      motor de geração do laudo narrativo + conclusão
  templates.js   frases-padrão de normalidade (editáveis)
  ui.js          renderização dos formulários + notas de cálculo ao vivo
  state.js       estado + persistência offline (localStorage)
  app.js         bootstrap / orquestração / export
tests/clinical.mjs
```
