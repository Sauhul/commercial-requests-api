# API de Solicitudes Comerciales

REST API construida con NestJS para administrar solicitudes de seguimiento comercial con control de acceso basado en roles, validación de API Key y manejo completo de errores.

> Ejecuta los comandos de esta guía desde el directorio `apirest`, donde se
> encuentran `package.json` y `docker-compose.yml`.

## Requisitos

- Node.js 24.15 o superior
- npm
- Docker con Docker Compose

## Instalación

```bash
npm install
```

## Configuración

### 1. Base de Datos PostgreSQL

Inicia PostgreSQL con Docker Compose:

```bash
docker compose up -d postgres
```

Compose publica PostgreSQL en el puerto `5433` del equipo y crea la base de
datos `solicitudes_api`. La aplicación se conecta a `localhost:5433`.

Para iniciar también la API en Docker, ejecuta `docker compose up -d --build`.
En ese caso, Swagger queda disponible en `http://localhost:3000/api`.

### 2. Variables de Entorno

Copia el archivo de entorno de ejemplo:

```bash
cp .env.example .env
```

`.env.example` contiene la configuración de desarrollo local. Asegúrate de que
las credenciales de la base de datos coincidan con el servicio de Compose.

Configuración local de ejemplo:

| Variable      | Ejemplo                   | Descripción                                       |
| ------------- | ------------------------- | ------------------------------------------------- |
| `PORT`        | `3000`                    | Puerto HTTP de la API                             |
| `API_KEYS`    | `dev-key-001,dev-key-002` | Claves API válidas separadas por comas            |
| `DB_HOST`     | `localhost`               | Host de PostgreSQL                                |
| `DB_PORT`     | `5433`                    | Puerto de PostgreSQL publicado por Compose        |
| `DB_USER`     | `postgres`                | Usuario de base de datos                          |
| `DB_PASSWORD` | `postgres`                | Debe coincidir con `POSTGRES_PASSWORD` en Compose |
| `DB_NAME`     | `solicitudes_api`         | Nombre de la base de datos                        |

Las claves y contraseñas de ejemplo son solo para desarrollo local; usa
credenciales seguras fuera de este entorno.

### 3. Esquema y migraciones

TypeORM ejecuta las migraciones pendientes automáticamente al iniciar la API.
La migración `RequestsAuditMigration` crea las tablas e índices requeridos y
actualiza una tabla `solicitudes` existente para permitir solicitudes sin
asesor y agregar el campo de versión. Los cambios de datos e historial se
guardan dentro de transacciones.

Las migraciones se registran en la tabla `migrations`. Antes de desplegar,
respalda la base de datos y revisa las migraciones pendientes en el entorno de
destino. No se usa `synchronize`; el esquema se modifica exclusivamente por
migraciones.

## Ejecución

### Desarrollo

```bash
npm run start:dev
```

### Producción

```bash
npm run build
npm run start:prod
```

La aplicación estará disponible en `http://localhost:3000` (o en el puerto
definido por `PORT`).

## Documentación de API

Swagger UI: `http://localhost:3000/api`
Documento OpenAPI: `http://localhost:3000/api-json`

En Swagger, pulsa **Authorize** e introduce una clave válida para `x-api-key`.
Introduce el usuario de prueba en el header `x-user` de cada operación.

## Usuarios de Prueba

| Usuario      | Rol        | Permisos                                                     |
| ------------ | ---------- | ------------------------------------------------------------ |
| admin01      | admin      | Ver todas las solicitudes, cambiar estado                    |
| supervisor01 | supervisor | Ver todas las solicitudes, cambiar estado y asignar asesores |
| advisor01    | advisor    | Crear solicitudes y ver solo las propias                     |
| advisor02    | advisor    | Crear solicitudes y ver solo las propias                     |

Solo `admin` y `supervisor` pueden cambiar estados y asignar o reasignar
solicitudes.

## Encabezados Requeridos

Todos los endpoints requieren:

| Encabezado  | Descripción        | Ejemplo     |
| ----------- | ------------------ | ----------- |
| `x-api-key` | Clave API válida   | dev-key-001 |
| `x-user`    | Usuario registrado | admin01     |

## Endpoints

| Método | Ruta                        | Descripción                                  |
| ------ | --------------------------- | -------------------------------------------- |
| POST   | /solicitudes                | Registrar solicitud y evento inicial         |
| GET    | /solicitudes                | Filtrar y paginar solicitudes según permisos |
| GET    | /solicitudes/:id            | Obtener solicitud por ID                     |
| PATCH  | /solicitudes/:id/asignacion | Asignar o reasignar un asesor                |
| PATCH  | /solicitudes/:id/estado     | Cambiar estado con control de versión        |
| GET    | /solicitudes/:id/historial  | Consultar eventos de auditoría               |

## Ejemplo con curl

### Listar solicitudes

```bash
curl -X GET http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: admin01"
```

También puedes filtrar y paginar. Los valores predeterminados son `page=1` y
`limit=10`; el límite máximo es 100. Los estados aceptan `PENDING`,
`IN_PROGRESS`, `RESOLVED` y sus nombres en español (`PENDIENTE`, `EN_GESTION`,
`RESUELTA`).

La respuesta de listado incluye `items` y `pagination` (`page`, `limit`,
`total` y `totalPages`), dentro del envoltorio estándar `{ "success": true,
"data": ... }`.

```bash
curl -G http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: advisor01" \
  --data-urlencode "estado=EN_GESTION" \
  --data-urlencode "cliente=norte" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=10"
```

### Crear solicitud

```bash
curl -X POST http://localhost:3000/solicitudes \
  -H "x-api-key: dev-key-001" \
  -H "x-user: advisor01" \
  -H "Content-Type: application/json" \
  -d '{"cliente": "Empresa XYZ", "descripcion": "Solicitud de cotización"}'
```

### Cambiar estado

Reemplaza `1` por un ID existente. Las transiciones deben hacerse en orden:
`PENDING` → `IN_PROGRESS` → `RESOLVED`.

```bash
curl -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01" \
  -H "Content-Type: application/json" \
  -d '{"estado": "IN_PROGRESS", "versionEsperada": 1}'
```

Cada modificación exitosa incrementa la versión. Envía la versión más reciente
en los cambios siguientes; si está desactualizada, la API responde `409
Conflict`. La versión actual se devuelve junto con la solicitud.

### Asignar un asesor

```bash
curl -X PATCH http://localhost:3000/solicitudes/1/asignacion \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01" \
  -H "Content-Type: application/json" \
  -d '{"asesorId": "advisor02"}'
```

### Consultar historial

```bash
curl http://localhost:3000/solicitudes/1/historial \
  -H "x-api-key: dev-key-001" \
  -H "x-user: supervisor01"
```

## Estados de Solicitud

- **PENDING**: Initial status
- **IN_PROGRESS**: Being reviewed
- **RESOLVED**: Completed

### Transiciones Válidas

```
PENDING → IN_PROGRESS → RESOLVED
```

Restricciones:

- No se puede pasar directamente de PENDING a RESOLVED
- No se puede reabrir una solicitud RESOLVED
- Solo supervisores y administradores pueden cambiar el estado

## Reglas de Negocio

### RN-01: Registro de Solicitudes

- Cualquier usuario identificado puede registrar una solicitud
- El estado inicial es siempre PENDING
- Si crea la solicitud un asesor, se asigna a ese usuario; si la crea un admin
  o supervisor, queda sin asignación.

### RN-02: Consulta de Solicitudes

- Admin y supervisor ven todas las solicitudes
- Asesor solo ve sus propias solicitudes
- La restricción se aplica en las consultas de TypeORM

### RN-03: Cambio de Estado

- Solo admin y supervisor pueden cambiar el estado de las solicitudes
- Transiciones deben ser válidas

### RN-04: Protección de API

- Todos los endpoints requieren x-api-key válida
- Múltiples claves configurables por entorno

### RN-05: Validación de Entradas

- Cliente y descripción son obligatorios
- Los campos no deben estar vacíos
- El estado debe ser válido en operaciones de cambio

### RN-06: Respuestas y Errores

- Respuestas exitosas con formato: `{ "success": true, "data": ... }`
- Errores normalizados con código HTTP apropiado

### Reglas de esta etapa

- Solo admins y supervisores pueden asignar/reasignar asesores o cambiar
  estados; un asesor solo consulta las solicitudes que tiene asignadas.
- Cada creación, asignación/reasignación y cambio de estado se guarda como un
  evento de historial persistente.
- El estado y el evento relacionado se escriben dentro de la misma transacción.
- Los cambios de estado requieren `versionEsperada`; una versión desactualizada
  devuelve `409 Conflict`.
- `GET /solicitudes` admite `estado`, `asesor`, `cliente`, `desde`, `hasta`,
  `page` y `limit`, y responde con `items` y metadatos de paginación.

## Estructura principal

```
src/
├── database/
│   └── migrations/
│       └── requests-audit.migration.ts
├── app/
│   ├── app.module.ts
│   └── configure-app.ts       # Validación y configuración de Swagger
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
└── app.e2e-spec.ts            # Pruebas HTTP con PostgreSQL/TypeORM
```

## Scripts

```bash
npm run build       # Compilar
npm run start       # Ejecutar NestJS
npm run start:dev   # Desarrollo con recarga
npm run format      # Formatear
npm run lint        # Ejecutar linter
npm run test:e2e    # Pruebas E2E con PostgreSQL/TypeORM
```

### Ejecutar pruebas E2E

Con PostgreSQL iniciado, `.env` apuntando al puerto publicado `5433` y una base
de datos que pueda modificarse:

```bash
npm run test:e2e
```

Las pruebas levantan la aplicación NestJS, hacen solicitudes HTTP y verifican
la persistencia mediante TypeORM. Crean datos con prefijo `e2e-` y eliminan
únicamente esas solicitudes al finalizar. La aplicación puede ejecutar
migraciones pendientes en esta base; por eso no uses una base de producción.

## Notas

- Sistema de usuarios en memoria (propósitos académicos)
- Sin JWT ni sesiones
- TypeORM con PostgreSQL
- Las migraciones TypeORM se ejecutan automáticamente; `synchronize` está
  desactivado
- Decoradores personalizados para roles y usuario actual
- Guards para validación de API Key, usuario y autorización
- Interceptor para normalizar respuestas
- Exception Filter para normalizar errores
- Documentación completa con Swagger/OpenAPI

## Detener servicios

```bash
# Detén la API con Ctrl+C en su terminal.
docker compose stop postgres
```
