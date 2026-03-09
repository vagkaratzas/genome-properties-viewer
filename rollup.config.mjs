import nodeResolve from "@rollup/plugin-node-resolve";

export default {
  onwarn(message) {
    if (message.code === "CIRCULAR_DEPENDENCY") {
      return;
    }
    // eslint-disable-next-line no-console
    console.error(message);
  },
  input: "index.js",
  output: {
    file: "bin/d3.custom.min.js",
    format: "iife",
    sourcemap: true,
    name: "gpv",
  },
  plugins: [nodeResolve()],
};
