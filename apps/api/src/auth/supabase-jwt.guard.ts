import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = String(req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Missing bearer token');
    const url = this.config.get<string>('SUPABASE_URL');
    if (!url) throw new UnauthorizedException('Authentication is not configured');
    try {
      const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
      const algorithm = decodeProtectedHeader(token).alg;
      const usesLegacySecret = algorithm?.startsWith('HS');
      if (usesLegacySecret && !secret) throw new Error('Legacy JWT secret is not configured');
      const verified = usesLegacySecret
        ? await jwtVerify(token, new TextEncoder().encode(secret), { audience: 'authenticated' })
        : await jwtVerify(token, createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`)), { audience: 'authenticated' });
      if (!verified.payload.sub) throw new Error('Missing subject');
      req.user = { id: verified.payload.sub, email: verified.payload.email as string | undefined };
      req.accessToken = token;
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}
