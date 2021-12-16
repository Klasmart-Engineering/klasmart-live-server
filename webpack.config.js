/* eslint @typescript-eslint/no-var-requires: "off" */
const path = require(`path`);
const nodeExternals = require(`webpack-node-externals`);

module.exports = {
    mode: `development`,
    target: `node`,
    entry: [ `./src/main.ts` ],
    devtool: `source-map`,
    module: {
        rules: [
            {
                test: /\.(j|t)s$/,
                exclude: /node_modules/,
                use: {
                    loader: `ts-loader`,
                },
            },
        ],
    },
    resolve: {
        extensions: [
            `.js`,
            `.jsx`,
            `.tsx`,
            `.ts`,
        ],
    },
    output: {
        filename: `index.js`,
        path: path.resolve(__dirname, `dist`),
    },
    externals: [ nodeExternals() ],
};
