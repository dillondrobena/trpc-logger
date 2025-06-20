# trpc-logger

A comprehensive tRPC extension that adds advanced logging capabilities to procedures with flexible pipeline system, performance monitoring, middleware support, and enterprise-grade features.

> **Note:** This package is only compatible with tRPC v11.

## Features

- 🚀 **Flexible Pipeline System** - Configure multiple logging pipelines with different levels and transports
- 📊 **Performance Monitoring** - Track procedure execution times, memory usage, and slow query detection
- 🔧 **Middleware Support** - Automatic request/response logging, error handling, rate limiting, and authentication logging
- ✅ **Configuration Validation** - Runtime validation of pipeline configurations with detailed error messages
- 🌐 **Multiple Transports** - Console, file, HTTP, Winston, Pino, Sentry, Datadog, CloudWatch, Elasticsearch, Redis
- 🛡️ **Enterprise Features** - Sensitive data masking, audit logging, comprehensive error handling
- 📝 **Built-in Formats** - Timestamp and JSON formatting with custom format support
- 🧪 **Comprehensive Testing** - Unit and integration tests with full coverage

## Installation

```bash
npm install trpc-logger
```

## Quick Start

### Basic Setup

```typescript
import { loggedProcedure, type Logger } from 'trpc-logger';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<{ logger?: Logger }>().create();

// Configure your logging pipelines
const loggerConfig = {
  pipelines: [
    {
      name: 'console',
      level: 'info' as const,
      transport: (name: string | undefined, message: string, meta?: Record<string, any>) => {
        console.log(message, meta);
      }
    }
  ],
  defaultLevel: 'info' as const
};

// Create your logged procedure
const procedure = loggedProcedure(t.procedure, loggerConfig);

// Use the procedure with logging
const myProcedure = procedure
  .withLogger('myProcedure')
  .input(z.object({ name: z.string() }))
  .query(async ({ input, ctx }) => {
    ctx.logger.info('Processing request', { input });
    return { message: `Hello ${input.name}!` };
  });
```

### Using Built-in Formats and Transports

```typescript
import { 
  loggedProcedure, 
  timestampFormat, 
  jsonFormat, 
  consoleTransport, 
  fileTransport,
  type Logger 
} from 'trpc-logger';
import { initTRPC } from '@trpc/server';

const t = initTRPC.context<{ logger?: Logger }>().create();

const config = {
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
    }
  ]
};

const procedure = loggedProcedure(t.procedure, config);
```

## Advanced Features

### Performance Monitoring

```typescript
import { createPerformanceMonitor, type Logger } from 'trpc-logger';

const performanceConfig = {
  enabled: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000, // 1 second
  logMemoryUsage: true,
  logInputOutput: false
};

const monitor = createPerformanceMonitor(logger, performanceConfig);

// In your procedure
const metrics = monitor.start('user.procedure', input);
try {
  const result = await someOperation();
  monitor.end(metrics, result);
  return result;
} catch (error) {
  monitor.end(metrics, undefined, error);
  throw error;
}
```

### Middleware Support

```typescript
import { 
  createLoggingMiddleware,
  createErrorHandlingMiddleware,
  createRateLimitingMiddleware,
  createPerformanceMiddleware,
  createComprehensiveMiddleware,
  type Logger 
} from 'trpc-logger';

// Create individual middleware
const loggingMiddleware = createLoggingMiddleware({
  logRequests: true,
  logResponses: true,
  logErrors: true,
  maskSensitiveFields: ['password', 'token']
});

const errorHandlingMiddleware = createErrorHandlingMiddleware({
  logAllErrors: true,
  includeStack: false
});

const rateLimitMiddleware = createRateLimitingMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100
});

const performanceMiddleware = createPerformanceMiddleware({
  enabled: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000
});

// Use with your procedure
const myProcedure = publicProcedure
  .withLogger('myProcedure')
  .use(loggingMiddleware)
  .use(errorHandlingMiddleware)
  .use(rateLimitMiddleware)
  .use(performanceMiddleware)
  .input(z.object({ name: z.string() }))
  .query(async ({ input, ctx }) => {
    ctx.logger.info('Processing request', { input });
    return { message: `Hello ${input.name}!` };
  });
```

### Comprehensive Middleware

```typescript
// Or use the comprehensive middleware for all features
const comprehensiveMiddleware = createComprehensiveMiddleware({
  logging: {
    logRequests: true,
    logResponses: true,
    logErrors: true,
    maskSensitiveFields: ['password', 'token']
  },
  errorHandling: {
    logAllErrors: true,
    logValidationErrors: true,
    logAuthErrors: true,
    includeStack: false
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    keyGenerator: (opts) => opts.ctx?.userId || 'anonymous'
  },
  performance: {
    enabled: true,
    logSlowQueries: true,
    slowQueryThreshold: 1000,
    logMemoryUsage: true
  },
  authLogging: true
});

// Apply comprehensive middleware
const myProcedure = publicProcedure
  .withLogger('myProcedure')
  .use(comprehensiveMiddleware)
  .input(z.object({ name: z.string() }))
  .query(async ({ input, ctx }) => {
    ctx.logger.info('Processing request', { input });
    return { message: `Hello ${input.name}!` };
  });
```

### Custom tRPC Middleware

You can also create custom tRPC middleware that integrates with the logging system:

```typescript
import { t } from './trpc'; // Your tRPC instance

const customLoggingMiddleware = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  
  // Ensure logger exists in context
  if (!ctx.logger) {
    throw new Error('Logger not found in context');
  }

  // Log request start
  ctx.logger.info('Request started', {
    procedure: opts.path,
    requestId: ctx.requestId,
    userId: ctx.userId
  });

  const startTime = Date.now();

  try {
    // Call next middleware/procedure
    const result = await next();

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

// Use custom middleware
const myProcedure = publicProcedure
  .withLogger('myProcedure')
  .use(customLoggingMiddleware)
  .input(z.object({ name: z.string() }))
  .query(async ({ input, ctx }) => {
    ctx.logger.info('Processing request', { input });
    return { message: `Hello ${input.name}!` };
  });
```

### Configuration Validation

```typescript
import { validatePipelineConfig, createValidatedPipelineConfig } from 'trpc-logger';

// Validate configuration
const validation = validatePipelineConfig(config);
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
}

// Or use validated configuration (throws on invalid config)
const validatedConfig = createValidatedPipelineConfig(config);
const procedure = loggedProcedure(t.procedure, validatedConfig);
```

### Enterprise Transports

```typescript
import { 
  winstonTransport,
  pinoTransport,
  httpTransport,
  sentryTransport,
  datadogTransport,
  cloudWatchTransport,
  elasticsearchTransport,
  redisTransport
} from 'trpc-logger';

const config = {
  pipelines: [
    // Winston integration
    {
      name: 'winston',
      level: 'info' as const,
      transport: winstonTransport(winstonLogger)
    },
    // HTTP transport to external service
    {
      name: 'external-api',
      level: 'error' as const,
      transport: httpTransport('https://logs.company.com/api/logs', {
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000
      })
    },
    // Sentry for error tracking
    {
      name: 'sentry',
      level: 'error' as const,
      transport: sentryTransport(sentry)
    },
    // CloudWatch for AWS monitoring
    {
      name: 'cloudwatch',
      level: 'info' as const,
      transport: cloudWatchTransport(cloudWatchLogs, 'log-group', 'log-stream')
    }
  ]
};
```

## API Reference

### Core Functions

#### `loggedProcedure(base, config)`

Creates a logged procedure with the specified pipeline configurations.

**Parameters:**
- `base`: A tRPC `ProcedureBuilder` instance
- `config`: A `PipelineConfig` object with pipeline definitions

**Returns:** An `ExtendedProcedureBuilder` with a `withLogger` method

#### `withLogger(name)`

Adds a logger to the procedure context.

**Parameters:**
- `name`: A string identifier for the procedure

**Returns:** A new procedure builder with the logger in the context

### Performance Monitoring

#### `createPerformanceMonitor(logger, config)`

Creates a performance monitor for tracking procedure execution.

**Parameters:**
- `logger`: Logger instance
- `config`: Performance configuration options

#### `createPerformanceMiddleware(config)`

Creates middleware for automatic performance monitoring.

**Parameters:**
- `config`: Optional configuration object for performance monitoring

**Returns:** A tRPC middleware function that uses the logger from context

### Middleware

#### `createLoggingMiddleware(config)`

Creates middleware for automatic request/response logging.

**Parameters:**
- `config`: Optional configuration object for logging behavior

**Returns:** A tRPC middleware function that uses the logger from context

#### `createErrorHandlingMiddleware(config)`

Creates middleware for comprehensive error handling and logging.

**Parameters:**
- `config`: Optional configuration object for error handling behavior

**Returns:** A tRPC middleware function that uses the logger from context

#### `createRateLimitingMiddleware(config)`

Creates middleware for rate limiting with logging.

**Parameters:**
- `config`: Configuration object with rate limiting settings

**Returns:** A tRPC middleware function that uses the logger from context

#### `createAuthLoggingMiddleware()`

Creates middleware for authentication logging.

**Returns:** A tRPC middleware function that uses the logger from context

#### `createPerformanceMiddleware(config)`

Creates middleware for performance monitoring.

**Parameters:**
- `config`: Optional configuration object for performance monitoring

**Returns:** A tRPC middleware function that uses the logger from context

#### `createComprehensiveMiddleware(config)`

Creates a comprehensive middleware that combines logging, error handling, rate limiting, and performance monitoring.

**Parameters:**
- `config`: Configuration object with all middleware settings

**Returns:** A tRPC middleware function that uses the logger from context

#### `combineMiddlewares(...middlewares)`

Combines multiple middleware functions into a single middleware chain.

**Parameters:**
- `...middlewares`: Array of tRPC middleware functions

**Returns:** A single tRPC middleware function

### Validation

#### `validatePipelineConfig(config)`

Validates pipeline configuration and returns validation results.

#### `createValidatedPipelineConfig(config)`

Creates a validated pipeline configuration (throws on invalid config).

### Built-in Formats

- `timestampFormat`: Adds timestamp to log messages
- `jsonFormat`: Formats messages as JSON

### Built-in Transports

#### Basic Transports
- `consoleTransport`: Logs to console
- `fileTransport(filename)`: Logs to a file
- `jsonTransport`: Logs JSON to console

#### Enterprise Transports
- `winstonTransport(winstonLogger)`: Winston integration
- `pinoTransport(pinoLogger)`: Pino integration
- `httpTransport(url, options)`: HTTP transport to external services
- `sentryTransport(sentry)`: Sentry error tracking
- `datadogTransport(datadogLogger)`: Datadog integration
- `cloudWatchTransport(cloudWatchLogs, logGroup, logStream)`: AWS CloudWatch
- `elasticsearchTransport(client, index)`: Elasticsearch integration
- `redisTransport(redisClient, key, ttl)`: Redis log aggregation

## Types

### `Logger`

```typescript
interface Logger {
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
}
```

### `LoggerPipeline`

```typescript
interface LoggerPipeline {
  name: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  format?: (name: string | undefined, message: string, meta?: Record<string, any>) => string;
  transport: (name: string | undefined, message: string, meta?: Record<string, any>) => void;
}
```

### `PipelineConfig`

```typescript
interface PipelineConfig {
  pipelines: LoggerPipeline[];
  defaultLevel?: 'error' | 'warn' | 'info' | 'debug';
}
```

### `PerformanceConfig`

```typescript
interface PerformanceConfig {
  enabled: boolean;
  logSlowQueries: boolean;
  slowQueryThreshold: number;
  logMemoryUsage: boolean;
  logInputOutput: boolean;
}
```

## Examples

See the `examples/` directory for comprehensive examples:

- `basic-usage.ts` - Basic setup and usage
- `advanced-usage.ts` - Advanced features and multiple pipelines
- `enterprise-usage.ts` - Enterprise-level implementation with all features
- `middleware-usage.ts` - Complete middleware integration examples

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 