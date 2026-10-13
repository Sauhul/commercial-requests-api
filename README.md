# Commercial Requests API

A REST API built with NestJS for managing commercial follow-up requests. It
includes role-based access control, API key authentication, input validation,
and consistent error handling.

> Run the commands in this guide from the `apirest` directory, where
> `package.json` and `docker-compose.yml` are located.

## Requirements

- Node.js 24.15 or later
- npm
- Docker with Docker Compose

## Installation

```bash
npm install
```

## Configuration

### 1. PostgreSQL database

Start PostgreSQL with Docker Compose:

```bash
docker compose up -d postgres
```

Compose publishes PostgreSQL on host port `5433` and creates the
`solicitudes_api` database. The application connects to `localhost:5433`.

To start the API in Docker as well, run `docker compose up -d --build`.
Swagger will then be available at `http://localhost:3000/api`.

### 2. Environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

`.env.example` contains the local development configuration. Make sure the
database credentials match the Compose service.

Example local configuration:

| Variable      | Example                   | Description                                         |
| ------------- | ------------------------- | --------------------------------------------------- |
| `PORT`        | `3000`                    | API HTTP port                                       |
| `API_KEYS`    | `dev-key-001,dev-key-002` | Comma-separated valid API keys                     |
| `DB_HOST`     | `localhost`               | PostgreSQL host                                     |
| `DB_PORT`     | `5433`                    | PostgreSQL port published by Compose               |
| `DB_USER`     | `postgres`                | Database user                                       |
| `DB_PASSWORD` | `postgres`                | Must match `POSTGRES_PASSWORD` in Compose           |
| `DB_NAME`     | `solicitudes_api`         | Database name                                       |

The example keys and passwords are for local development only. Use secure
credentials outside this environment.

### 3. Schema and migrations

TypeORM automatically runs pending migrations when the API starts. The
`RequestsAuditMigration` migration creates the required tables and indexes,
and updates an existing `solicitudes` table to allow unassigned requests and
add a version field. Request changes and history events are saved in
transactions.

Migrations are recorded in the `migrations` table. Before deploying, back up
the database and review pending migrations in the target environment.
`synchronize` is disabled; the schema is changed exclusively through
migrations.

## Running the application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

The application will be available at `http://localhost:3000` (or on the port
defined by `PORT`).

## API documentation

Swagger UI: `http://localhost:3000/api`

OpenAPI document: `http://localhost:3000/api-json`

In Swagger, click **Authorize** and enter a valid `x-api-key`. Provide a test
user in the `x-user` header for each operation.

## Test users

| User           | Role       | Permissions                                           |
| -------------- | ---------- | ----------------------------------------------------- |
| `admin01`      | admin      | View all requests and change their status             |
| `supervisor01` | supervisor | View all requests, change status, and assign advisors |
| `advisor01`    | advisor    | Create requests and view only assigned requests       |
| `advisor02`    | advisor    | Create requests and view only assigned requests       |

Only `admin` and `supervisor` users can change request status or assign and
reassign requests.

## Required headers

All endpoints require:

| Header      | Description          | Example       |
| ----------- | -------------------- | ------------- |
| `x-api-key` | Valid API key        | `dev-key-001` |
| `x-user`    | Registered user ID   | `admin01`     |

## Endpoints

| Method | Route                       | Description                                      |
| ------ | --------------------------- | ------------------------------------------------ |
| POST   | `/solicitudes`              | Create a request and its initial history event  |
| GET    | `/solicitudes`              | Filter and paginate requests according to access |
| GET    | `/solicitudes/:id`          | Get a request by ID                              |
| PATCH  | `/solicitudes/:id/asignacion` | Assign or reassign an advisor                   |
| PATCH  | `/solicitudes/:id/estado`    | Change status with version control               |
| GET    | `/solicitudes/:id/historial` | Get audit events                                 |

## Examples with curl

### List requests

```bash
curl -X GET http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: admin01"
```

You can also filter and paginate results. Defaults are `page=1` and
`limit=10`; the maximum limit is 100. Status values can be `PENDING`,
`IN_PROGRESS`, `RESOLVED`, or their Spanish names (`PENDIENTE`, `EN_GESTION`,
`RESUELTA`).

The list response includes `items` and `pagination` (`page`, `limit`, `total`,
and `totalPages`) inside the standard `{ "success": true, "data": ... }`
envelope.

```bash
curl -G http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: advisor01" \
  --data-urlencode "estado=EN_GESTION" \
  --data-urlencode "cliente=norte" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=10"
```

### Create a request

```bash
curl -X POST http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: advisor01" \
  -H "Content-Type: application/json" \
  -d '{"cliente": "XYZ Company", "descripcion": "Quotation request"}'
```

### Change request status

Replace `1` with an existing ID. Status transitions must be performed in
order: `PENDING` → `IN_PROGRESS` → `RESOLVED`.

```bash
curl -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01" \
  -H "Content-Type: application/json" \
  -d '{"estado": "IN_PROGRESS", "versionEsperada": 1}'
```

Each successful update increments the version. Send the latest version with
subsequent changes; if it is stale, the API returns `409 Conflict`. The
current version is included in the request response.

### Assign an advisor

```bash
curl -X PATCH http://localhost:3000/solicitudes/1/asignacion \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01" \
  -H "Content-Type: application/json" \
  -d '{"asesorId": "advisor02"}'
```

### Get request history

```bash
curl http://localhost:3000/solicitudes/1/historial \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01"
```

## Request statuses

- **PENDING**: Initial status
- **IN_PROGRESS**: Under review
- **RESOLVED**: Completed

### Valid transitions

```text
PENDING → IN_PROGRESS → RESOLVED
```

Restrictions:

- A request cannot move directly from `PENDING` to `RESOLVED`.
- A `RESOLVED` request cannot be reopened.
- Only supervisors and administrators can change request status.

## Business rules

### RN-01: Request creation

- Any authenticated user can create a request.
- The initial status is always `PENDING`.
- Requests created by an advisor are assigned to that advisor. Requests
  created by an admin or supervisor remain unassigned.

### RN-02: Request access

- Admins and supervisors can view all requests.
- Advisors can only view requests assigned to them.
- This restriction is applied in TypeORM queries.

### RN-03: Status changes

- Only admins and supervisors can change request status.
- Status transitions must be valid.

### RN-04: API protection

- All endpoints require a valid `x-api-key`.
- Multiple API keys can be configured through environment variables.

### RN-05: Input validation

- Client and description are required.
- Fields cannot be empty.
- Status values must be valid when updating a request.

### RN-06: Responses and errors

- Successful responses use the format `{ "success": true, "data": ... }`.
- Errors are normalized and use the appropriate HTTP status code.

### Rules added in this stage

- Only admins and supervisors can assign or reassign advisors or change
  statuses. Advisors can only view requests currently assigned to them.
- Every creation, assignment/reassignment, and status change is recorded as a
  persistent history event.
- A status change and its related history event are saved in the same
  transaction.
- Status changes require `versionEsperada`; a stale version returns
  `409 Conflict`.
- `GET /solicitudes` supports `estado`, `asesor`, `cliente`, `desde`, `hasta`,
  `page`, and `limit`, and returns `items` with pagination metadata.

## Project structure

```text
src/
├── database/
│   └── migrations/
│       └── requests-audit.migration.ts
├── app/
│   ├── app.module.ts
│   └── configure-app.ts       # Validation and Swagger configuration
├── common/
│   ├── constants/
│   │   └── users.constants.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── api-key.guard.ts
│   │   ├── user.guard.ts
│   │   └── roles.guard.ts
│   └── interceptors/
│       └── response.interceptor.ts
├── solicitudes/
│   ├── dto/
│   │   ├── assign-advisor.dto.ts
│   │   ├── create-request.dto.ts
│   │   ├── find-requests.dto.ts
│   │   ├── request-response.dto.ts
│   │   └── update-status.dto.ts
│   ├── entities/
│   │   ├── request-history.entity.ts
│   │   └── request.entity.ts
│   ├── requests.controller.ts
│   ├── requests.module.ts
│   └── requests.service.ts
└── main.ts
test/
└── app.e2e-spec.ts            # HTTP tests with PostgreSQL/TypeORM
```

## Scripts

```bash
npm run build       # Build
npm run start       # Run NestJS
npm run start:dev   # Development with hot reload
npm run format      # Format source files
npm run lint        # Run the linter
npm run test:e2e    # E2E tests with PostgreSQL/TypeORM
```

### Run E2E tests

With PostgreSQL running, `.env` pointing to the published `5433` port, and a
database that can be modified:

```bash
npm run test:e2e
```

The tests start the NestJS application, send HTTP requests, and verify
persistence through TypeORM. They create data with the `e2e-` prefix and
delete only those requests when finished. The application may run pending
migrations against this database, so do not use a production database.

## Notes

- The user system is in memory (for academic/demo purposes).
- No JWT or sessions are implemented.
- TypeORM uses PostgreSQL.
- TypeORM migrations run automatically; `synchronize` is disabled.
- Custom decorators provide access to roles and the current user.
- Guards validate API keys, users, and authorization.
- An interceptor normalizes successful responses.
- An exception filter normalizes errors.
- API documentation is available through Swagger/OpenAPI.

## Stopping services

```bash
# Stop the API with Ctrl+C in its terminal.
docker compose stop postgres
```
