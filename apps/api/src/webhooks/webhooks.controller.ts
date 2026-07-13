import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'; import { CurrentUser } from '../auth/auth-user.decorator'; import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard'; import type { AuthUser } from '../common/contracts'; import { LlmService } from '../llm/llm.service'; import { WorkflowService } from '../workflows/workflow.service'; import { ThinkingRequestDto, WebhookRequestDto } from '../workflows/workflow.dto'; import { WebhookJobService } from './webhook-job.service';
@Controller('api/webhooks') @UseGuards(SupabaseJwtGuard) export class WebhooksController {
  constructor(private readonly workflows: WorkflowService, private readonly llm: LlmService, private readonly jobs: WebhookJobService) {}
  @Post('execute') execute(@CurrentUser() user: AuthUser, @Body() dto: WebhookRequestDto) { return this.workflows.execute(user, dto, true); }
  @Post('jobs') startJob(@CurrentUser() user: AuthUser, @Body() dto: WebhookRequestDto) { return this.jobs.start(user, dto); }
  @Get('jobs/:jobId') getJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) { return this.jobs.get(user, jobId); }
  @Post('thinking') thinking(@Body() dto: ThinkingRequestDto) { return this.llm.generateThinkingUpdates(dto.action, dto.request); }
}
