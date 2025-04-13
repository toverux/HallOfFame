// File originally by Colossal Order.
// Changes made:
// - Auto code reformat with Biome, renamed a few variables.
// - Migrated to ESM (require => import, import.meta.dirname => import.meta.dirname, etc).
// - Removed custom CSSPresencePlugin.
// - Change css-loader to ignore resolving static game images (Media/...) and
//   leave them as-is (`options.url.filter`).
// - Change css-loader to add "hof-" prefix to CSS modules class names.
//   This can help debugging and other mods to target our classes.

import * as path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import mod from './mod.json' with { type: 'json' };

const gray = text => `\x1b[90m${text}\x1b[0m`;

const userDataPath = process.env.CSII_USERDATAPATH;

if (!userDataPath) {
  // biome-ignore lint/style/useThrowOnlyError: CLI pattern.
  throw 'CSII_USERDATAPATH environment variable is not set, ensure the CSII Modding Toolchain is installed correctly';
}

const outputDir = `${userDataPath}\\Mods\\${mod.id}`;

const banner = `
 * Cities: Skylines II UI Module
 *
 * Id: ${mod.id}
 * Author: ${mod.author}
 * Version: ${mod.version}
 * Dependencies: ${mod.dependencies.join(',')}
`;

// biome-ignore lint/style/noDefaultExport: per webpack api contract
export default {
  mode: 'production',
  stats: 'none',
  entry: {
    [mod.id]: path.join(import.meta.dirname, 'src/index.tsx')
  },
  externalsType: 'window',
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    'cs2/modding': 'cs2/modding',
    'cs2/api': 'cs2/api',
    'cs2/bindings': 'cs2/bindings',
    'cs2/l10n': 'cs2/l10n',
    'cs2/ui': 'cs2/ui',
    'cs2/input': 'cs2/input',
    'cs2/utils': 'cs2/utils',
    'cohtml/cohtml': 'cohtml/cohtml'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.s?css$/,
        include: path.join(import.meta.dirname, 'src'),
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              url: {
                // Avoid requiring intrinsic assets
                filter: url => !url.startsWith('Media')
              },
              importLoaders: 1,
              modules: {
                auto: true,
                exportLocalsConvention: 'camelCase',
                localIdentName: 'hof-[local]_[hash:base64:3]'
              }
            }
          },
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext][query]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    modules: ['node_modules', path.join(import.meta.dirname, 'src')],
    alias: {
      'mod.json': path.resolve(import.meta.dirname, 'mod.json')
    }
  },
  output: {
    path: path.resolve(import.meta.dirname, outputDir),
    library: {
      type: 'module'
    },
    publicPath: `coui://ui-mods/`
  },
  optimization: {
    chunkIds: 'named',
    minimize: true,
    minimizer: [
      new TerserPlugin({
        test: /\.(chunk)?m?js(\?.*)?$/i,
        extractComments: {
          banner: () => banner
        }
      })
    ]
  },
  experiments: {
    outputModule: true
  },
  plugins: [
    new MiniCssExtractPlugin(),
    {
      apply(compiler) {
        let runCount = 0;
        compiler.hooks.done.tap('AfterDonePlugin', stats => {
          console.info(stats.toString({ colors: true }));
          console.info(`\n🔨 ${runCount++ ? 'Updated' : 'Built'} ${mod.id}`);
          console.info(`   ${gray(outputDir)}\n`);
        });
      }
    }
  ]
};
