/**
 * Configuração do Jest.
 *
 * ⚠️ **Por que o transformador é o SWC, e não o `ts-jest`:** o NestJS 12
 * publica `@nestjs/common`, `core` e `testing` como ESM puro
 * (`"type": "module"`). O projeto compila para CommonJS - é assim que roda em
 * produção, e isso não muda -, então o Jest em CJS não conseguia carregar
 * esses pacotes: toda suíte que importasse `@nestjs/testing` morria em
 * `SyntaxError: Unexpected token 'export'` antes do primeiro teste. Eram 20 de
 * 21 suítes do projeto.
 *
 * Rodar o Jest em modo ESM resolvia isso mas criava outro: `bullmq` passava a
 * ser resolvido pelo **fonte** TypeScript dentro de node_modules. O SWC evita
 * os dois lados - transpila TS e os pacotes ESM para CJS, e o Jest segue em
 * CommonJS, igual à produção.
 *
 * O `tsconfig.json` do projeto permanece intocado.
 */
export default {
  rootDir: './src/',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleDirectories: ['node_modules', 'src'],
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true },
          // Os decorators do NestJS (`@Injectable`, `@Column`...) dependem dos
          // metadados de tipo que o `emitDecoratorMetadata` gera.
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  // Os pacotes ESM precisam passar pelo transformador; o padrão do Jest é
  // ignorar node_modules inteiro.
  transformIgnorePatterns: ['/node_modules/(?!(@nestjs|uuid)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};
