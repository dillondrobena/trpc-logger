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

/**
 * Creates a logged procedure with pipeline configurations.
 * 
 * @param base - A tRPC ProcedureBuilder instance
 * @param config - Pipeline configuration with logging pipelines
 * @returns An ExtendedProcedureBuilder with logging capabilities
 * 
 * @example
 * ```typescript
 * const procedure = loggedProcedure(t.procedure, {
 *   pipelines: [{
 *     name: 'console',
 *     level: 'info',
 *     transport: (name, message, meta) => console.log(message, meta)
 *   }]
 * });
 * ```
 */
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

/**
 * Creates a procedure extension with no pipelines for backward compatibility.
 * This is equivalent to calling loggedProcedure with an empty pipelines array.
 * 
 * @param base - A tRPC ProcedureBuilder instance
 * @returns An ExtendedProcedureBuilder with empty logging configuration
 */
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

// Re-export formats and transports for convenience
export * from './formats';
export * from './transports';

// Re-export performance monitoring
export * from './performance';

// Re-export middleware
export * from './middleware';

// Re-export validation
export * from './validation';
