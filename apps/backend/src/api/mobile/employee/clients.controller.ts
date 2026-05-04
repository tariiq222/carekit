import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiOkResponse,
  ApiNotFoundResponse, ApiExtraModels, getSchemaPath,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientResponseDto } from '../../dashboard/dto/people-response.dto';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';

export class EmployeeClientListQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  @ApiPropertyOptional({ description: 'Search by client name or phone', example: 'Sara' })
  @IsOptional() @IsString() search?: string;
}

@ApiTags('Mobile Employee / Clients')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(ClientResponseDto)
@UseGuards(JwtGuard)
@Controller('mobile/employee/clients')
export class MobileEmployeeClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated employee's clients" })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Search by client name or phone', example: 'Sara' })
  @ApiOkResponse({
    description: 'Paginated list of clients who have had bookings with this employee',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(ClientResponseDto) } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  })
  async listMyClients(
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeClientListQuery,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const clientIdRows = await this.prisma.booking.findMany({
      where: { employeeId: user.sub },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const ids = clientIdRows.map((b) => b.clientId);

    const where = {
      id: { in: ids },
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { phone: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Get(':clientId/history')
  @ApiOperation({ summary: "Get booking history for a client with the authenticated employee" })
  @ApiParam({ name: 'clientId', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'List of past bookings (up to 20, most recent first)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          scheduledAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', example: 'COMPLETED' },
          durationMins: { type: 'integer', example: 60 },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Client not found' })
  clientHistory(
    @CurrentUser() user: JwtUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.prisma.booking.findMany({
      where: { employeeId: user.sub, clientId },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
    });
  }
}
