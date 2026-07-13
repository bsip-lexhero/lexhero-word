import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/auth-user.decorator'; import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard'; import type { AuthUser, LexheroAction } from '../common/contracts'; import { LexheroRequestDto } from './workflow.dto'; import { WorkflowService } from './workflow.service';
@Controller('api') @UseGuards(SupabaseJwtGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowService) {}
  @Post('analyze') analyze(@CurrentUser() u: AuthUser, @Body() d: LexheroRequestDto) { return this.run(u, d, 'analyze'); }
  @Post('rewrite') rewrite(@CurrentUser() u: AuthUser, @Body() d: LexheroRequestDto) { return this.run(u, d, 'rewrite'); }
  @Post('legal-references') references(@CurrentUser() u: AuthUser, @Body() d: LexheroRequestDto) { return this.run(u, d, 'legal_references'); }
  @Post('memo') memo(@CurrentUser() u: AuthUser, @Body() d: LexheroRequestDto) { return this.run(u, d, 'memo'); }
  @Post('custom') custom(@CurrentUser() u: AuthUser, @Body() d: LexheroRequestDto) { return this.run(u, d, 'custom'); }
  private run(user: AuthUser, dto: LexheroRequestDto, action: LexheroAction) { dto.action = action; return this.workflows.execute(user, dto); }
}
