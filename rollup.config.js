import dts from "rollup-plugin-dts";

export default {
  input: "node_modules/planck-js/dist/planck.mjs",
  output: {
    file: "src/flint/public/libs/planck.d.ts",
    format: "es"
  },
  plugins: [dts()],
};