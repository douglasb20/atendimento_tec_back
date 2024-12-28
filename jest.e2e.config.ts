export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  rootDir: './src/',
  transform: {
    '^.*\\.(t|j)s$' : 'ts-jest',
  },
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
  //   prefix: '<rootDir>/src/', // Certifique-se de que o prefixo esteja correto com base na sua estrutura de pastas
  // })
}