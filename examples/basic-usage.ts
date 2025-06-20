import { loggedProcedure, type Logger } from '../src';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<{ logger?: Logger }>().create();

const config = {
    pipelines: [
        {
            name: 'console',
            level: 'info' as const,
            transport: (name: string | undefined, message: string, meta?: Record<string, any>) => console.log(message, meta)
        }
    ]
};

const procedure = loggedProcedure(t.procedure, config);

export const helloRouter = t.router({
    hello: procedure
        .withLogger('hello')
        .input(z.object({ name: z.string() }))
        .query(async ({ input, ctx }) => {
            ctx.logger.info('Processing hello request', { input });
            return { message: `Hello ${input.name}!` };
        })
}); 