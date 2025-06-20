export const timestampFormat = (name: string | undefined, message: string, meta?: Record<string, any>) => {
    return `[${new Date().toISOString()}] [${name}] ${message}`;
};

export const jsonFormat = (name: string | undefined, message: string, meta?: Record<string, any>) => {
    return JSON.stringify({ timestamp: new Date().toISOString(), name, message, meta });
}; 