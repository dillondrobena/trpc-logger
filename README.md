# trpc-logger

A tRPC extension that adds logging capabilities to procedures with a flexible pipeline system, inspired by Winston.

> **Note:** This package is only compatible with tRPC v11.

## Installation

```bash
npm install trpc-logger
```

## Usage

### Basic Setup

```typescript
import { loggedProcedure } from 'trpc-logger';
import { initTRPC } from '@trpc/server';

const t = initTRPC.context<{ logger?: Logger }>().create();

// Configure your logging pipelines
const loggerConfig = {
  pipelines: [
    {
      name: 'console',
      level: 'info',
      transport: (name, message, meta) => {
        console.log(message, meta);
      }
    },
    {
      name: 'file',
      level: 'debug',
      format: (name, message, meta) => `[${new Date().toISOString()}] ${message}`,
      transport: (name, message, meta) => {
        // Write to file or external service
        myLoggingService.log({ name, message, meta });
      }
    }
  ],
  defaultLevel: 'info'
};

// Create your logged procedure
const procedure = loggedProcedure(t.procedure, loggerConfig);

// Use the procedure with logging
const myProcedure = procedure
  .withLogger('myProcedure')
  .input(z.object({ name: z.string() }))
  .query(async ({ input, ctx }) => {
    // Use level-specific logging methods
    ctx.logger.info('Processing request', { input });
    ctx.logger.debug('Input validation passed');
    
    if (someError) {
      ctx.logger.error('Something went wrong', { error: someError });
    }
    
    return { message: `Hello ${input.name}!` };
  });
```

### Level-Specific Logging

The logger provides four level-specific methods:

- `ctx.logger.error(message, meta?)` - For error messages
- `ctx.logger.warn(message, meta?)` - For warning messages  
- `ctx.logger.info(message, meta?)` - For informational messages
- `ctx.logger.debug(message, meta?)` - For debug messages

Only pipelines configured for the specific level will be called. For example:

```typescript
const config = {
  pipelines: [
    {
      name: 'console',
      level: 'info', // Only receives info, warn, and error logs
      transport: (name, message, meta) => console.log(message)
    },
    {
      name: 'debug-file',
      level: 'debug', // Only receives debug logs
      transport: (name, message, meta) => fs.appendFileSync('debug.log', message)
    }
  ]
};

// In your procedure:
ctx.logger.info('This goes to console'); // Only console pipeline
ctx.logger.debug('This goes to debug file'); // Only debug-file pipeline
```

### Pipeline Configuration

Each pipeline can have the following properties:

- **`name`** (optional): A string identifier for the pipeline
- **`level`** (optional): The log level for this pipeline ('error', 'warn', 'info', 'debug')
- **`format`** (optional): A function to format the log message
- **`transport`** (required): A function that handles the actual logging

### Example Pipeline Configurations

```typescript
// Console logging for info and above
const consolePipeline = {
  name: 'console',
  level: 'info',
  transport: (name, message, meta) => {
    console.log(message, meta);
  }
};

// File logging for debug level
const debugPipeline = {
  name: 'debug-file',
  level: 'debug',
  format: (name, message, meta) => {
    return `[${new Date().toISOString()}] [${name}] ${message}`;
  },
  transport: (name, message, meta) => {
    fs.appendFileSync('debug.log', message + '\n');
  }
};

// Error logging to external service
const errorPipeline = {
  name: 'error-service',
  level: 'error',
  transport: (name, message, meta) => {
    // Send to external logging service
    externalLoggingService.log({
      timestamp: new Date().toISOString(),
      procedure: name,
      message,
      metadata: meta
    });
  }
};
```

## API Reference

### `loggedProcedure(base, config)`

Creates a logged procedure with the specified pipeline configurations.

**Parameters:**
- `base`: A tRPC `ProcedureBuilder` instance
- `config`: A `PipelineConfig` object with pipeline definitions

**Returns:** An `ExtendedProcedureBuilder` with a `withLogger` method

### `withLogger(name)`

Adds a logger to the procedure context.

**Parameters:**
- `name`: A string identifier for the procedure

**Returns:** A new procedure builder with the logger in the context

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

### `ExtendedProcedureBuilder`

An extended version of tRPC's `ProcedureBuilder` that includes the `withLogger` method.

## Compatibility

This package is only compatible with **tRPC v11**. For older versions of tRPC, please use a compatible version of this package.

## License

MIT 