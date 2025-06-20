import { loggedProcedure, extendProcedure, type Logger, type PipelineConfig } from '../index';

describe('trpc-logger', () => {
    let mockTransport: jest.Mock;

    beforeEach(() => {
        mockTransport = jest.fn();
    });

    describe('loggedProcedure', () => {
        it('should create a procedure with logging capabilities', () => {
            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'test',
                        level: 'info',
                        transport: mockTransport
                    }
                ]
            };

            // Mock the base procedure
            const mockBase = {
                use: jest.fn().mockReturnThis()
            } as any;

            const procedure = loggedProcedure(mockBase, config);
            expect(procedure.withLogger).toBeDefined();
        });
    });

    describe('extendProcedure', () => {
        it('should create a procedure with empty pipelines', () => {
            // Mock the base procedure
            const mockBase = {
                use: jest.fn().mockReturnThis()
            } as any;

            const procedure = extendProcedure(mockBase);
            expect(procedure.withLogger).toBeDefined();
        });
    });

    describe('Logger interface', () => {
        it('should have all required methods', () => {
            const logger: Logger = {
                error: jest.fn(),
                warn: jest.fn(),
                info: jest.fn(),
                debug: jest.fn()
            };

            expect(logger.error).toBeDefined();
            expect(logger.warn).toBeDefined();
            expect(logger.info).toBeDefined();
            expect(logger.debug).toBeDefined();
        });
    });

    describe('PipelineConfig interface', () => {
        it('should accept valid pipeline configurations', () => {
            const config: PipelineConfig = {
                pipelines: [
                    {
                        name: 'console',
                        level: 'info',
                        transport: mockTransport
                    },
                    {
                        name: 'file',
                        level: 'debug',
                        format: (name, message, meta) => `[${name}] ${message}`,
                        transport: mockTransport
                    }
                ],
                defaultLevel: 'info'
            };

            expect(config.pipelines).toHaveLength(2);
            expect(config.defaultLevel).toBe('info');
        });
    });
}); 