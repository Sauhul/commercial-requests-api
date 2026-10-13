import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignAdvisorDto {
  @ApiProperty({
    description: 'Identifier of a registered user with the advisor role',
    example: 'advisor02',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  asesorId: string;
}
