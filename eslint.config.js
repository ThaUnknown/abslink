import config from 'eslint-config-standard-universal'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...config(),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
