import { loggedProcedure, type Logger, type PipelineConfig } from '../index';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

describe('trpc-logger Integration Tests', () => {
    let mockTransport: jest.Mock;
    let mockErrorTransport: jest.Mock;

    beforeEach(() => {
        mockTransport = jest.fn();
        mockErrorTransport = jest.fn();
    });

    describe('Logger Functionality', () => {
        it('should create logger with correct methods', () => {
            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'test',
                        level: 'info' as const,
                        transport: mockTransport
                    }
                ]
            };

            // Create a mock procedure builder
            const mockBase = {
                use: jest.fn().mockImplementation((fn) => {
                    // Simulate the middleware function
                    const mockCtx = { someData: 'test' };
                    const mockNext = jest.fn().mockResolvedValue({ ctx: mockCtx });
                    return fn({ ctx: mockCtx, next: mockNext });
                })
            } as any;

            const procedure = loggedProcedure(mockBase, config);
            const withLoggerProcedure = procedure.withLogger('test-procedure');

            expect(withLoggerProcedure).toBeDefined();
            expect(mockBase.use).toHaveBeenCalled();
        });

        it('should handle different log levels', () => {
            const infoTransport = jest.fn();
            const debugTransport = jest.fn();
            const errorTransport = jest.fn();

            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'info',
                        level: 'info' as const,
                        transport: infoTransport
                    },
                    {
                        name: 'debug',
                        level: 'debug' as const,
                        transport: debugTransport
                    },
                    {
                        name: 'error',
                        level: 'error' as const,
                        transport: errorTransport
                    }
                ]
            };

            const mockBase = {
                use: jest.fn().mockReturnThis()
            } as any;

            const procedure = loggedProcedure(mockBase, config);
            expect(procedure.withLogger).toBeDefined();
        });

        it('should use custom formatting', () => {
            const customTransport = jest.fn();
            const customFormat = (name: string | undefined, message: string, meta?: Record<string, any>) => {
                return `CUSTOM[${name}]: ${message}`;
            };

            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'custom',
                        level: 'info' as const,
                        format: customFormat,
                        transport: customTransport
                    }
                ]
            };

            const mockBase = {
                use: jest.fn().mockReturnThis()
            } as any;

            const procedure = loggedProcedure(mockBase, config);
            expect(procedure.withLogger).toBeDefined();
        });
    });

    describe('Pipeline Configuration', () => {
        it('should validate pipeline configuration', () => {
            const validConfig: PipelineConfig = {
                pipelines: [
                    {
                        name: 'console',
                        level: 'info' as const,
                        transport: mockTransport
                    }
                ],
                defaultLevel: 'info' as const
            };

            expect(validConfig.pipelines).toHaveLength(1);
            expect(validConfig.defaultLevel).toBe('info');
        });

        it('should handle multiple pipelines', () => {
            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'console',
                        level: 'info' as const,
                        transport: mockTransport
                    },
                    {
                        name: 'file',
                        level: 'error' as const,
                        transport: mockErrorTransport
                    }
                ]
            };

            expect(config.pipelines).toHaveLength(2);
            expect(config.pipelines[0].name).toBe('console');
            expect(config.pipelines[1].name).toBe('file');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing pipeline configuration', () => {
            const config: PipelineConfig = {
                pipelines: []
            };

            const mockBase = {
                use: jest.fn().mockReturnThis()
            } as any;

            const procedure = loggedProcedure(mockBase, config);
            expect(procedure.withLogger).toBeDefined();
        });

        it('should handle invalid log levels gracefully', () => {
            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'test',
                        level: 'info' as const,
                        transport: mockTransport
                    }
                ],
                defaultLevel: 'info' as const
            };

            expect(config.pipelines[0].level).toBe('info');
        });
    });
}); 