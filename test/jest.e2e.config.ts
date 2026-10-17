export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  rootDir: './src/',
  // SWC, não `ts-jest` - mesmo motivo do jest.config.mjs unitário: o NestJS
  // publica `@nestjs/common`/`core`/`testing` como ESM puro, e este spec
  // importa `AppModule` inteiro via `@nestjs/testing`.
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@nestjs|uuid)/)'],
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
