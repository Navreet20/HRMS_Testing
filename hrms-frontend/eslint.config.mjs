import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
      // Next 16 eslint-config-next enables React Compiler hooks as errors.
      // This app still uses the Next 15 patterns (sync setState in effects,
      // ref.current during render). Keep those off until they are refactored.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='zIndex'][value.type='Literal']",
          message: "Do not hardcode zIndex. Import Z from src/ui/zIndex.ts.",
        },
        {
          selector:
            "JSXAttribute[name.name='zIndex'] > JSXExpressionContainer > Literal",
          message: "Do not hardcode zIndex. Import Z from src/ui/zIndex.ts.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Jest CJS environment + mock factories must use require() (hoisting / CJS).
  {
    files: ["**/*.cjs", "test/setup.mocks.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
