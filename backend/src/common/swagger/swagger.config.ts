import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Cadence API')
    .setDescription('OpenAPI documentation for the Cadence backend services.')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Provide the access token obtained from the auth endpoints.',
      },
      'jwt',
    )
    .addServer(process.env.API_BASE_URL ?? 'http://localhost:3000')
    .build();
}
