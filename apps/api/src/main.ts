import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { initSentry } from "./common/sentry";

async function bootstrap() {
  initSentry();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("webUrl"),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get<number>("port")!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API démarrée sur http://localhost:${port}`);
}

bootstrap();
