import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettierConfig from 'eslint-config-prettier/flat'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import a11y from 'eslint-plugin-jsx-a11y'
import reactRefresh from 'eslint-plugin-react-refresh'
import security from 'eslint-plugin-security'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  security.configs.recommended,
  globalIgnores([
    'node_modules/',
    '.next/',
    'out/',
    'build/',
    'dist/',
    'server/dist/',
    'public/',
    '*.config.js',
    'next.config.js',
    '.env*',
    'next-env.d.ts',
    'server/**/*.d.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
      prettier: eslintPluginPrettier,
    },
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'warn',

      ...a11y.configs.recommended.rules,
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/interactive-supports-focus': 'warn',

      'react/jsx-no-useless-fragment': 'error',
      'react/self-closing-comp': 'error',

      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      eqeqeq: ['error', 'always'],

      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            [
              '^react',
              '^@?\\w',
              '@assets/',
              '@test/',
              '@configs/',
              '@services/',
              '@routes/',
              '@api/',
              '@store/',
              '@contexts/',
              '@hooks/',
              '@types/',
              '@interfaces/',
              '@i18n/',
              '@constants/',
              '@helpers/',
              '@linkedDataSchema/',
              '@utils/',
              '@components/',
              '@styles/',
              '^\\.',
              '^\\.\\.',
              '\\.css',
            ],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  {
    // Repo tooling: the gate runner walks `src/`, the PostToolUse hook lints the one file
    // the harness just wrote. Every path is derived from the repo root or from the hook
    // payload, which is validated against the root before use — there is no user input
    // and no request in either. `detect-non-literal-fs-filename` is aimed at traversal
    // from untrusted input, so here it only fires on the whole point of the file.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', '*.config.{ts,mts}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Fixtures deliberately build partial entities and cast at the call site; the
      // alternative is reproducing whole object graphs for a two-field assertion.
      '@typescript-eslint/no-explicit-any': 'off',
      // Test doubles routinely pass shapes narrower than the real type.
      'security/detect-object-injection': 'off',
    },
  },
  {
    // A named export declared inline is *preferred*, not mandated. A default export lets
    // each import site pick its own name for the symbol, so the codebase stops being
    // greppable and a rename never propagates; a trailing `export { Foo }` splits the
    // declaration from the fact that it is public.
    //
    // Hence `warn`, not `error`: where a framework or tool resolves a module by its
    // default binding, that default is a contract and must stay. The `ignores` list and
    // the `files` scope carve out the ones this repo has — Next.js route modules,
    // ambient `.d.ts`, and the root config files (`next.config.ts`, `postcss.config.mjs`,
    // `playwright.config.ts`, this file), which `files` never matches. Add to `ignores`
    // rather than reaching for an inline disable if another such contract appears.
    files: ['src/**/*.{ts,tsx}', 'server/src/**/*.ts', 'tests/**/*.{ts,tsx}'],
    ignores: [
      '**/*.d.ts',
      '**/*.config.{ts,mts,mjs,js}',
      'src/app/**/{page,layout,loading,error,global-error,not-found,template,default}.{ts,tsx}',
      'src/app/**/{icon,apple-icon,opengraph-image,twitter-image,manifest,sitemap,robots}.{ts,tsx}',
      // next-intl resolves the per-request config by its default binding, the same
      // contract as a Next.js route module. See src/i18n/request.ts.
      'src/i18n/request.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Prefer a named export declared inline (`export const Foo = …`). Keep the default only where a framework or tool requires it — a Next.js route module, a config file, an ambient .d.ts — and add the path to the `ignores` list in eslint.config.mjs.',
        },
        {
          selector: 'ExportNamedDeclaration[source=null][declaration=null]',
          message:
            'Prefer declaring the export inline (`export const Foo = …`) over a trailing `export { Foo }`. Re-exporting from another module (`export { Foo } from "./Foo"`) is fine.',
        },
      ],
    },
  },
  {
    files: [
      '**/app/**/page.{ts,tsx}',
      '**/app/**/layout.{ts,tsx}',
      '**/app/**/loading.{ts,tsx}',
      '**/app/**/error.{ts,tsx}',
      '**/app/**/not-found.{ts,tsx}',
    ],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'metadata',
            'generateMetadata',
            'generateStaticParams',
            'viewport',
            'generateViewport',
            'dynamic',
            'revalidate',
          ],
        },
      ],
    },
  },
])

export default eslintConfig
