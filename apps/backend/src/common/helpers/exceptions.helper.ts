import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

export function notFound(message: string, error = 'NOT_FOUND'): never {
  throw new NotFoundException({ statusCode: 404, message, error });
}

export function badRequest(message: string, error = 'BAD_REQUEST'): never {
  throw new BadRequestException({ statusCode: 400, message, error });
}

export function conflict(message: string, error = 'CONFLICT'): never {
  throw new ConflictException({ statusCode: 409, message, error });
}

export function forbidden(message: string, error = 'FORBIDDEN'): never {
  throw new ForbiddenException({ statusCode: 403, message, error });
}

export function unauthorized(message: string, error = 'UNAUTHORIZED'): never {
  throw new UnauthorizedException({ statusCode: 401, message, error });
}
