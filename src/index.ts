import type { ProcedureBuilder } from "@trpc/server/unstable-core-do-not-import"

// Logger pipeline interface
export interface LoggerPipeline {
    name: string;
    level?: 'error' | 'warn' | 'info' | 'debug';
    format?: (name: string | undefined, message: string, meta?: Record<string, any>) => string;
    transport: (name: string | undefined, message: string, meta?: Record<string, any>) => void;
}

// Pipeline configuration interface
export interface PipelineConfig {
    pipelines: LoggerPipeline[];
    defaultLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// Logger interface with level-specific methods
export interface Logger {
    error: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
    info: (message: string, meta?: Record<string, any>) => void;
    debug: (message: string, meta?: Record<string, any>) => void;
}

// Extended procedure builder type
export type ExtendedProcedureBuilder<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller extends boolean
> = ProcedureBuilder<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller
> & {
    withLogger: <TName extends string>(
        name?: TName
    ) => ExtendedProcedureBuilder<
        TContext,
        TMeta,
        TContextOverrides & {
            logger: Logger;
        },
        TInputIn,
        TInputOut,
        TOutputIn,
        TOutputOut,
        TCaller
    >;
};

// Create a logged procedure with pipeline configurations
export function loggedProcedure<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller extends boolean
>(
    base: ProcedureBuilder<
        TContext,
        TMeta,
        TContextOverrides,
        TInputIn,
        TInputOut,
        TOutputIn,
        TOutputOut,
        TCaller
    >,
    config: PipelineConfig
): ExtendedProcedureBuilder<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller
> {
    const { pipelines, defaultLevel = 'info' } = config;

    const withLogger = <TName extends string>(name?: TName) => {
        const createLoggerMethod = (level: 'error' | 'warn' | 'info' | 'debug') => {
            return (message: string, meta?: Record<string, any>) => {
                // Filter pipelines by level
                const levelPipelines = pipelines.filter(pipeline => {
                    const pipelineLevel = pipeline.level || defaultLevel;
                    return pipelineLevel === level;
                });

                for (const pipeline of levelPipelines) {
                    const formattedMessage = pipeline.format
                        ? pipeline.format(name, message, meta)
                        : `[${level.toUpperCase()}] [${name}] ${message}`;

                    pipeline.transport(name, formattedMessage, meta);
                }
            };
        };

        const logger: Logger = {
            error: createLoggerMethod('error'),
            warn: createLoggerMethod('warn'),
            info: createLoggerMethod('info'),
            debug: createLoggerMethod('debug'),
        };

        const newBuilder = base.use(async (opts) => {
            return opts.next({
                ctx: {
                    ...opts.ctx,
                    logger,
                },
            });
        }) as ProcedureBuilder<
            TContext,
            TMeta,
            TContextOverrides & {
                logger: Logger;
            },
            TInputIn,
            TInputOut,
            TOutputIn,
            TOutputOut,
            TCaller
        >;

        return loggedProcedure(newBuilder, config);
    };

    return Object.assign(base, {
        withLogger,
    });
}

// Default extension with no pipelines for backward compatibility
export function extendProcedure<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller extends boolean
>(
    base: ProcedureBuilder<
        TContext,
        TMeta,
        TContextOverrides,
        TInputIn,
        TInputOut,
        TOutputIn,
        TOutputOut,
        TCaller
    >
): ExtendedProcedureBuilder<
    TContext,
    TMeta,
    TContextOverrides,
    TInputIn,
    TInputOut,
    TOutputIn,
    TOutputOut,
    TCaller
> {
    return loggedProcedure(base, { pipelines: [] });
}
