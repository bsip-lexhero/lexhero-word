import type { Citation, LexheroAction } from '../common/contracts';
export interface LlmGenerationInput { action: LexheroAction; prompt?: string; selectedText?: string; documentText?: string; citations: Citation[]; externalContext?: string }
export interface LlmGenerationResult { answer: string; provider: string; warnings: string[] }
export interface LlmProvider { generate(input: LlmGenerationInput): Promise<LlmGenerationResult> }
