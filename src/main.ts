import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  await app.listen(port);
  console.log(`Application running at: http://localhost:${port}`);
  console.log(`Swagger documentation at: http://localhost:${port}/api`);
}

bootstrap().catch((error: unknown) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
