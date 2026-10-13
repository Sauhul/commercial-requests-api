import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SolicitudEstado } from '../entities/request.entity.js';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New request status',
    enum: SolicitudEstado,
    example: SolicitudEstado.IN_PROGRESS,
  })
  @IsNotEmpty({ message: 'The status field is required' })
  @IsEnum(SolicitudEstado, {
    message: `Status must be one of: ${Object.values(SolicitudEstado).join(', ')}`,
  })
  estado: SolicitudEstado;

  @ApiProperty({
    description: 'Current request version that the client expects to update',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionEsperada: number;
}
