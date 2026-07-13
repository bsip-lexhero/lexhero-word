import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LEGAL_DISCLAIMER } from '../common/contracts';
import type { LlmGenerationInput, LlmGenerationResult, LlmProvider } from './llm.types';

interface GeminiResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string }; error?: { status?: string } }

@Injectable()
export class LlmService implements LlmProvider {
  constructor(private readonly config: ConfigService) {}
  async generate(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    const provider = this.config.get<string>('LLM_PROVIDER', 'mock').toLowerCase();
    if (provider === 'gemini') return this.generateWithGemini(input);
    if (provider === 'mock') return this.generateMock(input);
    throw new ServiceUnavailableException(`Unsupported LLM provider '${provider}'. Use 'gemini' or 'mock'.`);
  }
  async generateThinkingUpdates(action: string, request: string): Promise<{ updates: string[] }> {
    const fallback = thinkingFallback(action);
    if (this.config.get<string>('LLM_PROVIDER', 'mock').toLowerCase() !== 'gemini') return { updates: fallback };
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    const model = this.config.get<string>('GEMINI_THINKING_MODEL', this.config.get<string>('GEMINI_MODEL', 'gemini-3.1-flash-lite'));
    if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) return { updates: fallback };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ system_instruction: { parts: [{ text: 'Sei l\'indicatore di avanzamento di Lexhero. Genera solo brevi aggiornamenti di stato, non ragionamenti interni, conclusioni, consigli legali o affermazioni sul lavoro realmente completato.' }] }, contents: [{ role: 'user', parts: [{ text: `Tipo di attività: ${action}\nRichiesta: ${request.slice(0, 4_000)}\n\nRestituisci esattamente 6 aggiornamenti in italiano, uno per riga, senza numeri o simboli. Ogni riga deve avere 4-10 parole, essere rassicurante ma sobria e descrivere una fase plausibile (lettura, struttura, coerenza, verifica, sintesi, finalizzazione). Non dichiarare risultati.` }] }], generationConfig: { temperature: 0.45, maxOutputTokens: 180, responseMimeType: 'text/plain' } }) });
      if (!response.ok) return { updates: fallback };
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
      const updates = text.split('\n').map((line) => line.replace(/^[-*\d.)\s]+/, '').trim()).filter((line) => line.length >= 8 && line.length <= 100).slice(0, 6);
      return { updates: updates.length >= 3 ? updates : fallback };
    } catch { return { updates: fallback }; }
    finally { clearTimeout(timeout); }
  }
  private async generateWithGemini(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY'); if (!apiKey) throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.1-flash-lite'); if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new ServiceUnavailableException('Invalid GEMINI_MODEL');
    const timeoutMs = Math.min(120_000, Math.max(1_000, Number(this.config.get('GEMINI_TIMEOUT_MS', 45_000)))); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction() }] }, contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'text/plain' } }) });
      const payload = await response.json().catch(() => ({})) as GeminiResponse;
      if (!response.ok) throw new ServiceUnavailableException(`Gemini request failed: ${payload.error?.status || response.status}`);
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      if (!answer) { const reason = payload.promptFeedback?.blockReason || payload.candidates?.[0]?.finishReason || 'empty response'; throw new ServiceUnavailableException(`Gemini returned no answer: ${reason}`); }
      return { answer, provider: model, warnings: [LEGAL_DISCLAIMER] };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ServiceUnavailableException(`Gemini request timed out after ${timeoutMs}ms`);
      throw new ServiceUnavailableException(`Gemini unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally { clearTimeout(timeout); }
  }
  private async generateMock(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    const subject = (input.selectedText || input.prompt || input.documentText || 'la richiesta').trim().slice(0, 600);
    const answers = { analyze: `Analisi preliminare\n\nIl testo disciplina: ${subject}\n\nPunti di attenzione: verificare definizioni, obblighi reciproci, termini, rimedi e coerenza con la legge applicabile.`, rewrite: `Proposta di riscrittura\n\n${subject}\n\nLa disposizione si applica nel rispetto della normativa inderogabile, con formulazione chiara degli obblighi, dei termini e delle conseguenze dell'inadempimento.`, legal_references: 'Ricerca giuridica preliminare\n\nSono state considerate esclusivamente le fonti riportate nella sezione citazioni. Verificare sempre testo vigente e applicabilità al caso concreto.', memo: `Memorandum legale\n\nOggetto: ${subject}\n\nQuestione. Individuare la disciplina italiana applicabile.\n\nAnalisi. Separare fatti, regole, possibili interpretazioni e rischi probatori.`, custom: `Risposta alla richiesta\n\n${input.prompt || 'Esamina il contesto fornito.'}\n\nDistinguere i fatti accertati dalle ipotesi e verificare ogni riferimento normativo.` };
    return { answer: (answers as Partial<Record<import('../common/contracts').LexheroAction, string>>)[input.action] ?? answers.custom, provider: 'mock', warnings: [LEGAL_DISCLAIMER] };
  }
}

function thinkingFallback(action: string) {
  const opening = /rewrite|clausola|contratto|atto/.test(action) ? 'Sto leggendo il testo e la richiesta' : 'Sto inquadrando la richiesta e il contesto';
  return [opening, 'Organizzo i passaggi rilevanti', 'Controllo coerenza e completezza', 'Verifico i punti che richiedono attenzione', 'Preparo una risposta chiara e utilizzabile', 'Finalizzo il risultato del workflow'];
}

export function buildPrompt(input: LlmGenerationInput): string {
  const sections = [`WORKFLOW: ${input.action}`, input.prompt ? `ISTRUZIONE UTENTE:\n${input.prompt}` : '', input.selectedText ? `TESTO SELEZIONATO IN WORD:\n${input.selectedText}` : '', input.documentText ? `CONTESTO DOCUMENTO COMPLETO (incluso esplicitamente dall'utente):\n${input.documentText}` : '', input.externalContext ? `RISULTATI MCP-LEGAL-IT VERIFICATI:\n${input.externalContext}` : '', input.citations.length ? `FONTI NORMALIZZATE DISPONIBILI:\n${input.citations.map((citation, index) => `${index + 1}. ${citation.reference || citation.title}${citation.url ? ` — ${citation.url}` : ''}`).join('\n')}` : 'FONTI NORMALIZZATE DISPONIBILI: nessuna'];
  return sections.filter(Boolean).join('\n\n').slice(0, 700_000);
}

function systemInstruction() { return `Sei Lexhero, un assistente per professionisti legali italiani. Rispondi in italiano salvo richiesta diversa. Sii preciso, leggibile e prudente. Separa chiaramente fatti, analisi, rischi e conclusioni. Non inventare mai norme, sentenze, citazioni, URL o fatti mancanti. Usa riferimenti legali specifici soltanto quando compaiono nei risultati MCP o nelle fonti fornite. Se non esistono fonti verificate, dichiaralo esplicitamente. Per le riscritture, restituisci prima il testo proposto e poi eventuali note sintetiche. Il contenuto non è consulenza legale definitiva e richiede revisione professionale.`; }
