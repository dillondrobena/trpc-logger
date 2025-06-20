import type { Logger } from './index';
import type { ProcedureBuilder } from "@trpc/server/unstable-core-do-not-import";

export interface MiddlewareConfig {
    logRequests: boolean;
    logResponses: boolean;
    logErrors: boolean;
    includeHeaders: boolean;
    includeBody: boolean;
    maskSensitiveFields: string[];
    performanceMonitoring: boolean;
    slowQueryThreshold: number;
}

export interface RequestLogData {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
    timestamp: string;
    duration?: number;
    statusCode?: number;
    error?: Error;
}

/**
 * Create tRPC middleware for automatic request/response logging
 * Uses the existing logger from context injected by .withLogger()
 */
export function createLoggingMiddleware(
    config: Partial<MiddlewareConfig> = {}
) {
    const defaultConfig: MiddlewareConfig = {
        logRequests: true,
        logResponses: true,
        logErrors: true,
        includeHeaders: false,
        includeBody: true,
        maskSensitiveFields: ['password', 'token', 'secret', 'key'],
        performanceMonitoring: false,
        slowQueryThreshold: 1000
    };

    const finalConfig = { ...defaultConfig, ...config };

    return async (opts: any) => {
        const logger = opts.ctx.logger;
        if (!logger) {
            return opts.next();
        }

        const startTime = Date.now();
        const requestData: RequestLogData = {
            method: opts.type || 'unknown',
            path: opts.path || 'unknown',
            timestamp: new Date().toISOString()
        };

        // Log request
        if (finalConfig.logRequests) {
            const logData: any = {
                method: requestData.method,
                path: requestData.path,
                timestamp: requestData.timestamp
            };

            if (finalConfig.includeHeaders && opts.ctx?.req?.headers) {
                logData.headers = maskSensitiveData(opts.ctx.req.headers, finalConfig.maskSensitiveFields);
            }

            if (finalConfig.includeBody && opts.input) {
                logData.body = maskSensitiveData(opts.input, finalConfig.maskSensitiveFields);
            }

            logger.info('Request started', logData);
        }

        try {
            const result = await opts.next();
            const duration = Date.now() - startTime;

            // Log response
            if (finalConfig.logResponses) {
                const logData: any = {
                    method: requestData.method,
                    path: requestData.path,
                    duration,
                    statusCode: 200
                };

                if (finalConfig.includeBody) {
                    logData.response = result;
                }

                if (finalConfig.performanceMonitoring && duration > finalConfig.slowQueryThreshold) {
                    logger.warn('Slow query detected', logData);
                } else {
                    logger.info('Request completed', logData);
                }
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorObj = error as Error;

            // Log error
            if (finalConfig.logErrors) {
                logger.error('Request failed', {
                    method: requestData.method,
                    path: requestData.path,
                    duration,
                    error: errorObj.message,
                    stack: errorObj.stack,
                    statusCode: 500
                });
            }

            throw error;
        }
    };
}

/**
 * Create tRPC middleware for error handling and logging
 * Uses the existing logger from context
 */
export function createErrorHandlingMiddleware(
    config: {
        logAllErrors: boolean;
        logValidationErrors: boolean;
        logAuthErrors: boolean;
        includeStack: boolean;
    } = {
            logAllErrors: true,
            logValidationErrors: true,
            logAuthErrors: true,
            includeStack: false
        }
) {
    return async (opts: any) => {
        const logger = opts.ctx.logger;
        if (!logger) {
            return opts.next();
        }

        try {
            return await opts.next();
        } catch (error) {
            const errorObj = error as Error;
            const errorName = errorObj.constructor.name;

            // Determine if we should log this error
            let shouldLog = config.logAllErrors;

            if (errorName === 'ZodError' && !config.logValidationErrors) {
                shouldLog = false;
            }

            if ((errorName === 'TRPCError' && (error as any).code === 'UNAUTHORIZED') && !config.logAuthErrors) {
                shouldLog = false;
            }

            if (shouldLog) {
                const logData: any = {
                    error: errorObj.message,
                    type: errorName,
                    path: opts.path,
                    method: opts.type
                };

                if (config.includeStack) {
                    logData.stack = errorObj.stack;
                }

                logger.error('Procedure error', logData);
            }

            throw error;
        }
    };
}

/**
 * Create tRPC middleware for rate limiting with logging
 * Uses the existing logger from context
 */
export function createRateLimitingMiddleware(
    config: {
        windowMs: number;
        maxRequests: number;
        keyGenerator?: (opts: any) => string;
    }
) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return async (opts: any) => {
        const logger = opts.ctx.logger;
        if (!logger) {
            return opts.next();
        }

        const key = config.keyGenerator ? config.keyGenerator(opts) : opts.ctx?.userId || opts.ctx?.requestId || 'anonymous';
        const now = Date.now();

        // Clean up expired entries
        for (const [k, v] of requests.entries()) {
            if (now > v.resetTime) {
                requests.delete(k);
            }
        }

        const current = requests.get(key);
        if (!current || now > current.resetTime) {
            requests.set(key, {
                count: 1,
                resetTime: now + config.windowMs
            });
        } else {
            current.count++;
            if (current.count > config.maxRequests) {
                logger.warn('Rate limit exceeded', {
                    key,
                    count: current.count,
                    maxRequests: config.maxRequests,
                    path: opts.path
                });
                throw new Error('Rate limit exceeded');
            }
        }

        return opts.next();
    };
}

/**
 * Create tRPC middleware for authentication logging
 * Uses the existing logger from context
 */
export function createAuthLoggingMiddleware() {
    return async (opts: any) => {
        const logger = opts.ctx.logger;
        if (!logger) {
            return opts.next();
        }

        const userId = opts.ctx?.userId;
        const isAuthenticated = !!userId;

        if (isAuthenticated) {
            logger.debug('Authenticated request', {
                userId,
                path: opts.path,
                method: opts.type
            });
        } else {
            logger.warn('Unauthenticated request', {
                path: opts.path,
                method: opts.type
            });
        }

        return opts.next();
    };
}

/**
 * Create tRPC middleware for performance monitoring
 * Uses the existing logger from context
 */
export function createPerformanceMiddleware(
    config: {
        enabled: boolean;
        logSlowQueries: boolean;
        slowQueryThreshold: number;
        logMemoryUsage: boolean;
    } = {
            enabled: true,
            logSlowQueries: true,
            slowQueryThreshold: 1000,
            logMemoryUsage: false
        }
) {
    return async (opts: any) => {
        const logger = opts.ctx.logger;
        if (!logger || !config.enabled) {
            return opts.next();
        }

        const startTime = Date.now();
        const procedureName = opts.path || 'unknown';
        const input = opts.input;

        let memoryUsage: any = undefined;
        if (config.logMemoryUsage) {
            memoryUsage = process.memoryUsage();
        }

        try {
            const result = await opts.next();
            const duration = Date.now() - startTime;

            if (config.logSlowQueries && duration > config.slowQueryThreshold) {
                logger.warn('Slow query detected', {
                    procedure: procedureName,
                    duration,
                    input,
                    memoryUsage
                });
            } else {
                logger.debug('Procedure completed', {
                    procedure: procedureName,
                    duration,
                    memoryUsage
                });
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('Procedure failed', {
                procedure: procedureName,
                duration,
                error: error instanceof Error ? error.message : 'Unknown error',
                input,
                memoryUsage
            });

            throw error;
        }
    };
}

/**
 * Utility function to mask sensitive data
 */
function maskSensitiveData(data: any, sensitiveFields: string[]): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item, sensitiveFields));
    }

    const masked = { ...data };
    for (const field of sensitiveFields) {
        if (field in masked) {
            masked[field] = '[MASKED]';
        }
    }

    return masked;
}

/**
 * Combine multiple tRPC middlewares into a single middleware
 */
export function combineMiddlewares(...middlewares: Array<(opts: any) => Promise<any>>) {
    return async (opts: any) => {
        let currentOpts = opts;

        for (const middleware of middlewares) {
            currentOpts = {
                ...currentOpts,
                next: async () => {
                    return middleware(currentOpts);
                }
            };
        }

        return currentOpts.next();
    };
}

/**
 * Create a comprehensive tRPC middleware with all features
 * Uses the existing logger from context
 */
export function createComprehensiveMiddleware(
    config: {
        logging?: Partial<MiddlewareConfig>;
        errorHandling?: {
            logAllErrors: boolean;
            logValidationErrors: boolean;
            logAuthErrors: boolean;
            includeStack: boolean;
        };
        rateLimiting?: {
            windowMs: number;
            maxRequests: number;
            keyGenerator?: (opts: any) => string;
        };
        performance?: {
            enabled: boolean;
            logSlowQueries: boolean;
            slowQueryThreshold: number;
            logMemoryUsage: boolean;
        };
        authLogging?: boolean;
    } = {}
) {
    const middlewares: Array<(opts: any) => Promise<any>> = [];

    // Add logging middleware
    if (config.logging !== undefined) {
        middlewares.push(createLoggingMiddleware(config.logging));
    }

    // Add error handling middleware
    if (config.errorHandling !== undefined) {
        middlewares.push(createErrorHandlingMiddleware(config.errorHandling));
    }

    // Add rate limiting middleware
    if (config.rateLimiting) {
        middlewares.push(createRateLimitingMiddleware(config.rateLimiting));
    }

    // Add performance middleware
    if (config.performance !== undefined) {
        middlewares.push(createPerformanceMiddleware(config.performance));
    }

    // Add auth logging middleware
    if (config.authLogging) {
        middlewares.push(createAuthLoggingMiddleware());
    }

    return combineMiddlewares(...middlewares);
} 