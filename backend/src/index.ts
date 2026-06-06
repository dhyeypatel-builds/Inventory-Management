import 'dotenv/config'; // loads backend/.env before env.ts validates
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `TyreStock API started`,
  );
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutdown signal received – closing gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server and DB connection closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));
