export const consoleTransport = (name: string | undefined, message: string, meta?: Record<string, any>) => {
    console.log(message, meta);
};

export const fileTransport = (filename: string) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    const fs = require('fs');
    fs.appendFileSync(filename, message + '\n');
};

export const jsonTransport = (name: string | undefined, message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), name, message, meta }));
};

// Winston transport
export const winstonTransport = (winstonLogger: any) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    winstonLogger.log({
        level: 'info',
        message,
        procedure: name,
        ...meta
    });
};

// Pino transport
export const pinoTransport = (pinoLogger: any) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    pinoLogger.info({
        message,
        procedure: name,
        ...meta
    });
};

// HTTP transport for external services
export const httpTransport = (url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
} = {}) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    const { method = 'POST', headers = {}, timeout = 5000 } = options;

    const payload = {
        timestamp: new Date().toISOString(),
        procedure: name,
        message,
        meta
    };

    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout)
    }).catch(error => {
        console.error('HTTP transport error:', error);
    });
};

// Sentry transport
export const sentryTransport = (sentry: any) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    sentry.captureMessage(message, {
        level: 'info',
        tags: {
            procedure: name
        },
        extra: meta
    });
};

// Datadog transport
export const datadogTransport = (datadogLogger: any) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    datadogLogger.info(message, {
        procedure: name,
        ...meta
    });
};

// CloudWatch transport
export const cloudWatchTransport = (cloudWatchLogs: any, logGroupName: string, logStreamName: string) =>
    (name: string | undefined, message: string, meta?: Record<string, any>) => {
        const params = {
            logGroupName,
            logStreamName,
            logEvents: [{
                timestamp: Date.now(),
                message: JSON.stringify({
                    procedure: name,
                    message,
                    meta
                })
            }]
        };

        cloudWatchLogs.putLogEvents(params).catch((error: any) => {
            console.error('CloudWatch transport error:', error);
        });
    };

// Elasticsearch transport
export const elasticsearchTransport = (client: any, index: string) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    const document = {
        timestamp: new Date().toISOString(),
        procedure: name,
        message,
        meta
    };

    client.index({
        index,
        body: document
    }).catch((error: any) => {
        console.error('Elasticsearch transport error:', error);
    });
};

// Redis transport for log aggregation
export const redisTransport = (redisClient: any, key: string, ttl?: number) => (name: string | undefined, message: string, meta?: Record<string, any>) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        procedure: name,
        message,
        meta
    };

    redisClient.lpush(key, JSON.stringify(logEntry));
    if (ttl) {
        redisClient.expire(key, ttl);
    }
}; 