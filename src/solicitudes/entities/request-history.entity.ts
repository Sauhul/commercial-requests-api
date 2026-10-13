import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Solicitud } from './request.entity.js';

@Entity('solicitudes_historial')
@Index('IDX_solicitudes_historial_solicitud_fecha', [
  'solicitudId',
  'fechaEvento',
])
export class SolicitudHistorial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  solicitudId: number;

  @ManyToOne(() => Solicitud, (solicitud) => solicitud.historial, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: Solicitud;

  @Column({ type: 'varchar', length: 20 })
  tipoEvento: string;

  @Column({ type: 'varchar', nullable: true })
  valorAnterior: string | null;

  @Column({ type: 'varchar' })
  valorNuevo: string;

  @Column({ type: 'varchar' })
  usuarioActor: string;

  @CreateDateColumn()
  fechaEvento: Date;
}
