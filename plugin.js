const path = require('path')
const fs = require('fs')
const config = require("./config");

module.exports = (onticordServer) => {
	const pluginsLocation = path.join(__dirname, 'plugins')

	let plugins

	try {
		plugins = fs.readdirSync(pluginsLocation)
	}
	catch (err) {
		fs.mkdirSync(pluginsLocation)
		plugins = []
	}

	plugins = plugins.filter((fileName) => fileName.toLowerCase().endsWith('.js'))
	

	plugins.forEach(plugin => {
		var name = plugin.slice(0, -3)
		if (config.ignored_plugins.filter(plugin => plugin == name).length > 0) {
			return;
		}
		console.log(`Loading Plugin "${name}"`);
		require(path.join(pluginsLocation, plugin))(onticordServer)
	})
}