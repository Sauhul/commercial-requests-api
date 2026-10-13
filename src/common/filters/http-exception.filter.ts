import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyObj = body as Record<string, unknown>;
        message = (bodyObj.error as string) ?? exception.message;

        if (Array.isArray(bodyObj.message)) {
          errors = bodyObj.message as string[];
          message = 'Validation error in the sent data';
        } else if (typeof bodyObj.message === 'string') {
          message = bodyObj.message;
        }
      } else {
        message = exception.message;
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An internal server error occurred';
      console.error('Unhandled error:', exception);
    }

    const responseBody: Record<string, unknown> = {
      success: false,
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      responseBody.errors = errors;
    }

    response.status(statusCode).json(responseBody);
  }
}
