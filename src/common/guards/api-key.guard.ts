import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const receivedKey = request.headers['x-api-key'] as string | undefined;

    if (!receivedKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const validKeys = this.configService
      .get<string>('API_KEYS', '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (!validKeys.includes(receivedKey)) {
      throw new UnauthorizedException('The provided API Key is invalid');
    }

    return true;
  }
}
