// Modello di Claude e impegno («effort») per ogni servizio che usa l'IA.
// Dal 25/10/2026 tutti su Claude Haiku 5.5, circa 20 volte più economico di
// Claude Sonnet 5 (0,10 $ / 0,50 $ per milione di token in entrata / uscita,
// sotto i 100.000 token di testo). Per cambiare modello a un servizio basta
// cambiarlo qui: es. 'claude-sonnet-5-5' se la qualità non bastasse.
//
// Effort: quanto il modello ragiona prima di rispondere (il ragionamento si
// paga come testo in uscita). «low» per lavori semplici (tradurre, valutare
// un'email), «medium» per scrivere testi creativi. Con la risposta in formato
// forzato (tool_choice) Haiku 5.5 non ragiona comunque: l'effort regola il
// resto della risposta.

type AiService = 'checkmail' | 'menu' | 'captio' | 'lumen' | 'diarium' | 'landing' | 'offermaker' | 'need' | 'kumi'

export const AI_MODELS: Record<AiService, { model: string; effort: 'low' | 'medium' | 'high' }> = {
  checkmail: { model: 'claude-haiku-5-5', effort: 'low' },
  menu: { model: 'claude-haiku-5-5', effort: 'low' },
  captio: { model: 'claude-haiku-5-5', effort: 'medium' },
  lumen: { model: 'claude-haiku-5-5', effort: 'medium' },
  diarium: { model: 'claude-haiku-5-5', effort: 'medium' },
  landing: { model: 'claude-haiku-5-5', effort: 'medium' },
  offermaker: { model: 'claude-haiku-5-5', effort: 'medium' },
  // «Scrivi cosa ti serve»: scegliere 0–3 servizi da un elenco
  need: { model: 'claude-haiku-5-5', effort: 'low' },
  // Chiedi a KUMI (home): risposte brevi dai testi di KUMANI
  kumi: { model: 'claude-haiku-5-5', effort: 'low' },
}
