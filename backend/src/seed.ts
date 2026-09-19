import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SeedService } from './modules/seed/seed.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const seedService = app.get(SeedService);
    await seedService.seedAll();
    Logger.log('Seed run completed', 'Seed');
  } finally {
    await app.close();
  }
}

void run();