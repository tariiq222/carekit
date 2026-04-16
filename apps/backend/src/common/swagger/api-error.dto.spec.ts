import { ApiErrorDto } from './api-error.dto';
import { getSchemaPath } from '@nestjs/swagger';

describe('ApiErrorDto', () => {
  it('exposes exactly the fields produced by HttpExceptionFilter', () => {
    const instance = new ApiErrorDto();
    instance.statusCode = 400;
    instance.error = 'Bad Request';
    instance.message = 'validation failed';
    instance.timestamp = '2026-04-17T00:00:00.000Z';
    instance.path = '/api/v1/dashboard/bookings';
    instance.requestId = 'req-123';

    expect(Object.keys(instance).sort()).toEqual(
      ['error', 'message', 'path', 'requestId', 'statusCode', 'timestamp'].sort(),
    );
    expect(getSchemaPath(ApiErrorDto)).toContain('ApiErrorDto');
  });
});
