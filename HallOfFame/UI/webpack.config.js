// File originally by Colossal Order.
// Changes made:
// - Auto code reformat.
// - Change css-loader to ignore resolving static game images (Media/...) and
//   leave them as-is (`options.url.filter`).
// - Change css-loader to add "hof-" prefix to CSS modules class names.
//   This can help debugging and other mods to target our classes.
// - Add `optimization.chunkIds`, `output.chunkFilename` and `TerserPlugin.test`
//   to customize chunk names, so they're not loaded as UI mods.

const path = require('path');
const MOD = require('./mod.json');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CSSPresencePlugin } = require('./tools/css-presence');
const TerserPlugin = require('terser-webpack-plugin');
const gray = (text) => `\x1b[90m${text}\x1b[0m`;

const CSII_USERDATAPATH = process.env.CSII_USERDATAPATH;

if (!CSII_USERDATAPATH) {
    throw 'CSII_USERDATAPATH environment variable is not set, ensure the CSII Modding Toolchain is installed correctly';
}

const OUTPUT_DIR = `${CSII_USERDATAPATH}\\Mods\\${MOD.id}`;

const banner = `
 * Cities: Skylines II UI Module
 *
 * Id: ${MOD.id}
 * Author: ${MOD.author}
 * Version: ${MOD.version}
 * Dependencies: ${MOD.dependencies.join(',')}
`;

module.exports = {
    mode: 'production',
    stats: 'none',
    entry: {
        [MOD.id]: './src/index.tsx',
    },
    externalsType: 'window',
    externals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        'cs2/modding': 'cs2/modding',
        'cs2/api': 'cs2/api',
        'cs2/bindings': 'cs2/bindings',
        'cs2/l10n': 'cs2/l10n',
        'cs2/ui': 'cs2/ui',
        'cs2/input': 'cs2/input',
        'cs2/utils': 'cs2/utils',
        'cohtml/cohtml': 'cohtml/cohtml',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.s?css$/,
                include: path.join(__dirname, 'src'),
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            url: {
                                // Avoid requiring intrinsinc assets
                                filter: url => !url.startsWith('Media')
                            },
                            importLoaders: 1,
                            modules: {
                                auto: true,
                                exportLocalsConvention: 'camelCase',
                                localIdentName: 'hof-[local]_[hash:base64:3]',
                            },
                        },
                    },
                    'sass-loader',
                ],
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[name][ext][query]',
                },
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        modules: ['node_modules', path.join(__dirname, 'src')],
        alias: {
            'mod.json': path.resolve(__dirname, 'mod.json'),
        },
    },
    output: {
        path: path.resolve(__dirname, OUTPUT_DIR),
        library: {
            type: 'module',
        },
        publicPath: `coui://ui-mods/`,
        // We use the made-up .chunkmjs extension to avoid the game mod loader
        // from trying to load chunk files as a mods, which would fail.
        chunkFilename: '[name].chunkmjs',
    },
    optimization: {
        chunkIds: 'named',
        minimize: true,
        minimizer: [
            new TerserPlugin({
                test: /\.(chunk)?m?js(\?.*)?$/i,
                extractComments: {
                    banner: () => banner,
                },
            }),
        ],
    },
    experiments: {
        outputModule: true,
    },
    plugins: [
        new MiniCssExtractPlugin(),
        new CSSPresencePlugin(),
        {
            apply(compiler) {
                let runCount = 0;
                compiler.hooks.done.tap('AfterDonePlugin', (stats) => {
                    console.log(stats.toString({ colors: true }));
                    console.log(`\n🔨 ${!runCount++ ? 'Built' : 'Updated'} ${MOD.id}`);
                    console.log('   ' + gray(OUTPUT_DIR) + '\n');
                });
            },
        },
    ],
};
