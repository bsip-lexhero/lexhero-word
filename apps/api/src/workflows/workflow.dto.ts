import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { LexheroAction } from '../common/contracts';

export class DocumentDto {
  @IsOptional() @IsString() @MaxLength(255) externalDocumentId?: string;
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsString() @MaxLength(2048) url?: string;
}
export class OptionsDto {
  @IsOptional() @IsIn(['it', 'en']) language?: 'it' | 'en';
  @IsOptional() @IsString() @MaxLength(20) jurisdiction?: string;
  @IsOptional() @IsBoolean() replaceSelection?: boolean;
  @IsOptional() @IsBoolean() includeWholeDocument?: boolean;
  @IsOptional() @IsBoolean() useMcp?: boolean;
}
export class LexheroRequestDto {
  @IsIn(['analyze', 'analyzer', 'rewrite', 'legal_references', 'memo', 'custom', 'chat', 'atto', 'contratto', 'parere', 'clausola', 'trova_norme', 'trova_giurisprudenza', 'trova_news']) action!: LexheroAction;
  @IsOptional() @IsString() @MaxLength(10_000) prompt?: string;
  @IsOptional() @IsString() @MaxLength(100_000) selectedText?: string;
  @IsOptional() @IsString() @MaxLength(500_000) documentText?: string;
  @IsOptional() @ValidateNested() @Type(() => DocumentDto) document?: DocumentDto;
  @IsOptional() @ValidateNested() @Type(() => OptionsDto) options?: OptionsDto;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
export class WebhookRequestDto extends LexheroRequestDto {}
export class ThinkingRequestDto {
  @IsIn(['analyze', 'analyzer', 'rewrite', 'legal_references', 'memo', 'custom', 'chat', 'atto', 'contratto', 'parere', 'clausola', 'trova_norme', 'trova_giurisprudenza', 'trova_news']) action!: LexheroAction;
  @IsString() @MaxLength(10_000) request!: string;
}
