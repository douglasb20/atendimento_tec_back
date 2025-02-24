import { QueryStorageService } from 'query-storage/query-storage.service';
import { Logger } from 'typeorm';

export class CustomSqlLogger implements Logger {
  constructor(private readonly queryStorage: QueryStorageService) {}

  logQuery(query: string, parameters?: any) {
    if (!parameters) {
      return;
    }

    // Garante que parameters seja um array, mesmo quando só há um valor
    const paramsArray = Array.isArray(parameters) ? parameters : [parameters];

    // Substitui cada "?" pelo respectivo valor do array
    let formattedQuery = query;
    paramsArray.forEach((param) => {
      const value = typeof param === 'string' ? `'${param}'` : param;
      formattedQuery = formattedQuery.replace('?', value);
    });
    this.queryStorage.addQuery(formattedQuery);
  }

  logQueryError(error: string, query: string, parameters?: any[]) {}

  logQuerySlow(time: number, query: string, parameters?: any[]) {}

  logSchemaBuild(message: string) {}

  logMigration(message: string) {}

  log(level: 'log' | 'info' | 'warn', message: any) {}
}
