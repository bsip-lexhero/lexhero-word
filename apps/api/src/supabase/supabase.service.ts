import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly admin?: SupabaseClient;
  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL'); const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) this.admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  client(): SupabaseClient { if (!this.admin) throw new ServiceUnavailableException('Supabase persistence is not configured'); return this.admin; }
  get configured() { return Boolean(this.admin); }
}
