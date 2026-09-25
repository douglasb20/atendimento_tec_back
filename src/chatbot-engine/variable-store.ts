/**
 * As variáveis coletadas durante uma execução, navegáveis por dot-path (ex.:
 * `api_1.data.status`). Cada handler grava sob a própria chave de saída
 * (`message_1`, `data_3`, `api_1`...) - a convenção de nomear é decidida por
 * quem monta o grafo (o `node.id` vira o prefixo), não pelo handler.
 */
export class VariableStore {
  constructor(private readonly variables: Record<string, unknown>) {}

  get(path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (atual, chave) => (atual && typeof atual === 'object' ? (atual as any)[chave] : undefined),
        this.variables,
      );
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  /** Grava sob uma chave de topo (o `node.id` do nó que produziu o valor). */
  set(key: string, value: unknown): void {
    this.variables[key] = value;
  }

  /** Substitui `{{ chave.caminho }}` por seus valores; ausência vira string vazia. */
  interpolate(texto: string): string {
    return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, caminho) => {
      const valor = this.get(caminho);
      return valor === undefined || valor === null ? '' : String(valor);
    });
  }

  toJSON(): Record<string, unknown> {
    return this.variables;
  }
}
