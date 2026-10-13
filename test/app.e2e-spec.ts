import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Like, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
import { SolicitudHistorial } from '../src/solicitudes/entities/request-history.entity';
import { Solicitud } from '../src/solicitudes/entities/request.entity';

const API_KEY = process.env.API_KEYS?.split(',')[0]?.trim() || 'dev-key-001';
const testPrefix = `e2e-${Date.now()}-`;

describe('Requests API (e2e)', () => {
  let app: INestApplication;
  let requestsRepository: Repository<Solicitud>;
  let historyRepository: Repository<SolicitudHistorial>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    requestsRepository = app.get<Repository<Solicitud>>(
      getRepositoryToken(Solicitud),
    );
    historyRepository = app.get<Repository<SolicitudHistorial>>(
      getRepositoryToken(SolicitudHistorial),
    );
  });

  afterAll(async () => {
    if (requestsRepository) {
      await requestsRepository.delete({ cliente: Like(`${testPrefix}%`) });
    }
    await app?.close();
  });

  function authenticatedAs(user: string, testRequest: request.Test) {
    return testRequest.set('x-api-key', API_KEY).set('x-user', user);
  }

  async function createRequest(suffix: string): Promise<Solicitud> {
    const response = await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).post('/solicitudes'),
    )
      .send({
        cliente: `${testPrefix}${suffix}`,
        descripcion: 'End-to-end persistence test',
      })
      .expect(201);

    return response.body.data as Solicitud;
  }

  it('serves OpenAPI with one authorization scheme and a required user header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);

    expect(response.body.components.securitySchemes).toEqual({
      'x-api-key': {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'A valid API key configured in API_KEYS.',
      },
    });
    expect(
      response.body.paths['/solicitudes/{id}/estado'].patch.security,
    ).toEqual([{ 'x-api-key': [] }]);
    expect(
      response.body.paths['/solicitudes/{id}/asignacion'].patch,
    ).toBeDefined();
    expect(
      response.body.paths['/solicitudes/{id}/historial'].get,
    ).toBeDefined();
    expect(
      response.body.paths['/solicitudes/solicitudes/{id}/historial'],
    ).toBeUndefined();
    expect(
      response.body.paths['/solicitudes'].get.responses['200'].content[
        'application/json'
      ].schema.properties.data.properties.pagination.$ref,
    ).toContain('PaginationResponseDto');
    expect(
      response.body.paths['/solicitudes/{id}/estado'].patch.parameters,
    ).toContainEqual(
      expect.objectContaining({
        name: 'x-user',
        in: 'header',
        required: true,
      }),
    );
    expect(
      response.body.components.schemas.UpdateStatusDto.properties
        .versionEsperada,
    ).toBeDefined();
  });

  it('rejects missing or invalid API identity headers', async () => {
    await request(app.getHttpServer()).get('/solicitudes').expect(401);
    await request(app.getHttpServer())
      .get('/solicitudes')
      .set('x-api-key', 'invalid-key')
      .set('x-user', 'admin01')
      .expect(401);
    await request(app.getHttpServer())
      .get('/solicitudes')
      .set('x-api-key', API_KEY)
      .set('x-user', 'unknown-user')
      .expect(401);
  });

  it('creates and persists a request with the PENDING status using TypeORM', async () => {
    const created = await createRequest('create');
    const persisted = await requestsRepository.findOneByOrFail({
      id: created.id,
    });

    expect(created.estado).toBe('PENDING');
    expect(persisted.estado).toBe('PENDING');
    expect(persisted.asesor).toBe('advisor01');
    expect(persisted.version).toBe(1);
    await expect(
      historyRepository.findBy({ solicitudId: created.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        tipoEvento: 'CREACION',
        valorNuevo: 'PENDING',
        usuarioActor: 'advisor01',
      }),
    ]);
  });

  it('allows only valid status transitions and persists each update', async () => {
    const created = await createRequest('transitions');

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'RESOLVED', versionEsperada: 1 })
      .expect(409);

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'IN_PROGRESS', versionEsperada: 1 })
      .expect(200);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'RESOLVED', versionEsperada: 2 })
      .expect(200);

    const persisted = await requestsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(persisted.estado).toBe('RESOLVED');
    expect(persisted.version).toBe(3);
    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(
        `/solicitudes/${created.id}/asignacion`,
      ),
    )
      .send({ asesorId: 'advisor02' })
      .expect(409);
    await expect(
      historyRepository.findBy({ solicitudId: created.id }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEvento: 'ESTADO',
          valorAnterior: 'PENDING',
          valorNuevo: 'IN_PROGRESS',
          usuarioActor: 'supervisor01',
        }),
        expect.objectContaining({
          tipoEvento: 'ESTADO',
          valorAnterior: 'IN_PROGRESS',
          valorNuevo: 'RESOLVED',
          usuarioActor: 'admin01',
        }),
      ]),
    );
  });

  it('rejects advisors and requests with a stale version', async () => {
    const created = await createRequest('authorization');

    await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'IN_PROGRESS' })
      .expect(403);

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'IN_PROGRESS', versionEsperada: 1 })
      .expect(200);

    const staleResponse = await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'RESOLVED', versionEsperada: 1 })
      .expect(409);
    expect(staleResponse.body.message).toContain('modified by another user');
  });

  it('rolls back the status and version when writing history fails', async () => {
    const created = await createRequest('history-rollback');
    await requestsRepository.query(`
      CREATE OR REPLACE FUNCTION reject_history_write()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced history write failure';
      END;
      $$
    `);
    await requestsRepository.query(`
      CREATE TRIGGER reject_history_write
      BEFORE INSERT ON "solicitudes_historial"
      FOR EACH ROW EXECUTE FUNCTION reject_history_write()
    `);

    try {
      await authenticatedAs(
        'supervisor01',
        request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
      )
        .send({ estado: 'IN_PROGRESS', versionEsperada: 1 })
        .expect(500);
    } finally {
      await requestsRepository.query(
        'DROP TRIGGER IF EXISTS reject_history_write ON "solicitudes_historial"',
      );
      await requestsRepository.query(
        'DROP FUNCTION IF EXISTS reject_history_write()',
      );
    }

    const persisted = await requestsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(persisted.estado).toBe('PENDING');
    expect(persisted.version).toBe(1);
    await expect(
      historyRepository.findBy({
        solicitudId: created.id,
        tipoEvento: 'ESTADO',
      }),
    ).resolves.toEqual([]);
  });

  it('allows only one concurrent status update for the same version', async () => {
    const created = await createRequest('concurrent-status');
    const updateStatus = () =>
      authenticatedAs(
        'supervisor01',
        request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
      ).send({ estado: 'IN_PROGRESS', versionEsperada: 1 });

    const responses = await Promise.all([updateStatus(), updateStatus()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const persisted = await requestsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(persisted.estado).toBe('IN_PROGRESS');
    expect(persisted.version).toBe(2);
    const history = await historyRepository.findBy({
      solicitudId: created.id,
      tipoEvento: 'ESTADO',
    });
    expect(history).toHaveLength(1);
  });

  it('allows supervisors to create unassigned requests', async () => {
    const response = await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).post('/solicitudes'),
    )
      .send({
        cliente: `  ${testPrefix}  supervisor `,
        descripcion: '  Coordinar   seguimiento ',
      })
      .expect(201);

    const created = response.body.data as Solicitud;
    expect(created.asesor).toBeNull();
    expect(created.cliente).toBe(`${testPrefix} supervisor`);
    expect(created.descripcion).toBe('Coordinar seguimiento');
    await expect(
      historyRepository.findBy({ solicitudId: created.id }),
    ).resolves.toEqual([
      expect.objectContaining({
        tipoEvento: 'CREACION',
        valorNuevo: 'PENDING',
        usuarioActor: 'supervisor01',
      }),
    ]);
  });

  it('rejects request text containing only whitespace', async () => {
    await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).post('/solicitudes'),
    )
      .send({ cliente: '   ', descripcion: 'Visita' })
      .expect(400);
  });

  it('assigns only registered advisors and records assignment history', async () => {
    const response = await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).post('/solicitudes'),
    )
      .send({
        cliente: `${testPrefix}assignment`,
        descripcion: 'Supervisor-created unassigned request',
      })
      .expect(201);
    const created = response.body.data as Solicitud;

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(
        `/solicitudes/${created.id}/asignacion`,
      ),
    )
      .send({ asesorId: 'admin01' })
      .expect(400);

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(
        `/solicitudes/${created.id}/asignacion`,
      ),
    )
      .send({ asesorId: 'missing-advisor' })
      .expect(400);

    const unchanged = await requestsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(unchanged.asesor).toBeNull();
    expect(unchanged.estado).toBe('PENDING');

    await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).patch(
        `/solicitudes/${created.id}/asignacion`,
      ),
    )
      .send({ asesorId: 'advisor02' })
      .expect(403);

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(
        `/solicitudes/${created.id}/asignacion`,
      ),
    )
      .send({ asesorId: 'advisor02' })
      .expect(200);

    const persisted = await requestsRepository.findOneByOrFail({
      id: created.id,
    });
    expect(persisted.asesor).toBe('advisor02');
    expect(persisted.estado).toBe('PENDING');
    await expect(
      historyRepository.findBy({ solicitudId: created.id }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEvento: 'ASIGNACION',
          valorAnterior: null,
          valorNuevo: 'advisor02',
          usuarioActor: 'supervisor01',
        }),
      ]),
    );

    await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).get(`/solicitudes/${created.id}/historial`),
    ).expect(403);

    const historyResponse = await authenticatedAs(
      'advisor02',
      request(app.getHttpServer()).get(`/solicitudes/${created.id}/historial`),
    ).expect(200);
    expect(historyResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEvento: 'ASIGNACION',
          valorAnterior: null,
          valorNuevo: 'advisor02',
          usuarioActor: 'supervisor01',
        }),
      ]),
    );
  });

  it('filters and paginates requests without allowing advisors to broaden access', async () => {
    const first = await createRequest('Filter-CaseSensitive-1');
    const second = await createRequest('Filter-CaseSensitive-2');

    const response = await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).get(
        `/solicitudes?cliente=FILTER-casesensitive&page=1&limit=1&asesor=advisor02`,
      ),
    ).expect(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 1, total: 0, totalPages: 0 }),
    );

    const ownResponse = await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).get(
        `/solicitudes?cliente=FILTER-casesensitive&page=1&limit=1&asesor=advisor01`,
      ),
    ).expect(200);
    expect(ownResponse.body.data.items).toEqual([
      expect.objectContaining({ id: second.id }),
    ]);
    expect(ownResponse.body.data.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 1, total: 2, totalPages: 2 }),
    );

    const secondPage = await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).get(
        `/solicitudes?cliente=FILTER-casesensitive&page=2&limit=1&asesor=advisor01`,
      ),
    ).expect(200);
    expect(secondPage.body.data.items).toEqual([
      expect.objectContaining({ id: first.id }),
    ]);
  });

  it('rejects invalid pagination and reversed date ranges', async () => {
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get('/solicitudes?page=0'),
    ).expect(400);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get('/solicitudes?limit=101'),
    ).expect(400);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get('/solicitudes?limit=-1'),
    ).expect(400);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get('/solicitudes?limit=1000'),
    ).expect(400);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get('/solicitudes?page=not-a-number'),
    ).expect(400);
    await authenticatedAs(
      'admin01',
      request(app.getHttpServer()).get(
        '/solicitudes?desde=2026-10-20T00:00:00Z&hasta=2026-10-01T00:00:00Z',
      ),
    ).expect(400);
  });

  it('rejects invalid status payloads and unknown request properties', async () => {
    const created = await createRequest('invalid-dto');

    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({ estado: 'IN_PROGRESS' })
      .expect(400);
    await authenticatedAs(
      'supervisor01',
      request(app.getHttpServer()).patch(`/solicitudes/${created.id}/estado`),
    )
      .send({
        estado: 'IN_PROGRESS',
        versionEsperada: 1,
        unexpected: true,
      })
      .expect(400);
    await authenticatedAs(
      'advisor01',
      request(app.getHttpServer()).post('/solicitudes'),
    )
      .send({
        cliente: 'Valid client',
        descripcion: 'Valid description',
        estado: 'RESOLVED',
      })
      .expect(400);
  });

  it('documents the route error responses in OpenAPI', async () => {
    const response = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);
    const paths = response.body.paths;

    for (const errorCode of ['400', '401']) {
      expect(paths['/solicitudes'].post.responses[errorCode]).toBeDefined();
      expect(paths['/solicitudes'].get.responses[errorCode]).toBeDefined();
    }
    for (const path of [
      '/solicitudes/{id}',
      '/solicitudes/{id}/asignacion',
      '/solicitudes/{id}/estado',
      '/solicitudes/{id}/historial',
    ]) {
      const operation = paths[path].get ?? paths[path].patch;
      for (const errorCode of ['400', '401', '403', '404']) {
        expect(operation.responses[errorCode]).toBeDefined();
      }
    }
    expect(
      paths['/solicitudes/{id}/asignacion'].patch.responses['409'],
    ).toBeDefined();
    expect(
      paths['/solicitudes/{id}/estado'].patch.responses['409'],
    ).toBeDefined();
  });
});
