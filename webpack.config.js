/* eslint @typescript-eslint/no-var-requires: "off" */
const path = require("path");
const nodeExternals = require("webpack-node-externals");
module.exports = {
    mode: "production",
    target: "node",
    entry: ["./src/main.ts"],
    module: {
        rules: [
            {
                test: /\.(j|t)s$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                }
            },
        ],
    },
    resolve: {
        extensions: [".js", ".ts"],
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
    ],
    externals: [nodeExternals()],
};