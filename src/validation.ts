import { z } from 'zod';
import type { LoggerPipeline, PipelineConfig } from './index';

// Validation schemas
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);

const LoggerPipelineSchema = z.object({
    name: z.string().min(1, 'Pipeline name is required'),
    level: LogLevelSchema.optional(),
    format: z.function()
        .args(z.string().optional(), z.string(), z.record(z.any()).optional())
        .returns(z.string())
        .optional(),
    transport: z.function()
        .args(z.string().optional(), z.string(), z.record(z.any()).optional())
        .returns(z.void())
        .describe('Transport function must accept name, message, and optional meta parameters')
});

const PipelineConfigSchema = z.object({
    pipelines: z.array(LoggerPipelineSchema).min(1, 'At least one pipeline is required'),
    defaultLevel: LogLevelSchema.optional()
});

// Performance configuration validation
const PerformanceConfigSchema = z.object({
    enabled: z.boolean().optional(),
    logSlowQueries: z.boolean().optional(),
    slowQueryThreshold: z.number().positive('Slow query threshold must be positive').optional(),
    logMemoryUsage: z.boolean().optional(),
    logInputOutput: z.boolean().optional()
});

// Middleware configuration validation
const MiddlewareConfigSchema = z.object({
    logRequests: z.boolean().optional(),
    logResponses: z.boolean().optional(),
    logErrors: z.boolean().optional(),
    includeHeaders: z.boolean().optional(),
    includeBody: z.boolean().optional(),
    maskSensitiveFields: z.array(z.string()).optional(),
    performanceMonitoring: z.boolean().optional(),
    slowQueryThreshold: z.number().positive().optional()
});

// Rate limiting configuration validation
const RateLimitConfigSchema = z.object({
    windowMs: z.number().positive('Window must be positive'),
    maxRequests: z.number().positive('Max requests must be positive'),
    keyGenerator: z.function()
        .args(z.any())
        .returns(z.string())
        .optional()
});

// Error handling configuration validation
const ErrorHandlingConfigSchema = z.object({
    logAllErrors: z.boolean().optional(),
    logValidationErrors: z.boolean().optional(),
    logAuthErrors: z.boolean().optional(),
    includeStack: z.boolean().optional()
});

export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

/**
 * Validate pipeline configuration
 */
export function validatePipelineConfig(config: any): ValidationResult {
    try {
        PipelineConfigSchema.parse(config);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Validate individual pipeline
 */
export function validatePipeline(pipeline: any): ValidationResult {
    try {
        LoggerPipelineSchema.parse(pipeline);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Validate performance configuration
 */
export function validatePerformanceConfig(config: any): ValidationResult {
    try {
        PerformanceConfigSchema.parse(config);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Validate middleware configuration
 */
export function validateMiddlewareConfig(config: any): ValidationResult {
    try {
        MiddlewareConfigSchema.parse(config);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Validate rate limiting configuration
 */
export function validateRateLimitConfig(config: any): ValidationResult {
    try {
        RateLimitConfigSchema.parse(config);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Validate error handling configuration
 */
export function validateErrorHandlingConfig(config: any): ValidationResult {
    try {
        ErrorHandlingConfigSchema.parse(config);
        return { isValid: true, errors: [] };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: ValidationError[] = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                value: (err as any).received
            }));
            return { isValid: false, errors };
        }
        return { isValid: false, errors: [{ field: 'unknown', message: 'Unknown validation error' }] };
    }
}

/**
 * Test transport function
 */
export function testTransport(transport: any): ValidationResult {
    try {
        // Test if transport is a function
        if (typeof transport !== 'function') {
            return {
                isValid: false,
                errors: [{ field: 'transport', message: 'Transport must be a function', value: transport }]
            };
        }

        // Test transport function signature
        const testName = 'test';
        const testMessage = 'test message';
        const testMeta = { test: true };

        try {
            transport(testName, testMessage, testMeta);
            return { isValid: true, errors: [] };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    field: 'transport',
                    message: `Transport function failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    value: transport
                }]
            };
        }
    } catch (error) {
        return {
            isValid: false,
            errors: [{ field: 'transport', message: 'Invalid transport function', value: transport }]
        };
    }
}

/**
 * Test format function
 */
export function testFormat(format: any): ValidationResult {
    try {
        // Test if format is a function
        if (typeof format !== 'function') {
            return {
                isValid: false,
                errors: [{ field: 'format', message: 'Format must be a function', value: format }]
            };
        }

        // Test format function signature
        const testName = 'test';
        const testMessage = 'test message';
        const testMeta = { test: true };

        try {
            const result = format(testName, testMessage, testMeta);
            if (typeof result !== 'string') {
                return {
                    isValid: false,
                    errors: [{ field: 'format', message: 'Format function must return a string', value: format }]
                };
            }
            return { isValid: true, errors: [] };
        } catch (error) {
            return {
                isValid: false,
                errors: [{
                    field: 'format',
                    message: `Format function failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    value: format
                }]
            };
        }
    } catch (error) {
        return {
            isValid: false,
            errors: [{ field: 'format', message: 'Invalid format function', value: format }]
        };
    }
}

/**
 * Comprehensive validation of pipeline configuration
 */
export function validatePipelineConfigComprehensive(config: any): ValidationResult {
    const basicValidation = validatePipelineConfig(config);
    if (!basicValidation.isValid) {
        return basicValidation;
    }

    const errors: ValidationError[] = [];

    // Validate each pipeline individually
    for (let i = 0; i < config.pipelines.length; i++) {
        const pipeline = config.pipelines[i];
        const pipelineValidation = validatePipeline(pipeline);

        if (!pipelineValidation.isValid) {
            pipelineValidation.errors.forEach(error => {
                errors.push({
                    field: `pipelines[${i}].${error.field}`,
                    message: error.message,
                    value: error.value
                });
            });
        }

        // Test transport function
        if (pipeline.transport) {
            const transportTest = testTransport(pipeline.transport);
            if (!transportTest.isValid) {
                transportTest.errors.forEach(error => {
                    errors.push({
                        field: `pipelines[${i}].${error.field}`,
                        message: error.message,
                        value: error.value
                    });
                });
            }
        }

        // Test format function
        if (pipeline.format) {
            const formatTest = testFormat(pipeline.format);
            if (!formatTest.isValid) {
                formatTest.errors.forEach(error => {
                    errors.push({
                        field: `pipelines[${i}].${error.field}`,
                        message: error.message,
                        value: error.value
                    });
                });
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Create a validated pipeline configuration
 */
export function createValidatedPipelineConfig(config: any): PipelineConfig {
    const validation = validatePipelineConfigComprehensive(config);
    if (!validation.isValid) {
        throw new Error(`Invalid pipeline configuration: ${JSON.stringify(validation.errors, null, 2)}`);
    }
    return config as PipelineConfig;
} 