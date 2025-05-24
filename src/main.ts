import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "body-parser";
import { NestExpressApplication } from "@nestjs/platform-express";
import config from "./utils/config";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(urlencoded({ extended: false }));
  app.use(json());
  app.enableCors();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  );

  console.log(config());

  await app.listen(config().port);
}
bootstrap();
