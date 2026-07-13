import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ToolCallRecord } from '../common/contracts';
export interface WebhookExecutionInput { action: string; prompt?: string; selectedText?: string; documentText?: string; sessionId: string; metadata?: Record<string, unknown> }
export interface WebhookExecutionResult { output?: unknown; answer?: string; warning?: string; toolCall: ToolCallRecord }

const ANALYZER_WEBHOOK_URL = 'https://dev-n8n-247482213949.europe-west8.run.app/webhook/lexhero-document-legal-analysis';
const actionCodes: Record<string, string> = { analyzer: 'ACTION_ANALYZER', atto: 'ACTION_ATTO', contratto: 'ACTION_CONTRATTO', parere: 'ACTION_PARERE', clausola: 'ACTION_CLAUSOLA', trova_norme: 'ACTION_TROVANORME', trova_giurisprudenza: 'ACTION_TROVAJUS', trova_news: 'ACTION_TROVANEWS' };
export function buildWebhookPayload(input: WebhookExecutionInput) {
  const request = input.prompt?.trim() || 'Lavora sul contesto fornito.';
  const code = actionCodes[input.action];
  const sections = [code ? `[STRUMENTO SELEZIONATO: ${code}]\nAttiva questo dipartimento per la richiesta seguente.` : '', request, input.selectedText?.trim() ? `\nTESTO SELEZIONATO IN WORD:\n${input.selectedText.trim()}` : '', input.documentText?.trim() ? `\nDOCUMENTO WORD:\n${input.documentText.trim()}` : ''].filter(Boolean);
  return { chatInput: sections.join('\n\n'), sessionId: input.sessionId, action: code || 'CHAT', selectedText: input.selectedText, documentText: input.documentText, metadata: input.metadata };
}
export function normalizeWebhookAnswer(output: unknown): string {
  const value = Array.isArray(output) ? output[0] : output;
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of ['output', 'answer', 'response', 'text', 'content']) if (typeof record[key] === 'string') return (record[key] as string).trim();
  return '';
}

@Injectable()
export class WebhookClientService {
  constructor(private readonly config: ConfigService) {}
  async execute(input: WebhookExecutionInput): Promise<WebhookExecutionResult> {
    if (this.config.get('LEXHERO_WEBHOOK_ENABLED', 'false') !== 'true') return { warning: 'Webhook non abilitato nella configurazione del server.', toolCall: { tool: 'configured-webhook', status: 'skipped', outputSummary: 'Disabled by server configuration' } };
    const url = input.action === 'analyzer' ? this.config.get<string>('LEXHERO_ANALYZER_WEBHOOK_URL', ANALYZER_WEBHOOK_URL) : this.config.get<string>('LEXHERO_WEBHOOK_URL'); if (!url) return { warning: 'Webhook abilitato ma URL non configurato.', toolCall: { tool: 'configured-webhook', status: 'error' } };
    const configuredTimeout = Number(this.config.get('LEXHERO_WEBHOOK_TIMEOUT_MS', 360_000));
    const timeoutMs = Math.min(600_000, Math.max(30_000, Number.isFinite(configuredTimeout) ? configuredTimeout : 360_000));
    const started = Date.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.config.get('LEXHERO_WEBHOOK_SECRET') ? { authorization: `Bearer ${this.config.get('LEXHERO_WEBHOOK_SECRET')}` } : {}) }, body: JSON.stringify(buildWebhookPayload(input)), signal: controller.signal });
      if (!response.ok) throw new Error(`Webhook returned ${response.status}`); const output = await response.json().catch(() => ({}));
      return { output, answer: normalizeWebhookAnswer(output), toolCall: { tool: 'configured-webhook', status: 'success', outputSummary: 'n8n workflow completed', durationMs: Date.now() - started } };
    } catch (e) { return { warning: `Webhook non disponibile: ${e instanceof Error ? e.message : 'errore sconosciuto'}`, toolCall: { tool: 'configured-webhook', status: 'error', durationMs: Date.now() - started } }; }
    finally { clearTimeout(timeout); }
  }
}
