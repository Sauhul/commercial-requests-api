import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { InMemoryUser } from '../constants/users.constants.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): InMemoryUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as InMemoryUser;
  },
);
