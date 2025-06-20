import {
    loggedProcedure,
    timestampFormat,
    jsonFormat,
    consoleTransport,
    fileTransport,
    httpTransport,
    winstonTransport,
    createPerformanceMonitor,
    createLoggingMiddleware,
    createErrorHandlingMiddleware,
    createRateLimitingMiddleware,
    createAuthLoggingMiddleware,
    combineMiddlewares,
    validatePipelineConfig,
    createValidatedPipelineConfig,
    type Logger
} from '../src';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Enterprise context with comprehensive logging
interface EnterpriseContext {
    logger?: Logger;
    userId?: string;
    requestId?: string;
    userRole?: string;
    performanceMonitor?: ReturnType<typeof createPerformanceMonitor>;
}

const t = initTRPC.context<EnterpriseContext>().create();

// Validate and create pipeline configuration
const pipelineConfig = createValidatedPipelineConfig({
    pipelines: [
        {
            name: 'console',
            level: 'info' as const,
            format: timestampFormat,
            transport: consoleTransport
        },
        {
            name: 'error-file',
            level: 'error' as const,
            format: jsonFormat,
            transport: fileTransport('logs/errors.log')
        },
        {
            name: 'audit-file',
            level: 'info' as const,
            format: (name, message, meta) => {
                return JSON.stringify({
                    timestamp: new Date().toISOString(),
                    procedure: name,
                    message,
                    meta,
                    audit: true
                });
            },
            transport: fileTransport('logs/audit.log')
        },
        {
            name: 'external-api',
            level: 'warn' as const,
            transport: httpTransport('https://logs.company.com/api/logs', {
                headers: {
                    'Authorization': `Bearer ${process.env.LOG_API_KEY}`,
                    'X-Service': 'trpc-api'
                },
                timeout: 5000
            })
        }
    ],
    defaultLevel: 'info' as const
});

// Create performance monitor
const performanceConfig = {
    enabled: true,
    logSlowQueries: true,
    slowQueryThreshold: 1000, // 1 second
    logMemoryUsage: true,
    logInputOutput: false // Don't log sensitive data
};

// Create the logged procedure with enterprise features
const procedure = loggedProcedure(t.procedure, pipelineConfig);

// Create enterprise middleware using tRPC middleware system
const enterpriseMiddleware = t.middleware(async (opts) => {
    const { ctx, next } = opts;

    // Ensure logger exists in context
    if (!ctx.logger) {
        throw new Error('Logger not found in context');
    }

    // Create performance monitor if not exists
    const performanceMonitor = ctx.performanceMonitor || createPerformanceMonitor(ctx.logger, performanceConfig);

    // Log request start
    ctx.logger.info('Request started', {
        procedure: opts.path,
        requestId: ctx.requestId,
        userId: ctx.userId,
        userRole: ctx.userRole
    });

    const startTime = Date.now();

    try {
        // Call next middleware/procedure
        const result = await next({
            ctx: {
                ...ctx,
                performanceMonitor
            }
        });

        const duration = Date.now() - startTime;

        // Log successful response
        ctx.logger.info('Request completed successfully', {
            procedure: opts.path,
            duration,
            requestId: ctx.requestId
        });

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        // Log error
        ctx.logger.error('Request failed', {
            procedure: opts.path,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
            requestId: ctx.requestId
        });

        throw error;
    }
});

// Enterprise user management router
export const enterpriseUserRouter = t.router({
    // User authentication with comprehensive logging
    authenticate: procedure
        .withLogger('user.authenticate')
        .use(enterpriseMiddleware)
        .input(z.object({
            email: z.string().email(),
            password: z.string().min(8)
        }))
        .mutation(async ({ input, ctx }) => {
            const startTime = Date.now();

            ctx.logger!.info('User authentication attempt', {
                email: input.email,
                requestId: ctx.requestId,
                timestamp: new Date().toISOString()
            });

            try {
                // Simulate authentication
                const user = await authenticateUser(input.email, input.password);

                if (!user) {
                    ctx.logger!.warn('Authentication failed - invalid credentials', {
                        email: input.email,
                        requestId: ctx.requestId
                    });
                    throw new Error('Invalid credentials');
                }

                const duration = Date.now() - startTime;
                ctx.logger!.info('User authenticated successfully', {
                    userId: user.id,
                    email: input.email,
                    duration,
                    requestId: ctx.requestId
                });

                return {
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    },
                    token: generateToken(user.id)
                };
            } catch (error) {
                ctx.logger!.error('Authentication error', {
                    email: input.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    requestId: ctx.requestId
                });
                throw error;
            }
        }),

    // User profile management with performance monitoring
    updateProfile: procedure
        .withLogger('user.updateProfile')
        .use(enterpriseMiddleware)
        .input(z.object({
            userId: z.string(),
            updates: z.object({
                name: z.string().optional(),
                email: z.string().email().optional(),
                preferences: z.record(z.any()).optional()
            })
        }))
        .mutation(async ({ input, ctx }) => {
            const monitor = ctx.performanceMonitor!;
            const metrics = monitor.start('user.updateProfile', input);

            try {
                ctx.logger!.info('Profile update request', {
                    userId: input.userId,
                    updateFields: Object.keys(input.updates),
                    requestId: ctx.requestId
                });

                // Validate user permissions
                if (ctx.userId !== input.userId && ctx.userRole !== 'admin') {
                    ctx.logger!.warn('Unauthorized profile update attempt', {
                        requestingUserId: ctx.userId,
                        targetUserId: input.userId,
                        requestId: ctx.requestId
                    });
                    throw new Error('Unauthorized');
                }

                // Simulate database update
                const updatedUser = await updateUserProfile(input.userId, input.updates);

                monitor.end(metrics, updatedUser);

                ctx.logger!.info('Profile updated successfully', {
                    userId: input.userId,
                    updatedFields: Object.keys(input.updates),
                    requestId: ctx.requestId
                });

                return updatedUser;
            } catch (error) {
                monitor.end(metrics, undefined, error as Error);
                throw error;
            }
        }),

    // User search with rate limiting and performance monitoring
    searchUsers: procedure
        .withLogger('user.searchUsers')
        .use(enterpriseMiddleware)
        .input(z.object({
            query: z.string().min(1),
            filters: z.object({
                role: z.string().optional(),
                status: z.enum(['active', 'inactive']).optional(),
                createdAfter: z.string().optional()
            }).optional(),
            pagination: z.object({
                page: z.number().min(1),
                limit: z.number().min(1).max(100)
            }).optional()
        }))
        .query(async ({ input, ctx }) => {
            const monitor = ctx.performanceMonitor!;
            const metrics = monitor.start('user.searchUsers', input);

            try {
                ctx.logger!.debug('User search initiated', {
                    query: input.query,
                    filters: input.filters,
                    pagination: input.pagination,
                    requestId: ctx.requestId
                });

                // Simulate database search
                const results = await searchUsersInDatabase(input);

                monitor.end(metrics, results);

                ctx.logger!.info('User search completed', {
                    query: input.query,
                    resultCount: results.users.length,
                    totalCount: results.total,
                    requestId: ctx.requestId
                });

                return results;
            } catch (error) {
                monitor.end(metrics, undefined, error as Error);
                throw error;
            }
        }),

    // Bulk operations with comprehensive logging
    bulkUpdateUsers: procedure
        .withLogger('user.bulkUpdateUsers')
        .use(enterpriseMiddleware)
        .input(z.object({
            userIds: z.array(z.string()),
            updates: z.record(z.any()),
            dryRun: z.boolean().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            const startTime = Date.now();

            ctx.logger!.info('Bulk user update initiated', {
                userIdCount: input.userIds.length,
                updateFields: Object.keys(input.updates),
                dryRun: input.dryRun,
                requestId: ctx.requestId,
                requestingUser: ctx.userId
            });

            try {
                // Validate permissions
                if (ctx.userRole !== 'admin') {
                    ctx.logger!.error('Unauthorized bulk update attempt', {
                        requestingUser: ctx.userId,
                        userRole: ctx.userRole,
                        requestId: ctx.requestId
                    });
                    throw new Error('Admin privileges required');
                }

                const results = await performBulkUserUpdate(input);
                const duration = Date.now() - startTime;

                ctx.logger!.info('Bulk user update completed', {
                    successCount: results.successCount,
                    failureCount: results.failureCount,
                    duration,
                    requestId: ctx.requestId
                });

                return results;
            } catch (error) {
                ctx.logger!.error('Bulk user update failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    requestId: ctx.requestId
                });
                throw error;
            }
        })
});

// Mock functions for demonstration
async function authenticateUser(email: string, password: string) {
    // Simulate authentication
    if (email === 'admin@company.com' && password === 'password123') {
        return { id: '1', email, role: 'admin' };
    }
    return null;
}

function generateToken(userId: string): string {
    return `token_${userId}_${Date.now()}`;
}

async function updateUserProfile(userId: string, updates: any) {
    // Simulate database update
    return { id: userId, ...updates, updatedAt: new Date().toISOString() };
}

async function searchUsersInDatabase(input: any) {
    // Simulate database search
    return {
        users: [
            { id: '1', name: 'John Doe', email: 'john@company.com', role: 'user' },
            { id: '2', name: 'Jane Smith', email: 'jane@company.com', role: 'admin' }
        ],
        total: 2
    };
}

async function performBulkUserUpdate(input: any) {
    // Simulate bulk update
    return {
        successCount: input.userIds.length,
        failureCount: 0,
        errors: []
    };
}

// Export the router
export const createEnterpriseRouter = () => {
    return t.router({
        users: enterpriseUserRouter
    });
}; 