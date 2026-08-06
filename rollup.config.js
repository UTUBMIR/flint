import esbuild from "rollup-plugin-esbuild";
import dts from "rollup-plugin-dts";

export default [

    // DTS build
    {
        input: "node_modules/planck/dist/planck.d.ts",

        output: {
            file: "packages/engine/src/public/libs/planck.d.ts",
            format: "es",

            generatedCode: {
                preset: "es2015",
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
        input: "node_modules/planck/dist/planck.mjs",

        output: {
            file: "packages/engine/src/public/libs/planck.js",
            format: "es",

            generatedCode: {
                preset: "es2015",
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