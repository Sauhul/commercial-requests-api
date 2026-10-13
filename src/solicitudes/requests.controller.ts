import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { AssignAdvisorDto } from './dto/assign-advisor.dto.js';
import { FindRequestsDto } from './dto/find-requests.dto.js';
import {
  HistoryResponseDto,
  PaginationResponseDto,
  RequestResponseDto,
} from './dto/request-response.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { InMemoryUser } from '../common/constants/users.constants.js';

@ApiTags('Requests')
@ApiExtraModels(RequestResponseDto, HistoryResponseDto, PaginationResponseDto)
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-user',
  description: 'Registered user identifier, for example admin01 or advisor01.',
  required: true,
  example: 'admin01',
})
@Controller('solicitudes')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a request',
    description:
      'Creates a request with the initial status PENDING and records its creation in the history. ' +
      'An advisor is assigned automatically only when the creator has the advisor role.',
  })
  @ApiCreatedResponse({
    description: 'Request created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(RequestResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Request data is invalid' })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: InMemoryUser) {
    return this.requestsService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List requests',
    description:
      'Supports filters and pagination. Admins and supervisors see all matching requests; ' +
      'advisors only see requests assigned to themselves.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED'],
  })
  @ApiQuery({ name: 'asesor', required: false, type: String })
  @ApiQuery({ name: 'cliente', required: false, type: String })
  @ApiQuery({
    name: 'desde',
    required: false,
    type: String,
    description: 'ISO 8601 date',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    type: String,
    description: 'ISO 8601 date',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Requests and pagination metadata retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(RequestResponseDto) },
            },
            pagination: { $ref: getSchemaPath(PaginationResponseDto) },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Filter or pagination parameters are invalid',
  })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  findAll(@Query() query: FindRequestsDto, @CurrentUser() user: InMemoryUser) {
    return this.requestsService.findAll(query, user);
  }

  @Patch(':id/asignacion')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Assign an advisor to a request',
    description:
      'Admins and supervisors can assign an existing user with the advisor role. ' +
      'Resolved requests cannot be reassigned.',
  })
  @ApiOkResponse({
    description: 'Advisor assigned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(RequestResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Request ID or advisor identifier is invalid',
  })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({
    description: 'Only admins and supervisors can assign advisors',
  })
  @ApiConflictResponse({
    description: 'Resolved requests cannot be reassigned',
  })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  assignAdvisor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAdvisorDto,
    @CurrentUser() user: InMemoryUser,
  ) {
    return this.requestsService.assignAdvisor(id, dto.asesorId, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Update request status',
    description:
      'Valid transitions: PENDING → IN_PROGRESS and IN_PROGRESS → RESOLVED. ' +
      'The request must include its expected version. The status and history event are saved atomically.',
  })
  @ApiOkResponse({
    description: 'Request status updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(RequestResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Request ID, status, or expected version is invalid',
  })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({
    description: 'Only admins and supervisors can update status',
  })
  @ApiConflictResponse({
    description: 'Invalid transition or request version is outdated',
  })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: InMemoryUser,
  ) {
    return this.requestsService.updateStatus(id, dto, user);
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Get request history',
    description:
      'Returns audit events. Admins and supervisors can view any request; advisors can view only requests currently assigned to them.',
  })
  @ApiOkResponse({
    description: 'Request history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(HistoryResponseDto) },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Request ID is not a valid integer' })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({
    description: 'The advisor cannot access this request history',
  })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  getHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: InMemoryUser,
  ) {
    return this.requestsService.getHistory(id, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a request by ID',
    description:
      'Returns request details. Advisors can only view requests currently assigned to them.',
  })
  @ApiOkResponse({
    description: 'Request found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(RequestResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Request ID is not a valid integer' })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({
    description: 'The advisor cannot access this request',
  })
  @ApiUnauthorizedResponse({
    description: 'API key or user is missing or invalid',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: InMemoryUser,
  ) {
    return this.requestsService.findOne(id, user);
  }
}
