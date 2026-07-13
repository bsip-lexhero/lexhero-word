import { Body, Controller, Post, UseGuards } from '@nestjs/common'; import { CurrentUser } from '../auth/auth-user.decorator'; import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard'; import type { AuthUser } from '../common/contracts'; import { LlmService } from '../llm/llm.service'; import { WorkflowService } from '../workflows/workflow.service'; import { ThinkingRequestDto, WebhookRequestDto } from '../workflows/workflow.dto';
@Controller('api/webhooks') @UseGuards(SupabaseJwtGuard) export class WebhooksController {
  constructor(private readonly workflows: WorkflowService, private readonly llm: LlmService) {}
  @Post('execute') execute(@CurrentUser() user: AuthUser, @Body() dto: WebhookRequestDto) { return this.workflows.execute(user, dto, true); }
  @Post('thinking') thinking(@Body() dto: ThinkingRequestDto) { return this.llm.generateThinkingUpdates(dto.action, dto.request); }
}
