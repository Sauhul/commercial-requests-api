import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { SolicitudHistorial } from './request-history.entity.js';

export enum SolicitudEstado {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

@Entity('solicitudes')
@Index('IDX_solicitudes_estado', ['estado'])
@Index('IDX_solicitudes_asesor', ['asesor'])
@Index('IDX_solicitudes_creadaEn', ['creadaEn'])
export class Solicitud {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente: string;

  @Column()
  descripcion: string;

  @Column({ type: 'varchar', nullable: true })
  asesor: string | null;

  @Column({
    type: 'text',
    enum: SolicitudEstado,
    default: SolicitudEstado.PENDING,
  })
  estado: SolicitudEstado;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn()
  creadaEn: Date;

  @UpdateDateColumn()
  actualizadaEn: Date;

  @OneToMany(() => SolicitudHistorial, (historial) => historial.solicitud)
  historial: SolicitudHistorial[];
}
