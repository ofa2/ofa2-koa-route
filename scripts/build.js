/* eslint-disable import/no-extraneous-dependencies */

const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const json = require('rollup-plugin-json');
const { dependencies } = require('../package.json');

const external = Object.keys(dependencies);

const cjsConfig = {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.cjs.js',
    format: 'cjs',
    sourcemap: true,
  },
  plugins: [
    json(),
    resolve(),
    babel({
      exclude: 'node_modules/**', // only transpile our source code
    }),
  ],
  external,
};

const esConfig = {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.esm.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    json(),
    resolve(),
    babel({
      exclude: 'node_modules/**', // only transpile our source code
    }),
  ],
  external,
};

async function build(config) {
  // create a bundle
  const bundle = await rollup.rollup(config);
  // or write the bundle to disk
  await bundle.write(config.output);
}

Promise.all([build(cjsConfig), build(esConfig)]).catch((e) => {
  // eslint-disable-next-line no-console
  console.warn(e);
});
