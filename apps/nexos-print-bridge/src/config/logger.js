import winston from 'winston';
import path from 'path';
const logFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.splat(), winston.format.json());
export const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    defaultMeta: { service: 'nexos-print-bridge' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            dirname: path.join(process.cwd(), 'logs')
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            dirname: path.join(process.cwd(), 'logs')
        })
    ]
});
