import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * Um nó/edge do grafo, **como classe real** (não o `type` de
 * `chatbot-flow-versions.entity.ts`) - é o que dá ao `class-transformer` um
 * alvo de verdade para `@Type(() => ...)`.
 *
 * ⚠️ Duas armadilhas encontradas aqui, ambas do `ValidationPipe` global
 * (`transform: true` + `whitelist: true`):
 *
 * 1. Sem `@Type(() => Classe)`, `transform: true` decide o tipo de cada item
 *    do array só pelo `design:type` do TypeScript, que para `nodes:
 *    ChatbotFlowNode[]` é `Array` (interfaces/`type` não existem em runtime).
 *    Cada item do grafo virava uma instância de `Array` com
 *    `id`/`type`/`position`/`data` como propriedades nomeadas -
 *    `JSON.stringify` de um array só serializa índices numéricos, e o grafo
 *    inteiro ia para o banco como `[[], []]`.
 * 2. Corrigido o `@Type()`, o `whitelist: true` passou a remover todo campo
 *    **sem decorator de validação próprio** - declarar o campo na classe não
 *    basta. Sem isso, cada nó ia para o banco como `{}`. Por isso todo campo
 *    abaixo tem um `@Is*` explícito, mesmo os mais óbvios.
 */
export class ChatbotFlowNodePositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class ChatbotFlowNodeDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @ValidateNested()
  @Type(() => ChatbotFlowNodePositionDto)
  position: ChatbotFlowNodePositionDto;

  @IsObject()
  data: Record<string, unknown>;
}

export class ChatbotFlowEdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  sourceHandle: string | null;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  targetHandle: string | null;
}

export class ChatbotFlowViewportDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  zoom: number;
}

/**
 * O grafo inteiro, substituído de uma vez - não há edição parcial de nó por
 * SQL; "Salvar" no editor sempre manda tudo.
 */
export class SaveFlowDto {
  @IsArray({ message: 'Informe os nós como lista' })
  @ValidateNested({ each: true })
  @Type(() => ChatbotFlowNodeDto)
  nodes: ChatbotFlowNodeDto[];

  @IsArray({ message: 'Informe as ligações como lista' })
  @ValidateNested({ each: true })
  @Type(() => ChatbotFlowEdgeDto)
  edges: ChatbotFlowEdgeDto[];

  /** Posição/zoom do canvas no momento do "Salvar" - ausente em chamadas
   * antigas (`.http` manual, por exemplo), por isso opcional. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatbotFlowViewportDto)
  viewport?: ChatbotFlowViewportDto;
}
