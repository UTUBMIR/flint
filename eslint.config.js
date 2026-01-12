import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["*/*.{js,ts,mjs,cjs,ts,mts,cts}"], plugins: { js }, languageOptions: {
            globals: globals.browser,
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
        ],
    },
    {
        rules: {
            "semi": ["error", "always"],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "caughtErrors": "all",
                    "caughtErrorsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "ignoreRestSiblings": true
                }
            ],
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports",
                    fixStyle: "separate-type-imports",
                    disallowTypeAnnotations: false
                }
            ],
            "@typescript-eslint/explicit-member-accessibility": "error"
        }
    }
]);