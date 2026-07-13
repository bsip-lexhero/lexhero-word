import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Citation, ToolCallRecord } from '../common/contracts';

export interface LegalSearchInput { query: string; jurisdiction?: string }
export interface LegalSearchResult { citations: Citation[]; summary: string; toolCall: ToolCallRecord; mocked: boolean }

type PlannedCall = { name: string; arguments: Record<string, unknown> };

const ARTICLE_REFERENCE = /\bart\.?\s*\d+(?:[-–][a-z]+|\s*(?:bis|ter|quater))?(?:\s+(?:c\.?\s*c\.?|c\.?\s*p\.?|cost\.?|gdpr)|\s+(?:d\.?\s*lgs\.?|l\.?|reg\.?)[^,;.\n]{0,35})?/i;
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"']+/g;
const LEGAL_REFERENCE = /(?:Cass\.?[^\n]{0,90}?\b\d{1,6}\/\d{4}|art\.?\s*\d+(?:[-–][a-z]+|\s*(?:bis|ter|quater))?[^\n]{0,70})/gi;

export function planLegalToolCalls(query: string, availableTools: string[], maxResults = 5): PlannedCall[] {
  const available = new Set(availableTools);
  const article = query.match(ARTICLE_REFERENCE)?.[0]?.trim();
  const calls: PlannedCall[] = [];
  if (article && available.has('cite_law')) calls.push({ name: 'cite_law', arguments: { reference: article, include_annotations: false } });
  if (available.has('cerca_giurisprudenza_unificata')) calls.push({ name: 'cerca_giurisprudenza_unificata', arguments: { query, fonti: 'tutte', max_risultati: maxResults } });
  else if (available.has('cerca_giurisprudenza')) calls.push({ name: 'cerca_giurisprudenza', arguments: { query, archivio: 'tutti', max_risultati: maxResults } });
  else if (!calls.length && available.has('cerca_gazzetta_ufficiale')) calls.push({ name: 'cerca_gazzetta_ufficiale', arguments: { query, max_risultati: maxResults } });
  return calls.slice(0, 2);
}

export function extractMcpText(result: CallToolResult): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const text = blocks.filter((block): block is Extract<(typeof blocks)[number], { type: 'text' }> => block.type === 'text').map((block) => block.text).join('\n\n').trim();
  return text || (result.structuredContent ? JSON.stringify(result.structuredContent) : '');
}

export function normalizeMcpCitations(text: string, tool: string): Citation[] {
  const citations: Citation[] = []; const seen = new Set<string>();
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:]+$/, ''); if (seen.has(url)) continue; seen.add(url);
    const lineStart = text.lastIndexOf('\n', match.index ?? 0) + 1; const line = cleanMarkdown(text.slice(lineStart, match.index));
    citations.push({ title: line.slice(0, 180) || new URL(url).hostname, source: `mcp-legal-it · ${tool}`, url, jurisdiction: 'IT', excerpt: surroundingExcerpt(text, match.index ?? 0) });
  }
  if (!citations.length) {
    for (const match of text.matchAll(LEGAL_REFERENCE)) {
      const reference = cleanMarkdown(match[0]); if (tool.includes('giurisprudenza') && !/^Cass\./i.test(reference)) continue; const key = reference.toLocaleLowerCase('it-IT'); if (seen.has(key)) continue; seen.add(key);
      citations.push({ title: reference.slice(0, 180), reference, source: `mcp-legal-it · ${tool}`, jurisdiction: 'IT', excerpt: surroundingExcerpt(text, match.index ?? 0) });
      if (citations.length >= 10) break;
    }
  }
  return citations.slice(0, 10);
}

function cleanMarkdown(value: string) { return value.replace(/[>*_`#]/g, '').replace(/^\s*[-•]+\s*/, '').replace(/\s+/g, ' ').trim(); }
function surroundingExcerpt(text: string, index: number) { const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1); const endAt = text.indexOf('\n', index + 1); return cleanMarkdown(text.slice(start, endAt === -1 ? Math.min(text.length, start + 500) : Math.min(endAt, start + 500))) || undefined; }

@Injectable()
export class McpClientService {
  constructor(private readonly config: ConfigService) {}

  async searchLegalSources(input: LegalSearchInput): Promise<LegalSearchResult> {
    const started = Date.now(); const enabled = this.config.get('MCP_LEGAL_ENABLED', 'true') === 'true';
    if (!enabled) return { citations: [], summary: '', mocked: false, toolCall: { tool: 'mcp-legal-it.search', status: 'skipped', outputSummary: 'MCP disabled' } };
    try { return await this.executeRealSearch(input, started); }
    catch (error) {
      if (this.config.get('MCP_LEGAL_MOCK_FALLBACK', 'false') !== 'true') throw error;
      const citations: Citation[] = [{ id: 'mock-art-1176', title: 'Codice civile — Art. 1176', source: 'Normattiva (mock MCP)', jurisdiction: 'IT', reference: 'Art. 1176 c.c.', url: 'https://www.normattiva.it/', excerpt: 'Diligenza nell’adempimento; verificare il testo vigente sulla fonte ufficiale.' }];
      return { citations, summary: `Fallback MCP deterministico. Errore reale: ${safeError(error)}`, mocked: true, toolCall: { tool: 'mcp-legal-it.search', status: 'mocked', input: { query: input.query.slice(0, 200), jurisdiction: input.jurisdiction }, outputSummary: `Fallback dopo errore MCP: ${safeError(error)}`, durationMs: Date.now() - started } };
    }
  }

  private async executeRealSearch(input: LegalSearchInput, started: number): Promise<LegalSearchResult> {
    const serverUrl = this.config.get<string>('MCP_LEGAL_SERVER_URL', 'http://localhost:8000/sse');
    const timeout = Number(this.config.get('MCP_LEGAL_TIMEOUT_MS', 30_000));
    const maxResults = Math.min(10, Math.max(1, Number(this.config.get('MCP_LEGAL_MAX_RESULTS', 5))));
    const client = new Client({ name: 'lexhero-api', version: '0.1.0' }, { capabilities: {} });
    const transport = new SSEClientTransport(new URL(serverUrl));
    try {
      await client.connect(transport);
      const { tools } = await client.listTools(undefined, { timeout });
      const calls = planLegalToolCalls(input.query, tools.map((tool) => tool.name), maxResults);
      if (!calls.length) throw new Error('No compatible legal research tool advertised by mcp-legal-it');
      const outputs: string[] = []; const citations: Citation[] = [];
      for (const call of calls) {
        const result = await client.callTool(call, undefined, { timeout }) as CallToolResult;
        const text = extractMcpText(result); if (result.isError) throw new Error(text || `${call.name} returned an MCP tool error`);
        if (text) outputs.push(`## ${call.name}\n${text}`); citations.push(...normalizeMcpCitations(text, call.name));
      }
      const uniqueCitations = citations.filter((citation, index, all) => all.findIndex((item) => (item.url || item.reference || item.title) === (citation.url || citation.reference || citation.title)) === index);
      return { citations: uniqueCitations.slice(0, 15), summary: outputs.join('\n\n').slice(0, 25_000), mocked: false, toolCall: { tool: calls.map((call) => `mcp-legal-it.${call.name}`).join(', '), status: 'success', input: { query: input.query.slice(0, 500), jurisdiction: input.jurisdiction, tools: calls.map((call) => call.name) }, outputSummary: `${calls.length} tool MCP eseguiti; ${uniqueCitations.length} fonti normalizzate`, durationMs: Date.now() - started } };
    } finally { await client.close().catch(() => undefined); }
  }
}

function safeError(error: unknown) { return (error instanceof Error ? error.message : 'errore sconosciuto').replace(/https?:\/\/[^\s]+/g, '[MCP endpoint]').slice(0, 240); }
