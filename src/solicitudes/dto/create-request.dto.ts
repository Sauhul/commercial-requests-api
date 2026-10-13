import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({
    description: 'Client name',
    example: 'Northern Commercial Supply Ltd.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsNotEmpty({ message: 'Client name is required' })
  @IsString({ message: 'Client name must be text' })
  cliente: string;

  @ApiProperty({
    description: 'Description of the request',
    example: 'Request a quote for specialty products',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsNotEmpty({ message: 'Description is required' })
  @IsString({ message: 'Description must be text' })
  descripcion: string;
}
