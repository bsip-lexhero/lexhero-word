import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AuthUser, Citation, LexheroResponse, ToolCallRecord } from '../common/contracts';
import { LEGAL_DISCLAIMER } from '../common/contracts';
import { LlmService } from '../llm/llm.service'; import { McpClientService } from '../mcp/mcp-client.service'; import { PersistenceService } from '../messages/persistence.service'; import { WebhookClientService } from '../webhooks/webhook-client.service';
import type { LexheroRequestDto } from './workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly llm: LlmService, private readonly mcp: McpClientService, private readonly webhook: WebhookClientService, private readonly persistence: PersistenceService) {}
  shouldUseMcp(dto: LexheroRequestDto) { return dto.action === 'legal_references' || dto.options?.useMcp === true || /(?:riferiment|normativ|giurisprud|legge italiana|articol)/i.test(dto.prompt ?? ''); }
  async execute(user: AuthUser, dto: LexheroRequestDto, useWebhook = false): Promise<LexheroResponse> {
    if (!dto.prompt?.trim() && !dto.selectedText?.trim() && !dto.documentText?.trim()) throw new BadRequestException('Provide a prompt or document context');
    if (dto.documentText && !dto.options?.includeWholeDocument) throw new BadRequestException('documentText requires includeWholeDocument=true');
    const requestId = crypto.randomUUID(); const started = await this.persistence.start(user, dto); const citations: Citation[] = []; const toolCalls: ToolCallRecord[] = []; const warnings: string[] = []; let mcpContext = '';
    if (useWebhook) {
      const workflowSessionId = typeof dto.metadata?.workflowSessionId === 'string' && dto.metadata.workflowSessionId.trim() ? dto.metadata.workflowSessionId : started.sessionId;
      const result = await this.webhook.execute({ action: dto.action, prompt: dto.prompt, selectedText: dto.selectedText, documentText: dto.documentText, sessionId: workflowSessionId, metadata: dto.metadata });
      toolCalls.push(result.toolCall);
      if (result.warning) warnings.push(result.warning);
      if (!result.answer) throw new ServiceUnavailableException(result.warning || 'Il workflow n8n non ha restituito una risposta valida.');
      if (!warnings.includes(LEGAL_DISCLAIMER)) warnings.push(LEGAL_DISCLAIMER);
      const response: LexheroResponse = { requestId, sessionId: workflowSessionId, answer: result.answer, citations, toolCalls, warnings: [...new Set(warnings)], metadata: { action: dto.action, provider: 'n8n', mcpUsed: false, webhookUsed: true } };
      await this.persistence.finish(user, started.sessionId, dto.action, response.answer, citations, response.warnings, toolCalls, started.persisted);
      return response;
    }
    if (this.shouldUseMcp(dto)) { try { const result = await this.mcp.searchLegalSources({ query: dto.prompt || dto.selectedText || dto.documentText || '', jurisdiction: dto.options?.jurisdiction || 'IT' }); citations.push(...result.citations); mcpContext = result.summary; toolCalls.push(result.toolCall); if (result.mocked) warnings.push('Le citazioni MCP mostrate sono dati demo e devono essere verificate sulla fonte ufficiale.'); } catch (e) { warnings.push(`Ricerca MCP non disponibile: ${e instanceof Error ? e.message : 'errore'}`); toolCalls.push({ tool: 'mcp-legal-it.search', status: 'error' }); } }
    const generated = await this.llm.generate({ ...dto, citations, externalContext: mcpContext || undefined }); warnings.push(...generated.warnings); if (!citations.length && this.shouldUseMcp(dto)) warnings.push('Nessuna fonte legale verificata è stata restituita; non usare la risposta come citazione.'); if (!warnings.includes(LEGAL_DISCLAIMER)) warnings.push(LEGAL_DISCLAIMER);
    const response: LexheroResponse = { requestId, sessionId: started.sessionId, answer: generated.answer, citations, toolCalls, warnings: [...new Set(warnings)], metadata: { action: dto.action, provider: generated.provider, mcpUsed: toolCalls.some((c) => c.tool.includes('mcp') && c.status === 'success'), webhookUsed: toolCalls.some((c) => c.tool.includes('webhook') && c.status === 'success') } };
    await this.persistence.finish(user, started.sessionId, dto.action, response.answer, citations, response.warnings, toolCalls, started.persisted); return response;
  }
}
