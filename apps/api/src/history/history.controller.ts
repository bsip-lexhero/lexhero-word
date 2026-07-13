import { Controller, Get, UseGuards } from '@nestjs/common'; import { CurrentUser } from '../auth/auth-user.decorator'; import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard'; import type { AuthUser } from '../common/contracts'; import { SupabaseService } from '../supabase/supabase.service';
@Controller('api/history') @UseGuards(SupabaseJwtGuard)
export class HistoryController {
  constructor(private readonly supabase: SupabaseService) {}
  @Get() async history(@CurrentUser() user: AuthUser) {
    if (!this.supabase.configured) return [];
    const { data, error } = await this.supabase.client().from('messages').select('id,session_id,action,content,selected_text,citations,warnings,metadata,created_at').eq('user_id', user.id).eq('role', 'assistant').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data;
  }
}
