import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CreateUsersTable1704379411392 } from 'migrations/1704379411392-CreateUsersTable';
import { CreateClientsTable1725885677231 } from 'migrations/1725885677231-CreateClientsTable';
import { CreateContactsTable1725896694498 } from 'migrations/1725896694498-CreateContactsTable';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [],
  synchronize: false,
};

export const dataSource = new DataSource({
  ...dataSourceOptions,
  synchronize: false,
  migrations: [
    CreateUsersTable1704379411392,
    CreateClientsTable1725885677231,
    CreateContactsTable1725896694498,
  ],
});
