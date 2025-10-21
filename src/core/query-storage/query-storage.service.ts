import { Injectable } from '@nestjs/common';

@Injectable()
export class QueryStorageService {
  private queries: string[] = [];

  startRequest() {
    this.queries = [];
  }

  addQuery(query: string) {
    this.queries.push(query);
  }

  getQueries(): string[] {
    return this.queries;
  }

  clear() {
    this.queries = []; // Limpa as queries após salvar o log
  }
}
