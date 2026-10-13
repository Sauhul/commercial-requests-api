import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardizedResponse<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, StandardizedResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardizedResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data,
      })),
    );
  }
}
