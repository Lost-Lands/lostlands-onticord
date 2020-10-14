const path = require('path')
const fs = require('fs')

const configLocation = path.join(__dirname, 'config.json')

const defaultConfig = {
	'listen': {
		'port': 25565,
		'host': 'localhost'
	},
	'motd': '&aOnticord (Lost Lands version)',
	'maxPlayers': 1000,
	'onlineMode': false,
	'icon': 'icon.png',
	'bungeeForward': true,
	'ignored_plugins': []
}

let config

try {
	config = JSON.parse(fs.readFileSync(configLocation))
}
catch (err) {
	fs.writeFileSync(configLocation, JSON.stringify(defaultConfig, null, '\t'))
	config = defaultConfig
}

module.exports = config
