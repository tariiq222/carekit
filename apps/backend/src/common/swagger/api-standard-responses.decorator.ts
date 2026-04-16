import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorDto } from './api-error.dto';

/**
 * Applies the baseline error responses every protected endpoint can return:
 *   400 Bad Request   – validation failure
 *   401 Unauthorized  – missing/invalid JWT
 *   403 Forbidden     – CASL denied the action
 *   500 Internal      – unhandled error
 *
 * Endpoints that lookup a resource should additionally add their own 404.
 */
export const ApiStandardResponses = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorDto }),
    ApiResponse({ status: 401, description: 'Missing or invalid authentication', type: ApiErrorDto }),
    ApiResponse({ status: 403, description: 'Action denied by permission policy', type: ApiErrorDto }),
    ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto }),
  );
