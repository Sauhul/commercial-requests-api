import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  findUser,
  type InMemoryUser,
} from '../common/constants/users.constants.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { FindRequestsDto } from './dto/find-requests.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { SolicitudHistorial } from './entities/request-history.entity.js';
import { Solicitud, SolicitudEstado } from './entities/request.entity.js';

const VALID_TRANSITIONS: Record<SolicitudEstado, SolicitudEstado[]> = {
  [SolicitudEstado.PENDING]: [SolicitudEstado.IN_PROGRESS],
  [SolicitudEstado.IN_PROGRESS]: [SolicitudEstado.RESOLVED],
  [SolicitudEstado.RESOLVED]: [],
};

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepo: Repository<Solicitud>,
  ) {}

  async create(dto: CreateRequestDto, user: InMemoryUser): Promise<Solicitud> {
    return this.solicitudRepo.manager.transaction(async (manager) => {
      const solicitud = await manager.save(
        Solicitud,
        manager.create(Solicitud, {
          cliente: dto.cliente,
          descripcion: dto.descripcion,
          asesor: user.role === 'advisor' ? user.username : null,
          estado: SolicitudEstado.PENDING,
          version: 1,
        }),
      );

      await this.recordHistory(manager, solicitud, {
        tipoEvento: 'CREACION',
        valorAnterior: null,
        valorNuevo: SolicitudEstado.PENDING,
        usuarioActor: user.username,
      });
      return solicitud;
    });
  }

  async findAll(
    filters: FindRequestsDto,
    user: InMemoryUser,
  ): Promise<{
    items: Solicitud[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    if (
      filters.desde &&
      filters.hasta &&
      new Date(filters.desde).getTime() > new Date(filters.hasta).getTime()
    ) {
      throw new BadRequestException('"desde" cannot be later than "hasta"');
    }

    const query = this.solicitudRepo
      .createQueryBuilder('solicitud')
      .orderBy('solicitud.creadaEn', 'DESC')
      .addOrderBy('solicitud.id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (user.role === 'advisor') {
      query.andWhere('solicitud.asesor = :currentAdvisor', {
        currentAdvisor: user.username,
      });
    }
    if (filters.estado) {
      query.andWhere('solicitud.estado = :estado', { estado: filters.estado });
    }
    if (filters.asesor) {
      query.andWhere('solicitud.asesor = :asesor', { asesor: filters.asesor });
    }
    if (filters.cliente) {
      query.andWhere('LOWER(solicitud.cliente) LIKE LOWER(:cliente)', {
        cliente: `%${filters.cliente.trim()}%`,
      });
    }
    if (filters.desde) {
      query.andWhere('solicitud.creadaEn >= :desde', {
        desde: new Date(filters.desde),
      });
    }
    if (filters.hasta) {
      query.andWhere('solicitud.creadaEn <= :hasta', {
        hasta: new Date(filters.hasta),
      });
    }

    const [items, total] = await query.getManyAndCount();
    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findOne(id: number, user: InMemoryUser): Promise<Solicitud> {
    const solicitud = await this.solicitudRepo.findOne({ where: { id } });

    if (!solicitud) {
      throw new NotFoundException(`Request with ID ${id} was not found`);
    }

    this.ensureAdvisorCanAccess(solicitud, user);
    return solicitud;
  }

  async updateStatus(
    id: number,
    dto: UpdateStatusDto,
    user: InMemoryUser,
  ): Promise<Solicitud> {
    return this.solicitudRepo.manager.transaction(async (manager) => {
      const solicitud = await manager.findOne(Solicitud, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) {
        throw new NotFoundException(`Request with ID ${id} was not found`);
      }

      if (solicitud.version !== dto.versionEsperada) {
        throw new ConflictException(
          'The request was modified by another user. Check the current version.',
        );
      }

      const validTransitions = VALID_TRANSITIONS[solicitud.estado];
      if (!validTransitions.includes(dto.estado)) {
        throw new ConflictException(
          `Cannot change status from "${solicitud.estado}" to "${dto.estado}". ` +
            `Valid transitions from "${solicitud.estado}": ` +
            (validTransitions.length > 0
              ? validTransitions.join(', ')
              : 'none (final status)'),
        );
      }

      const previousStatus = solicitud.estado;
      solicitud.estado = dto.estado;
      solicitud.version += 1;
      const updated = await manager.save(Solicitud, solicitud);

      await this.recordHistory(manager, updated, {
        tipoEvento: 'ESTADO',
        valorAnterior: previousStatus,
        valorNuevo: dto.estado,
        usuarioActor: user.username,
      });
      return updated;
    });
  }

  async assignAdvisor(
    id: number,
    advisorId: string,
    user: InMemoryUser,
  ): Promise<Solicitud> {
    const advisor = findUser(advisorId);
    if (!advisor || advisor.role !== 'advisor') {
      throw new BadRequestException(
        'asesorId must identify a registered user with the advisor role',
      );
    }

    return this.solicitudRepo.manager.transaction(async (manager) => {
      const solicitud = await manager.findOne(Solicitud, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) {
        throw new NotFoundException(`Request with ID ${id} was not found`);
      }
      if (solicitud.estado === SolicitudEstado.RESOLVED) {
        throw new ConflictException('A resolved request cannot be reassigned');
      }

      const previousAdvisor = solicitud.asesor;
      solicitud.asesor = advisor.username;
      const updated = await manager.save(Solicitud, solicitud);

      await this.recordHistory(manager, updated, {
        tipoEvento: previousAdvisor ? 'REASIGNACION' : 'ASIGNACION',
        valorAnterior: previousAdvisor,
        valorNuevo: advisor.username,
        usuarioActor: user.username,
      });
      return updated;
    });
  }

  async getHistory(
    id: number,
    user: InMemoryUser,
  ): Promise<SolicitudHistorial[]> {
    const solicitud = await this.solicitudRepo.findOne({ where: { id } });
    if (!solicitud) {
      throw new NotFoundException(`Request with ID ${id} was not found`);
    }
    this.ensureAdvisorCanAccess(solicitud, user);

    return this.solicitudRepo.manager.getRepository(SolicitudHistorial).find({
      where: { solicitudId: id },
      order: { fechaEvento: 'ASC', id: 'ASC' },
    });
  }

  private ensureAdvisorCanAccess(
    solicitud: Solicitud,
    user: InMemoryUser,
  ): void {
    if (user.role === 'advisor' && solicitud.asesor !== user.username) {
      throw new ForbiddenException(
        'You do not have permission to view this request',
      );
    }
  }

  private async recordHistory(
    manager: EntityManager,
    solicitud: Solicitud,
    event: {
      tipoEvento: string;
      valorAnterior: string | null;
      valorNuevo: string;
      usuarioActor: string;
    },
  ): Promise<void> {
    const historyRepository = manager.getRepository(SolicitudHistorial);
    await historyRepository.save(
      historyRepository.create({
        solicitudId: solicitud.id,
        ...event,
      }),
    );
  }
}
