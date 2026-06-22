import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

const databaseUrl =
  process.env.TYPEORM_DATABASE_URL ?? process.env.DATABASE_URL;
const sslMode = process.env.DB_SSL;

const ssl =
  sslMode === 'true'
    ? { rejectUnauthorized: false }
    : sslMode === 'false'
      ? false
      : databaseUrl
        ? { rejectUnauthorized: false }
        : false;

const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'password',
        database:
          process.env.TYPEORM_DB_NAME ?? process.env.DB_NAME ?? 'smarthr_db',
      }),
  ssl,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: ['error', 'warn'],
});

export default AppDataSource;
