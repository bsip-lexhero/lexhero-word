export type LexheroAction = 'chat'|'analyzer'|'atto'|'contratto'|'parere'|'clausola'|'trova_norme'|'trova_giurisprudenza'|'trova_news';
export interface Citation { id?:string; title:string; source?:string; url?:string; jurisdiction?:string; reference?:string; excerpt?:string }
export interface ToolCallRecord { tool:string; status:'success'|'error'|'mocked'|'skipped'; input?:Record<string,unknown>; outputSummary?:string; durationMs?:number }
export interface LexheroRequest { action:LexheroAction; prompt?:string; selectedText?:string; documentText?:string; document?:{externalDocumentId?:string;title?:string;url?:string}; options?:{language?:'it'|'en';jurisdiction?:string;includeWholeDocument?:boolean}; metadata?:{workflowSessionId?:string} }
export interface LexheroResponse { requestId:string;sessionId:string;answer:string;citations:Citation[];toolCalls:ToolCallRecord[];warnings:string[];metadata:{action:string;provider?:string;mcpUsed:boolean;webhookUsed:boolean} }
export interface ThinkingResponse { updates:string[] }
export interface HistoryItem { id:string;session_id:string;action:LexheroAction;content:string;selected_text?:string;citations:Citation[];warnings:string[];metadata?:{toolCalls?:ToolCallRecord[]};created_at:string }
