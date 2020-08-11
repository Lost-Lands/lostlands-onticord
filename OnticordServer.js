const EventEmitter = require('events')
const path = require('path')
const fs = require('fs')

const mc = require('minecraft-protocol')
const ccf = require(path.join(__dirname, 'utility', 'colorCodeFormat.js'))

module.exports = class OnticordServer extends EventEmitter {
	constructor(config) {
		super()

		this.beforePing = (res, client, reply) => {
			let pingRes = {
				'description': ccf(config.motd),
				'version': {
					'name': 'Lost Lands Proxy',
					'protocol': client.version
				},
				'players': {
					'max': config.maxPlayers,
					'online': this.core.playerCount
				}
			}

			if (this.hasOwnProperty('favicon')) pingRes.favicon = this.favicon

			reply(null, pingRes)
		}

		this.core = new mc.createServer({
			'port': config.port,
			'host': config.host,
			'online-mode': config.onlineMode,
			'beforePing': this.beforePing,
			'version': false,
			'keepAlive': false,
			'maxPlayers': config.maxPlayers
		})

		this.core.on('login', (client) => {
            console.log('[+] ' + client.username + ' (' + client.uuid + ') (' + client.socket.remoteAddress + ')')
            
            client.write('chat', {
                'message': JSON.stringify({
                    'text': '',
                    'extra': [{'text': 'Welcome to Lost Lands!\n', 'color': 'yellow'}, {'text': 'Please login or register to continue.', 'color': 'light_gray'}]
                })
            })

			client.on('end', () => {
				console.log('[-] ' + client.username + ' (' + client.uuid + ')')
			})
		})

		this.config = config

		const faviconLocation = path.join(__dirname, config.icon)

		if (fs.existsSync(faviconLocation)) this.favicon = fs.readFileSync(faviconLocation).toString('base64')
	}

	sendClient(client, host, port) {
		let resetClient = false

		if (client.hasOwnProperty('fakeClient')) {
			resetClient = true
			for (let x = -12; x < 12; x++) {
				for (let z = -12; z < 12; z++) {
					client.write('unload_chunk', {
						'chunkX': x,
						'chunkZ': z
					})
				}
			}

			client.fakeClient.removeAllListeners()
			client.removeAllListeners('packet')

			client.fakeClient.end('You have been disconnected.')

			delete client.fakeClient
		}

		client.fakeClient = mc.createClient({
			host,
			port,
			'username': client.username,
			'keepAlive': false,
			'version': client.version
		})

		if (this.config.bungeeForward) {
			let fakeClientHost = '\x00' + client.socket.remoteAddress + '\x00' + client.uuid
			if (client.hasOwnProperty('profile') && client.profile.hasOwnProperty('properties')) {
				fakeClientHost += '\x00' + JSON.stringify(client.profile.properties)
			}
			client.fakeClient.tagHost = fakeClientHost
		}

		client.fakeClient.uuid = client.uuid

		if (resetClient) {
			client.fakeClient.once('login', (data) => {
				client.write('respawn', {
					'dimension': 1,
					'difficulty': data.difficulty,
					'gamemode': 1, //data.gameMode
					'levelType': data.levelType
				})

				client.fakeClient.once('packet', () => {
					client.write('respawn', {
						'dimension': data.dimension === 1 ? 0 : 1,
						'difficulty': data.difficulty,
						'gamemode': 1,
						'levelType': data.levelType
					})

					client.write('respawn', {
						'dimension': data.dimension,
						'difficulty': data.difficulty,
						'gamemode': 1,
						'levelType': data.levelType
					})
				})
			})
		}

		client.fakeClient.on('error', (err) => {
			console.error('Connection error: ' + err)
			client.end(ccf('&cAn error occured while trying to connect you.'))
		})

		client.fakeClient.on('packet', (data, meta) => {
			let allowPacket = true
			const cancelMethod = () => {
				allowPacket = false
			}

			this.emit('serverPacket', meta, data, client.fakeClient, cancelMethod)

			if (meta.state === mc.states.PLAY && client.fakeClient.state === mc.states.PLAY && allowPacket) client.write(meta.name, data)
		})

		client.on('packet', (data, meta) => {
			let allowPacket = true
			const cancelMethod = () => {
				allowPacket = false
			}

			this.emit('clientPacket', meta, data, client, cancelMethod)

			if (meta.state === mc.states.PLAY && client.fakeClient.state === mc.states.PLAY && allowPacket) client.fakeClient.write(meta.name, data)
		})

		client.fakeClient.on('end', (reason) => {
			client.end(reason || ccf('&cYou have been disconnected.'))
		})

		client.on('end', () => {
			client.fakeClient.end()
		})
	}
}