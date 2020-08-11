const path = require('path')
const fs = require('fs')

const configLocation = path.join(__dirname, 'servers.config.json')
var config = JSON.parse(fs.readFileSync(configLocation))

module.exports = (onticord) => {
	onticord.core.on('login', (client) => {
		onticord.sendClient(client, config.servers[config.defaultServer].host, config.servers[config.defaultServer].port)
		client.currentServer = config.defaultServer
	})

	onticord.on('clientPacket', (meta, data, client, cancelDefault) => {
		if (meta.name === 'chat') {
			if (data.message.indexOf('/') !== 0) return
			
			const segments = data.message.split(' ')

			if (segments[0] === '/server') {
				if (segments[1]) {
					if (config.servers.hasOwnProperty(segments[1])) {
						if (config.servers[segments[1]].restricted == true) {
							client.write('chat', {
								'message': JSON.stringify({
									'text': '',
									'extra': [{'text': 'Lost Lands', 'color': 'dark_aqua'}, {'text': ' > ', 'color': 'dark_gray'}, {'text': 'You do not have access to that server.', 'color': 'gray'}]
								})
							})
						}
						else if (client.currentServer == segments[1]) {
							client.write('chat', {
								'message': JSON.stringify({
									'text': '',
									'extra': [{'text': 'Lost Lands', 'color': 'dark_aqua'}, {'text': ' > ', 'color': 'dark_gray'}, {'text': 'You are currently connected to that server.', 'color': 'gray'}]
								})
							})
						}
						else {
							client.write('chat', {
								'message': JSON.stringify({
									'text': '',
									'extra': [{'text': 'Lost Lands', 'color': 'dark_aqua'}, {'text': ' > ', 'color': 'dark_gray'}, {'text': 'Transferring to server ', 'color': 'gray'}, {'text': segments[1], 'color': 'blue'}, {'text': '.', 'color': 'gray'}]
								})
							})
	
							client.currentServer = segments[1]
	
							onticord.sendClient(client, config.servers[segments[1]].host, config.servers[segments[1]].port)
						}
						
					}
					else {
						client.write('chat', {
							'message': JSON.stringify({
								'text': '',
								'extra': [{'text': 'Lost Lands', 'color': 'dark_aqua'}, {'text': ' > ', 'color': 'dark_gray'}, {'text': 'That server doesn\'t exist.', 'color': 'gray'}]
							})
						})
					}
				}
				else {
					client.write('chat', {
						'message': JSON.stringify({
							'text': '',
							'extra': [{'text': 'Lost Lands', 'color': 'dark_aqua'}, {'text': ' > ', 'color': 'dark_gray'}, {'text': 'You\'re currently on ', 'color': 'gray'}, {'text': client.currentServer, 'color': 'blue'}, {'text': '.', 'color': 'gray'}]
						})
					})
				}

				cancelDefault()
			}
		}
	})
}

console.log("[Server Selector] Plugin loaded.")