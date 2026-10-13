import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { RequestsModule } from '../solicitudes/requests.module.js';
import { Solicitud } from '../solicitudes/entities/request.entity.js';
import { SolicitudHistorial } from '../solicitudes/entities/request-history.entity.js';
import { RequestsAuditMigration } from '../database/migrations/requests-audit.migration.js';

import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserGuard } from '../common/guards/user.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor.js';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5433),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'solicitudes_api'),
        entities: [Solicitud, SolicitudHistorial],
        migrations: [RequestsAuditMigration],
        migrationsRun: true,
        synchronize: false,
        logging: false,
      }),
    }),

    RequestsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UserGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },

    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
