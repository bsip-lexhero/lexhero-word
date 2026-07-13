import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser, Citation, ToolCallRecord } from '../common/contracts';
import { SupabaseService } from '../supabase/supabase.service';
import type { LexheroRequestDto } from '../workflows/workflow.dto';

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);
  constructor(private readonly supabase: SupabaseService) {}
  async start(user: AuthUser, dto: LexheroRequestDto) {
    if (!this.supabase.configured) return { sessionId: crypto.randomUUID(), userMessageId: crypto.randomUUID(), persisted: false };
    const db = this.supabase.client();
    await db.from('profiles').upsert({ id: user.id, email: user.email }, { onConflict: 'id' });
    let documentId: string | null = null;
    if (dto.document) {
      const { data, error } = await db.from('documents').insert({ user_id: user.id, external_document_id: dto.document.externalDocumentId, title: dto.document.title, source: 'word', metadata: { url: dto.document.url } }).select('id').single();
      if (error) throw error; documentId = data.id;
    }
    const { data: session, error: sessionError } = await db.from('chat_sessions').insert({ user_id: user.id, document_id: documentId, title: (dto.prompt || dto.selectedText || dto.action).slice(0, 120) }).select('id').single();
    if (sessionError) throw sessionError;
    const { data: message, error: messageError } = await db.from('messages').insert({ session_id: session.id, user_id: user.id, role: 'user', action: dto.action, content: dto.prompt || '', selected_text: dto.selectedText, document_context: dto.documentText, metadata: { options: dto.options } }).select('id').single();
    if (messageError) throw messageError; return { sessionId: session.id as string, userMessageId: message.id as string, persisted: true };
  }
  async finish(user: AuthUser, sessionId: string, action: string, answer: string, citations: Citation[], warnings: string[], toolCalls: ToolCallRecord[], persisted: boolean) {
    if (!persisted) return;
    try {
      const db = this.supabase.client(); const { data: message, error } = await db.from('messages').insert({ session_id: sessionId, user_id: user.id, role: 'assistant', action, content: answer, citations, warnings, metadata: { toolCalls } }).select('id').single(); if (error) throw error;
      for (const call of toolCalls.filter((c) => c.tool.includes('mcp'))) await db.from('mcp_tool_calls').insert({ session_id: sessionId, message_id: message.id, user_id: user.id, tool_name: call.tool, request_payload: call.input, response_payload: { summary: call.outputSummary }, status: call.status, duration_ms: call.durationMs });
      for (const call of toolCalls.filter((c) => c.tool.includes('webhook'))) await db.from('webhook_tool_calls').insert({ session_id: sessionId, message_id: message.id, user_id: user.id, tool_name: call.tool, status: call.status, response_summary: call.outputSummary, duration_ms: call.durationMs });
    } catch (e) { this.logger.error(`Persistence completion failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }
}
