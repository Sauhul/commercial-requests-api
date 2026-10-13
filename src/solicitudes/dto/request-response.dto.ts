import { ApiProperty } from '@nestjs/swagger';
import { SolicitudEstado } from '../entities/request.entity.js';

export class RequestResponseDto {
  @ApiProperty({ example: 15 })
  id: number;

  @ApiProperty({ example: 'Northern Hardware Store' })
  cliente: string;

  @ApiProperty({ example: 'Coordinar visita de seguimiento' })
  descripcion: string;

  @ApiProperty({ nullable: true, example: 'advisor02' })
  asesor: string | null;

  @ApiProperty({ enum: SolicitudEstado, example: SolicitudEstado.PENDING })
  estado: SolicitudEstado;

  @ApiProperty({ example: 1, minimum: 1 })
  version: number;

  @ApiProperty({ type: String, format: 'date-time' })
  creadaEn: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadaEn: Date;
}

export class HistoryResponseDto {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 15 })
  solicitudId: number;

  @ApiProperty({ enum: ['CREACION', 'ESTADO', 'ASIGNACION', 'REASIGNACION'] })
  tipoEvento: string;

  @ApiProperty({ nullable: true, example: 'advisor01' })
  valorAnterior: string | null;

  @ApiProperty({ example: 'advisor02' })
  valorNuevo: string;

  @ApiProperty({ example: 'supervisor01' })
  usuarioActor: string;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaEvento: Date;
}

export class PaginationResponseDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 24 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
