import esbuild from "rollup-plugin-esbuild";
import dts from "rollup-plugin-dts";

export default [

    // DTS build
    {
        input: "node_modules/planck-js/dist/planck.d.ts",

        output: {
            file: "src/flint/public/libs/planck.d.ts",
            format: "es",

            generatedCode: {
                preset: "es2024",
                constBindings: true,
                arrowFunctions: true,
                objectShorthand: true
            }
        },

        plugins: [dts()],

        treeshake: {
            moduleSideEffects: false,
            propertyReadSideEffects: false
        }
    },

    // JS build
    {
        input: "node_modules/planck-js/dist/planck.mjs",

        output: {
            file: "src/flint/public/libs/planck.js",
            format: "es",

            generatedCode: {
                preset: "es2024",
                constBindings: true,
                arrowFunctions: true,
                objectShorthand: true
            }
        },

        plugins: [
            esbuild({
                target: "es2024",
                minify: false
            })
        ],

        treeshake: {
            moduleSideEffects: false,
            propertyReadSideEffects: false
        }
    }

];