import {
    loggedProcedure,
    createLoggingMiddleware,
    createErrorHandlingMiddleware,
    createRateLimitingMiddleware,
    createPerformanceMiddleware,
    createComprehensiveMiddleware,
    type Logger
} from '../src';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Define context with logger
interface AppContext {
    logger?: Logger;
    userId?: string;
    requestId?: string;
}

const t = initTRPC.context<AppContext>().create();

// Basic logging configuration
const loggerConfig = {
    pipelines: [
        {
            name: 'console',
            level: 'info' as const,
            transport: (name: string | undefined, message: string, meta?: Record<string, any>) => {
                console.log(`[${name}] ${message}`, meta);
            }
        }
    ]
};

// Create the logged procedure
const procedure = loggedProcedure(t.procedure, loggerConfig);

// Example 1: Individual Middleware
export const individualMiddlewareRouter = t.router({
    greeting: procedure
        .withLogger('greeting')
        .use(createLoggingMiddleware({
            logRequests: true,
            logResponses: true,
            logErrors: true,
            maskSensitiveFields: ['password', 'token']
        }))
        .use(createErrorHandlingMiddleware({
            logAllErrors: true,
            logValidationErrors: true,
            logAuthErrors: true,
            includeStack: false
        }))
        .use(createPerformanceMiddleware({
            enabled: true,
            logSlowQueries: true,
            slowQueryThreshold: 1000,
            logMemoryUsage: false
        }))
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input, ctx }) => {
            ctx.logger.info('Processing greeting request', { input });

            // Handle empty string as undefined
            const displayName = input?.name && input.name.trim() !== '' ? input.name : undefined;

            if (!displayName) {
                ctx.logger.warn('No name provided, using default', { input });
            }

            return {
                message: `Hello ${displayName ?? 'World'}!`,
                timestamp: new Date().toISOString(),
            };
        }),
});

// Example 2: Comprehensive Middleware
export const comprehensiveMiddlewareRouter = t.router({
    greeting: procedure
        .withLogger('greeting')
        .use(createComprehensiveMiddleware({
            logging: {
                logRequests: true,
                logResponses: true,
                logErrors: true,
                maskSensitiveFields: ['password', 'token', 'secret']
            },
            errorHandling: {
                logAllErrors: true,
                logValidationErrors: true,
                logAuthErrors: true,
                includeStack: false
            },
            rateLimiting: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100,
                keyGenerator: (opts) => opts.ctx?.userId || opts.ctx?.requestId || 'anonymous'
            },
            performance: {
                enabled: true,
                logSlowQueries: true,
                slowQueryThreshold: 1000,
                logMemoryUsage: false
            },
            authLogging: true
        }))
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input, ctx }) => {
            ctx.logger.info('Processing greeting request', { input });

            // Handle empty string as undefined
            const displayName = input?.name && input.name.trim() !== '' ? input.name : undefined;

            return {
                message: `Hello ${displayName ?? 'World'}!`,
                timestamp: new Date().toISOString(),
            };
        }),
});

// Example 3: Reusable Logged Procedure with Middleware
const createLoggedProcedureWithMiddleware = () => {
    return procedure
        .withLogger('app')
        .use(createComprehensiveMiddleware({
            logging: {
                logRequests: true,
                logResponses: true,
                logErrors: true
            },
            errorHandling: {
                logAllErrors: true,
                logValidationErrors: true,
                logAuthErrors: true,
                includeStack: false
            },
            performance: {
                enabled: true,
                logSlowQueries: true,
                slowQueryThreshold: 1000,
                logMemoryUsage: false
            }
        }));
};

export const reusableMiddlewareRouter = t.router({
    greeting: createLoggedProcedureWithMiddleware()
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input, ctx }) => {
            ctx.logger.info('Processing greeting request', { input });

            // Handle empty string as undefined
            const displayName = input?.name && input.name.trim() !== '' ? input.name : undefined;

            return {
                message: `Hello ${displayName ?? 'World'}!`,
                timestamp: new Date().toISOString(),
            };
        }),

    goodbye: createLoggedProcedureWithMiddleware()
        .input(z.object({ name: z.string() }))
        .query(({ input, ctx }) => {
            ctx.logger.info('Processing goodbye request', { input });
            return {
                message: `Goodbye ${input.name}!`,
                timestamp: new Date().toISOString(),
            };
        }),
});

// Example 4: Error Handling Demonstration
export const errorHandlingRouter = t.router({
    riskyOperation: procedure
        .withLogger('riskyOperation')
        .use(createErrorHandlingMiddleware({
            logAllErrors: true,
            logValidationErrors: true,
            logAuthErrors: true,
            includeStack: true
        }))
        .input(z.object({
            shouldFail: z.boolean(),
            errorType: z.enum(['validation', 'runtime', 'auth']).optional()
        }))
        .query(({ input, ctx }) => {
            ctx.logger.info('Starting risky operation', { input });

            if (input.shouldFail) {
                if (input.errorType === 'validation') {
                    throw new Error('Validation error');
                } else if (input.errorType === 'auth') {
                    const authError = new Error('Unauthorized');
                    (authError as any).code = 'UNAUTHORIZED';
                    throw authError;
                } else {
                    throw new Error('Runtime error');
                }
            }

            ctx.logger.info('Risky operation completed successfully');
            return { success: true, message: 'Operation completed' };
        }),
});

// Example 5: Performance Monitoring
export const performanceRouter = t.router({
    slowOperation: procedure
        .withLogger('slowOperation')
        .use(createPerformanceMiddleware({
            enabled: true,
            logSlowQueries: true,
            slowQueryThreshold: 100, // 100ms threshold for testing
            logMemoryUsage: true
        }))
        .input(z.object({ delay: z.number().min(0).max(5000) }))
        .query(async ({ input, ctx }) => {
            ctx.logger.info('Starting slow operation', { input });

            // Simulate slow operation
            await new Promise(resolve => setTimeout(resolve, input.delay));

            ctx.logger.info('Slow operation completed');
            return {
                success: true,
                duration: input.delay,
                message: 'Operation completed after delay'
            };
        }),
}); 