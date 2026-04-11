import { applyDecorators } from '@nestjs/common';
import {
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

/** Standard error responses applied to all protected endpoints */
export function ApiStandardResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
    ApiBadRequestResponse({
      description: 'Validation error in request body or params',
    }),
  );
}

/** For endpoints that can 404 */
export function ApiNotFoundResponse404(entity: string) {
  return ApiNotFoundResponse({ description: `${entity} not found` });
}

/** For public endpoints (no auth errors) */
export function ApiPublicResponse() {
  return applyDecorators(
    ApiBadRequestResponse({ description: 'Validation error' }),
  );
}
