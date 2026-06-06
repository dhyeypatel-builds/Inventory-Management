import pino from 'pino';
import { env } from './env';

export const logger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    base: { env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  env.NODE_ENV === 'development'
    ? pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,env' },
      })
    : undefined,
);
