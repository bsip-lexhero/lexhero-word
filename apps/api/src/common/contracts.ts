export type LexheroAction = 'analyze' | 'analyzer' | 'rewrite' | 'legal_references' | 'memo' | 'custom' | 'chat' | 'atto' | 'contratto' | 'parere' | 'clausola' | 'trova_norme' | 'trova_giurisprudenza' | 'trova_news';
export interface Citation { id?: string; title: string; source?: string; url?: string; jurisdiction?: string; reference?: string; excerpt?: string }
export interface ToolCallRecord { tool: string; status: 'success' | 'error' | 'mocked' | 'skipped'; input?: Record<string, unknown>; outputSummary?: string; durationMs?: number }
export interface LexheroResponse { requestId: string; sessionId: string; answer: string; citations: Citation[]; toolCalls: ToolCallRecord[]; warnings: string[]; metadata: { action: string; provider?: string; mcpUsed: boolean; webhookUsed: boolean } }
export interface AuthUser { id: string; email?: string }
export const LEGAL_DISCLAIMER = 'Contenuto generato automaticamente: deve essere verificato da un professionista qualificato e non costituisce consulenza legale.';
