'use strict';

var { promisify } = require('util');
var fs = require('fs');
var path = require('path');
var makeDir = require('make-dir');

// PostCSS stuff
var postCSS = require('postcss');
var sugarss = require('sugarss');
var colors = require('postcss-color-function');
var npmimport = require('postcss-import');
var resolveId = require("postcss-import/lib/resolve-id")
var vars = require('postcss-css-variables');
var postcssPreset = require('postcss-preset-env');
var postcssNesting = require('postcss-nesting');
var cssnano = require('cssnano');
var autoprefixer = require('autoprefixer');
var postcssHexrgba = require('postcss-hexrgba');
var postcssClearfix = require('postcss-clearfix');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Creates and return a list of postCSS plugins required for the VCL
 * @param {object} [opts] - postCSS plugin options.
 * @param {string} [opts.root=process.cwd()] - base directory
 * @param {boolean} [opts.optimize=false] - optimize css
 * @return Array of postCSS plugins
 */
function createPostCSSPlugins (opts = {}) {
  const root = opts.root || process.cwd();
  let resolve = (id, basedir, importOptions) => {
    if (opts.vclRoot && id.startsWith('@vcl')) {
      return path.resolve(root, opts.vclRoot, id.substr(5), 'index.sss');
    }
    return resolveId(id, basedir, importOptions);
  };

  return [
    npmimport({
      root,
      resolve
    }),
    postcssNesting(),
    vars(), // CSS4 compatible variable suppot
    colors(), // W3C CSS4 Color functios
    postcssPreset(),
    autoprefixer(),
    postcssClearfix(),
    postcssHexrgba()
  ].concat(opts.optimize ? [cssnano()] : []);
}

/**
* Converts a sss string into css
* @param {string} [sss] - sss style
* @param {Object} [opts] - compiler options
* @param {string} [opts.root=process.cwd()] - base directory
* @param {string} [opts.from="vcl.sss"] - source file name
* @param {string} [opts.to="vcl.css"] - target file name
* @param {boolean} [opts.optimize=false] - optimize css
* @param {boolean} [opts.sourceMap=false] - Generate a source map
* @return {Promise} - Converted css
*/
async function compileString(sss, opts = {}) {
  const processor = postCSS(createPostCSSPlugins(opts));
  const result = await processor.process(sss, {
    from: path.resolve(opts.root || process.cwd(), opts.from || 'vcl.sss'),
    to: path.resolve(opts.root || process.cwd(), opts.to || 'vcl.css'),
    map: opts.sourceMap ? {
      inline: true
    } : false,
    parser: sugarss
  });
  return result;
}
/**
* Converts a sss file into a css file
* @param {string} [inputFile] - input file
* @param {string} [outputFile] - output file
* @param {Object} [opts] - compiler options
* @param {string} [opts.root=process.cwd()] - base directory
* @param {boolean} [opts.optimize=false] - optimize css
* @param {boolean|'inline'} [opts.sourceMap=false] - Generate a source map
* @return {Promise} - Converted css
*/
async function compileFile(inputFile, outputFile, opts = {}) {
  if (typeof inputFile !== 'string') {
    throw new Error('Input file required');
  }
  if (typeof outputFile !== 'string') {
    throw new Error('Output file required');
  }

  inputFile = path.resolve(opts.root || process.cwd(), inputFile);
  outputFile = path.resolve(opts.root || process.cwd(), outputFile);
  const outputFolder = path.dirname(outputFile);

  const sss = await readFileAsync(inputFile);

  const processor = postCSS(createPostCSSPlugins(opts));
  const result = await processor.process(sss, {
    from: path.resolve(opts.root || process.cwd(), inputFile),
    to: path.resolve(opts.root || process.cwd(), outputFile),
    map: opts.sourceMap ? {
      inline: opts.sourceMap === 'inline'
    } : false,
    parser: sugarss
  });

  if (!fs.existsSync(outputFolder)) {
    await makeDir(outputFolder);
  }

  await writeFileAsync(outputFile, result.css);
  if (result.map) {
    await writeFileAsync(outputFile + '.map', result.map);
  }
  return {
    ...result,
    outputFile
  };
}

module.exports = compileString;
module.exports.compileFile = compileFile;
module.exports.createPostCSSPlugins = createPostCSSPlugins;
