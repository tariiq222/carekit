/**
 * StructuredLogger Unit Tests
 */
import { StructuredLogger } from '../../../src/common/services/structured-logger.service.js';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    jest.restoreAllMocks();
  });

  describe('in production mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      logger = new StructuredLogger();
      stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);
    });

    it('should write JSON log entry for log()', () => {
      logger.log('test message', 'TestContext');

      expect(stdoutSpy).toHaveBeenCalled();
      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test message');
    });

    it('should write JSON to stderr for error()', () => {
      logger.error('error message', 'stack trace', 'TestContext');

      expect(stderrSpy).toHaveBeenCalled();
      const written = stderrSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.level).toBe('error');
      expect(entry.trace).toBe('stack trace');
    });

    it('should write JSON for warn()', () => {
      logger.warn('warn message', 'TestContext');

      expect(stdoutSpy).toHaveBeenCalled();
      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.level).toBe('warn');
    });

    it('should write JSON for debug()', () => {
      logger.debug('debug message');

      expect(stdoutSpy).toHaveBeenCalled();
      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.level).toBe('debug');
    });

    it('should write JSON for verbose()', () => {
      logger.verbose('verbose message');

      expect(stdoutSpy).toHaveBeenCalled();
      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.level).toBe('verbose');
    });

    it('should include timestamp in log entry', () => {
      logger.log('message');

      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).toISOString()).toBeTruthy();
    });

    it('should not include trace when not provided in log()', () => {
      logger.log('message');

      const written = stdoutSpy.mock.calls[0][0] as string;
      const entry = JSON.parse(written);
      expect(entry.trace).toBeUndefined();
    });
  });

  describe('in development mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
      logger = new StructuredLogger();
      stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      stderrSpy = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);
    });

    it('should not write JSON in development (uses parent ConsoleLogger)', () => {
      // ConsoleLogger will use process.stdout but not our JSON format
      // just confirm it doesn't throw
      expect(() => logger.log('dev message')).not.toThrow();
    });
  });
});
