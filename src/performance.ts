import type { Logger } from './index';

export interface PerformanceMetrics {
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage & { diff?: NodeJS.MemoryUsage };
    procedureName: string;
    input?: any;
    output?: any;
    error?: Error;
}

export interface PerformanceConfig {
    enabled: boolean;
    logSlowQueries: boolean;
    slowQueryThreshold: number; // in milliseconds
    logMemoryUsage: boolean;
    logInputOutput: boolean;
}

export class PerformanceMonitor {
    private config: PerformanceConfig;
    private logger: Logger;

    constructor(logger: Logger, config: Partial<PerformanceConfig> = {}) {
        this.logger = logger;
        this.config = {
            enabled: true,
            logSlowQueries: true,
            slowQueryThreshold: 1000, // 1 second
            logMemoryUsage: false,
            logInputOutput: false,
            ...config
        };
    }

    /**
     * Start monitoring a procedure execution
     */
    start(procedureName: string, input?: any): PerformanceMetrics {
        if (!this.config.enabled) {
            return { procedureName, startTime: 0 };
        }

        const metrics: PerformanceMetrics = {
            startTime: Date.now(),
            procedureName,
            input: this.config.logInputOutput ? input : undefined
        };

        if (this.config.logMemoryUsage) {
            metrics.memoryUsage = process.memoryUsage();
        }

        return metrics;
    }

    /**
     * End monitoring and log results
     */
    end(metrics: PerformanceMetrics, output?: any, error?: Error): void {
        if (!this.config.enabled) return;

        metrics.endTime = Date.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        metrics.output = this.config.logInputOutput ? output : undefined;
        metrics.error = error;

        if (this.config.logMemoryUsage) {
            const currentMemory = process.memoryUsage();
            const memoryDiff = {
                rss: currentMemory.rss - (metrics.memoryUsage?.rss || 0),
                heapUsed: currentMemory.heapUsed - (metrics.memoryUsage?.heapUsed || 0),
                heapTotal: currentMemory.heapTotal - (metrics.memoryUsage?.heapTotal || 0),
                external: currentMemory.external - (metrics.memoryUsage?.external || 0),
                arrayBuffers: currentMemory.arrayBuffers - (metrics.memoryUsage?.arrayBuffers || 0)
            };
            metrics.memoryUsage = { ...currentMemory, diff: memoryDiff };
        }

        this.logPerformance(metrics);
    }

    private logPerformance(metrics: PerformanceMetrics): void {
        const { procedureName, duration, memoryUsage, input, output, error } = metrics;

        if (error) {
            this.logger.error(`Procedure ${procedureName} failed`, {
                duration,
                error: error.message,
                stack: error.stack,
                input,
                memoryUsage
            });
            return;
        }

        const logLevel = this.shouldLogSlowQuery(duration || 0) ? 'warn' : 'debug';
        const message = `Procedure ${procedureName} completed`;

        this.logger[logLevel](message, {
            duration,
            input,
            output,
            memoryUsage
        });
    }

    private shouldLogSlowQuery(duration: number): boolean {
        return this.config.logSlowQueries && duration > this.config.slowQueryThreshold;
    }

    /**
     * Create a performance wrapper for a procedure
     */
    wrap<T extends (...args: any[]) => any>(
        procedureName: string,
        fn: T
    ): T {
        if (!this.config.enabled) return fn;

        return ((...args: any[]) => {
            const input = args[0]?.input;
            const metrics = this.start(procedureName, input);

            try {
                const result = fn(...args);

                if (result instanceof Promise) {
                    return result
                        .then(output => {
                            this.end(metrics, output);
                            return output;
                        })
                        .catch(error => {
                            this.end(metrics, undefined, error);
                            throw error;
                        });
                } else {
                    this.end(metrics, result);
                    return result;
                }
            } catch (error) {
                this.end(metrics, undefined, error as Error);
                throw error;
            }
        }) as T;
    }
}

/**
 * Create a performance monitor with default configuration
 */
export function createPerformanceMonitor(
    logger: Logger,
    config: Partial<PerformanceConfig> = {}
): PerformanceMonitor {
    return new PerformanceMonitor(logger, config);
}

/**
 * Performance middleware for tRPC procedures
 */
export function performanceMiddleware(
    logger: Logger,
    config: Partial<PerformanceConfig> = {}
) {
    const monitor = new PerformanceMonitor(logger, config);

    return async (opts: any) => {
        const procedureName = opts.path || 'unknown';
        const input = opts.input;

        const metrics = monitor.start(procedureName, input);

        try {
            const result = await opts.next();
            monitor.end(metrics, result);
            return result;
        } catch (error) {
            monitor.end(metrics, undefined, error as Error);
            throw error;
        }
    };
} 