import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../common/contracts';
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
