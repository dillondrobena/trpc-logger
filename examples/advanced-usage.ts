import { loggedProcedure, timestampFormat, jsonFormat, consoleTransport, fileTransport } from '../src';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

// Define the context type with logger
interface AppContext {
    logger?: import('../src').Logger;
    userId?: string;
}

const t = initTRPC.context<AppContext>().create();

// Advanced logging configuration with multiple pipelines
const advancedConfig = {
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
            transport: fileTransport('errors.log')
        },
        {
            name: 'debug-file',
            level: 'debug' as const,
            format: (name, message, meta) => `[DEBUG] [${name}] ${message} ${JSON.stringify(meta)}`,
            transport: fileTransport('debug.log')
        },
        {
            name: 'external-service',
            level: 'warn' as const,
            transport: (name, message, meta) => {
                // Example: Send to external logging service
                console.log(`[EXTERNAL] Sending to service: ${message}`, { name, meta });
            }
        }
    ],
    defaultLevel: 'info' as const
};

const procedure = loggedProcedure(t.procedure, advancedConfig);

export const userRouter = t.router({
    // Query with comprehensive logging
    getUser: procedure
        .withLogger('getUser')
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            ctx.logger.info('Fetching user data', { userId: input.id, requestId: Date.now() });

            try {
                // Simulate database call
                const user = await fetchUserFromDatabase(input.id);

                if (!user) {
                    ctx.logger.warn('User not found', { userId: input.id });
                    throw new Error('User not found');
                }

                ctx.logger.debug('User data retrieved successfully', {
                    userId: input.id,
                    userFields: Object.keys(user)
                });

                return user;
            } catch (error) {
                ctx.logger.error('Failed to fetch user', {
                    userId: input.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }
        }),

    // Mutation with different log levels
    updateUser: procedure
        .withLogger('updateUser')
        .input(z.object({
            id: z.string(),
            data: z.object({
                name: z.string().optional(),
                email: z.string().email().optional()
            })
        }))
        .mutation(async ({ input, ctx }) => {
            ctx.logger.info('Updating user', {
                userId: input.id,
                updateFields: Object.keys(input.data)
            });

            // Validate user exists
            const existingUser = await fetchUserFromDatabase(input.id);
            if (!existingUser) {
                ctx.logger.error('Cannot update non-existent user', { userId: input.id });
                throw new Error('User not found');
            }

            // Check for conflicts
            if (input.data.email && input.data.email !== existingUser.email) {
                const emailExists = await checkEmailExists(input.data.email);
                if (emailExists) {
                    ctx.logger.warn('Email already exists', {
                        userId: input.id,
                        email: input.data.email
                    });
                    throw new Error('Email already in use');
                }
            }

            // Perform update
            const updatedUser = await updateUserInDatabase(input.id, input.data);

            ctx.logger.info('User updated successfully', {
                userId: input.id,
                updatedFields: Object.keys(input.data)
            });

            return updatedUser;
        })
});

// Mock functions for demonstration
async function fetchUserFromDatabase(id: string) {
    // Simulate database call
    return { id, name: 'John Doe', email: 'john@example.com' };
}

async function checkEmailExists(email: string) {
    // Simulate email check
    return false;
}

async function updateUserInDatabase(id: string, data: any) {
    // Simulate database update
    return { id, ...data };
} 