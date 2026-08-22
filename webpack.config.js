const defaultsDeep = require('lodash.defaultsdeep');
const path = require('path');
const webpack = require('webpack');

// Plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// PostCss
const autoprefixer = require('autoprefixer');
const postcssVars = require('postcss-simple-vars');
const postcssImport = require('postcss-import');

const STATIC_PATH = process.env.STATIC_PATH || '/static';
const APP_NAME = 'Scratch扩展编辑器';

const root = process.env.ROOT || '';
if (root.length > 0 && !root.endsWith('/')) {
    throw new Error('If ROOT is defined, it must have a trailing slash.');
}

const htmlWebpackPluginCommon = {
    root: root,
    meta: JSON.parse(process.env.EXTRA_META || '{}'),
    APP_NAME
};

// When this changes, the path for all JS files will change, bypassing any HTTP caches
const CACHE_EPOCH = 'pentapod';

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.SOURCEMAP || (process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map'),
    devServer: {
        contentBase: path.resolve(__dirname, 'build'),
        host: '0.0.0.0',
        disableHostCheck: true,
        compress: true,
        port: process.env.PORT || 8601,
        // allows ROUTING_STYLE=wildcard to work properly
        historyApiFallback: {
            rewrites: []
        }
    },
    output: {
        library: 'GUI',
        filename: (
            process.env.NODE_ENV === 'production' ? `js/${CACHE_EPOCH}/[name].[contenthash].js` : 'js/[name].js'
        ),
        chunkFilename: (
            process.env.NODE_ENV === 'production' ? `js/${CACHE_EPOCH}/[name].[contenthash].js` : 'js/[name].js'
        ),
        publicPath: root
    },
    resolve: {
        symlinks: false
    },
    module: {
        rules: [{
            test: /\.jsx?$/,
            loader: 'babel-loader',
            include: [
                path.resolve(__dirname, 'src'),
                /node_modules[\\/]scratch-[^\\/]+[\\/]src/,
                /node_modules[\\/]pify/,
                /node_modules[\\/]@vernier[\\/]godirect/
            ],
            options: {
                // Explicitly disable babelrc so we don't catch various config
                // in much lower dependencies.
                babelrc: false,
                plugins: [
                    ['react-intl', {
                        messagesDir: './translations/messages/'
                    }]],
                presets: ['@babel/preset-env', '@babel/preset-react']
            }
        },
        {
            test: /\.css$/,
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: true,
                    importLoaders: 1,
                    localIdentName: '[name]_[local]_[hash:base64:5]',
                    camelCase: true
                }
            }, {
                loader: 'postcss-loader',
                options: {
                    ident: 'postcss',
                    plugins: function () {
                        return [
                            postcssImport,
                            postcssVars,
                            autoprefixer
                        ];
                    }
                }
            }]
        }]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/scratch-blocks/media',
                    to: 'static/blocks-media/default'
                },
                {
                    from: 'node_modules/scratch-blocks/media',
                    to: 'static/blocks-media/high-contrast'
                }
            ]
        })
    ]
};

if (!process.env.CI) {
    base.plugins.push(new webpack.ProgressPlugin());
}

module.exports = [
    // to run editor examples
    defaultsDeep({}, base, {
        entry: {
            'editor': './src/playground/editor.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build')
        },
        module: {
            rules: base.module.rules.concat([
                {
                    test: /\.(svg|png|wav|mp3|gif|jpg|woff2|hex)$/,
                    loader: 'url-loader',
                    options: {
                        limit: 2048,
                        outputPath: 'static/assets/',
                        esModule: false
                    }
                }
            ])
        },
        optimization: {
            splitChunks: {
                chunks: 'all',
                minChunks: 2,
                minSize: 50000,
                maxInitialRequests: 5
            }
        },
        plugins: base.plugins.concat([
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
                'process.env.DEBUG': Boolean(process.env.DEBUG),
                'process.env.ENABLE_SERVICE_WORKER': JSON.stringify(process.env.ENABLE_SERVICE_WORKER || ''),
                'process.env.ROOT': JSON.stringify(root),
                'process.env.ROUTING_STYLE': JSON.stringify(process.env.ROUTING_STYLE || 'filehash'),
                'process.env.ENABLE_WINDCHIMES': JSON.stringify(process.env.ENABLE_WINDCHIMES || '')
            }),
            new HtmlWebpackPlugin({
                chunks: ['editor'],
                template: 'src/playground/index.ejs',
                filename: 'index.html',
                title: 'scratch扩展编辑器',
                isEditor: true,
                ...htmlWebpackPluginCommon
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'static',
                        to: ''
                    }
                ]
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'extensions/**',
                        to: 'static',
                        context: 'src/examples'
                    }
                ]
            })
        ])
    })
];
