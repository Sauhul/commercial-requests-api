import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { Solicitud } from './entities/request.entity.js';
import { SolicitudHistorial } from './entities/request-history.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Solicitud, SolicitudHistorial])],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
