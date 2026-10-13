import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RequestsAuditMigration implements MigrationInterface {
  name = 'RequestsAuditMigration20261013000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solicitudes" (
        "id" SERIAL PRIMARY KEY,
        "cliente" character varying NOT NULL,
        "descripcion" character varying NOT NULL,
        "asesor" character varying,
        "estado" text NOT NULL DEFAULT 'PENDING',
        "version" integer NOT NULL DEFAULT 1,
        "creadaEn" TIMESTAMP NOT NULL DEFAULT now(),
        "actualizadaEn" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      'ALTER TABLE "solicitudes" ALTER COLUMN "asesor" DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "solicitudes" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "solicitudes_historial" (
        "id" SERIAL PRIMARY KEY,
        "solicitudId" integer NOT NULL,
        "tipoEvento" character varying(20) NOT NULL,
        "valorAnterior" character varying,
        "valorNuevo" character varying NOT NULL,
        "usuarioActor" character varying NOT NULL,
        "fechaEvento" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_solicitudes_historial_solicitud"
          FOREIGN KEY ("solicitudId")
          REFERENCES "solicitudes"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_solicitudes_estado" ON "solicitudes" ("estado")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_solicitudes_asesor" ON "solicitudes" ("asesor")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_solicitudes_creadaEn" ON "solicitudes" ("creadaEn")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_solicitudes_historial_solicitud_fecha" ON "solicitudes_historial" ("solicitudId", "fechaEvento")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_solicitudes_historial_solicitud_fecha"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_solicitudes_creadaEn"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_solicitudes_asesor"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_solicitudes_estado"');
    await queryRunner.query('DROP TABLE IF EXISTS "solicitudes_historial"');
    await queryRunner.query(
      'ALTER TABLE "solicitudes" DROP COLUMN IF EXISTS "version"',
    );
  }
}
