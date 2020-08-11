const path = require('path')
const fs = require('fs')

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
	
	console.log('Starting ' + plugins.length + ' plugins...')

	plugins.forEach(plugin => {
		require(path.join(pluginsLocation, plugin))(onticordServer)
	})
}