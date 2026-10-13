import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SolicitudEstado } from '../entities/request.entity.js';

export class FindRequestsDto {
  @ApiPropertyOptional({
    enum: SolicitudEstado,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(SolicitudEstado)
  estado?: SolicitudEstado;

  @ApiPropertyOptional({ description: 'Filter by assigned advisor identifier' })
  @IsOptional()
  @IsString()
  asesor?: string;

  @ApiPropertyOptional({ description: 'Partial, case-insensitive client name' })
  @IsOptional()
  @IsString()
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start date in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Inclusive end date in ISO 8601 format' })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
