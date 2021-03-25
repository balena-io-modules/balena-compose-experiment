const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
	entry: './src/index.ts',
	target: 'node',
	mode: 'production',
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							transpileOnly: true,
							configFile: 'tsconfig.cli.json',
						},
					},
				],
			},
		],
	},
	resolve: {
		extensions: ['.ts'],
	},
	output: {
		filename: 'compose.js',
		path: path.resolve(__dirname, 'bin'),
	},
	externals: [nodeExternals()],
};
