import { createPerformanceMonitor, PerformanceMonitor, performanceMiddleware } from '../performance';
import type { Logger } from '../index';

describe('Performance Monitoring', () => {
    let mockLogger: Logger;
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
        };
    });

    describe('PerformanceMonitor', () => {
        it('should create a performance monitor with default config', () => {
            monitor = new PerformanceMonitor(mockLogger);
            expect(monitor).toBeDefined();
        });

        it('should create a performance monitor with custom config', () => {
            monitor = new PerformanceMonitor(mockLogger, {
                enabled: true,
                logSlowQueries: true,
                slowQueryThreshold: 500,
                logMemoryUsage: true,
                logInputOutput: true
            });
            expect(monitor).toBeDefined();
        });

        it('should start monitoring', () => {
            monitor = new PerformanceMonitor(mockLogger);
            const metrics = monitor.start('test-procedure', { test: 'input' });

            expect(metrics.procedureName).toBe('test-procedure');
            expect(metrics.startTime).toBeGreaterThan(0);
            expect(metrics.input).toBeUndefined(); // Default config doesn't log input
        });

        it('should log input when configured', () => {
            monitor = new PerformanceMonitor(mockLogger, { logInputOutput: true });
            const metrics = monitor.start('test-procedure', { test: 'input' });

            expect(metrics.input).toEqual({ test: 'input' });
        });

        it('should end monitoring and log results', () => {
            monitor = new PerformanceMonitor(mockLogger, { logInputOutput: true });
            const metrics = monitor.start('test-procedure');

            // End monitoring immediately
            monitor.end(metrics, { result: 'success' });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Procedure test-procedure completed',
                expect.objectContaining({
                    duration: expect.any(Number),
                    input: undefined,
                    output: { result: 'success' }
                })
            );
        });

        it('should log errors when procedure fails', () => {
            monitor = new PerformanceMonitor(mockLogger);
            const metrics = monitor.start('test-procedure');
            const error = new Error('Test error');

            monitor.end(metrics, undefined, error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Procedure test-procedure failed',
                expect.objectContaining({
                    duration: expect.any(Number),
                    error: 'Test error',
                    stack: error.stack
                })
            );
        });

        it('should log slow queries as warnings', () => {
            monitor = new PerformanceMonitor(mockLogger, {
                logSlowQueries: true,
                slowQueryThreshold: 10,
                logInputOutput: true
            });

            const metrics = monitor.start('slow-procedure');

            // Simulate slow execution by adding a small delay
            const startTime = Date.now();
            while (Date.now() - startTime < 20) {
                // Busy wait to simulate slow execution
            }

            monitor.end(metrics, { result: 'slow' });

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Procedure slow-procedure completed',
                expect.objectContaining({
                    duration: expect.any(Number),
                    output: { result: 'slow' }
                })
            );
        });

        it('should not log when disabled', () => {
            monitor = new PerformanceMonitor(mockLogger, { enabled: false });
            const metrics = monitor.start('test-procedure');

            monitor.end(metrics, { result: 'success' });

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should handle memory usage tracking', () => {
            monitor = new PerformanceMonitor(mockLogger, { logMemoryUsage: true });
            const metrics = monitor.start('test-procedure');

            monitor.end(metrics, { result: 'success' });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Procedure test-procedure completed',
                expect.objectContaining({
                    memoryUsage: expect.objectContaining({
                        rss: expect.any(Number),
                        heapUsed: expect.any(Number),
                        heapTotal: expect.any(Number)
                    })
                })
            );
        });
    });

    describe('createPerformanceMonitor', () => {
        it('should create a performance monitor with default config', () => {
            const monitor = createPerformanceMonitor(mockLogger);
            expect(monitor).toBeInstanceOf(PerformanceMonitor);
        });

        it('should create a performance monitor with custom config', () => {
            const monitor = createPerformanceMonitor(mockLogger, {
                slowQueryThreshold: 2000,
                logMemoryUsage: true
            });
            expect(monitor).toBeInstanceOf(PerformanceMonitor);
        });
    });

    describe('performanceMiddleware', () => {
        it('should create middleware function', () => {
            const middleware = performanceMiddleware(mockLogger);
            expect(typeof middleware).toBe('function');
        });

        it('should handle async operations', async () => {
            const middleware = performanceMiddleware(mockLogger);
            const mockOpts = {
                path: 'test-procedure',
                input: { test: 'input' },
                next: jest.fn().mockResolvedValue({ result: 'success' })
            };

            const result = await middleware(mockOpts);

            expect(result).toEqual({ result: 'success' });
            expect(mockOpts.next).toHaveBeenCalled();
        });

        it('should handle errors in middleware', async () => {
            const middleware = performanceMiddleware(mockLogger);
            const error = new Error('Test error');
            const mockOpts = {
                path: 'test-procedure',
                input: { test: 'input' },
                next: jest.fn().mockRejectedValue(error)
            };

            await expect(middleware(mockOpts)).rejects.toThrow('Test error');
        });
    });
}); 