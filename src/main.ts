import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "body-parser";
import { NestExpressApplication } from "@nestjs/platform-express";
import config from "./utils/config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(urlencoded({ extended: false }));
  app.use(json());
  app.enableCors();
  app.setGlobalPrefix("api");

  console.log(config());

  await app.listen(config().port);
}
bootstrap();
