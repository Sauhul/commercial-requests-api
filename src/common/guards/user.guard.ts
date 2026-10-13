import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { findUser } from '../constants/users.constants.js';

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const username = request.headers['x-user'] as string | undefined;

    if (!username) {
      throw new UnauthorizedException('Missing x-user header');
    }

    const user = findUser(username);

    if (!user) {
      throw new UnauthorizedException(
        `The user "${username}" does not exist in the system`,
      );
    }

    (request as any).user = user;
    return true;
  }
}
