const EventEmitter = require('events')
const path = require('path')
const fs = require('fs')

const mc = require('minecraft-protocol')

const ccf = require(path.join(__dirname, 'utility', 'colorCodeFormat.js'))

var whitelist = JSON.parse(fs.readFileSync(path.join(__dirname, "whitelist.json")));


module.exports = class OnticordServer extends EventEmitter {
	constructor(config) {

		if (config.whitelist == true) {
			console.log("[Onticord] Whitelist Enabled");
		}

		super()

		this.servers = require('./servers.json');

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


		console.log("Starting Onticord on "+config.listen.host+":"+config.listen.port)

		this.core = new mc.createServer({
			'port': config.listen.port,
			'host': config.listen.host,
			'online-mode': config.onlineMode,
			'beforePing': this.beforePing,
			'version': false,
			'keepAlive': false,
			'maxPlayers': config.maxPlayers
		})

		this.players = new Map();

		this.players.getByUUID = function(uuid, players) {
			var username = [...players].find(([key, player]) => player.uuid === uuid);
			if (username) {
				return players.get(username[0]);
			}
		}

		this.core.on('login', (client) => {
			//add player to map on login

			if (this.config.bungeeForward) {
				if (client.serverHost) { //checks if player is coming from a bungeecord server
					var serverHost = client.serverHost.split('\u0000');
					if (serverHost[2]) {
						var uuid = serverHost[2];
						client.uuid = uuid.slice(0, 8) + "-" + uuid.slice(8, 12) + "-" + uuid.slice(12, 16) + "-" + uuid.slice(16, 20) + "-" + uuid.slice(20, 32)
					}
				}
			}

			this.players.set(client.username, client);

			if (config.whitelist == true) {
				if (whitelist.uuid.indexOf(client.uuid) > -1){
					//User is whitelisted.
					console.log('[INFO] '+client.username + ' (' + client.uuid + ') is whitelisted.')
					console.log('[+] ' + client.username + ' (' + client.uuid + ') (' + client.socket.remoteAddress + ')')
				}
				else {
					console.log('[INFO] '+client.username + ' (' + client.uuid + ') attempted to join but is not whitelisted.')
					client.end(ccf("&cYou are not whitelisted."))
				}
			}
			else {
				console.log('[+] ' + client.username + ' (' + client.uuid + ') (' + client.socket.remoteAddress + ')')
			}
			client.on('end', () => {
				//remove player from map on leave
				this.players.delete(client.username); 
				
			});
		});

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

			client.removeAllListeners('packet')
			client.fakeClient.removeAllListeners()
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
					'gamemode': data.gameMode,
					'levelType': data.levelType
				})

				client.fakeClient.once('packet', () => {
					client.write('respawn', {
						'dimension': data.dimension === 1 ? 0 : 1,
						'difficulty': data.difficulty,
						'gamemode': data.gameMode,
						'levelType': data.levelType
					})

					client.write('respawn', {
						'dimension': data.dimension,
						'difficulty': data.difficulty,
						'gamemode': data.gameMode,
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
			if (client.fakeClient) {
				if (meta.state === mc.states.PLAY && client.fakeClient.state === mc.states.PLAY && allowPacket) {
					client.write(meta.name, data)
				}
			}
			
		})

		client.on('packet', (data, meta) => {
			let allowPacket = true
			const cancelMethod = () => {
				allowPacket = false
			}

			this.emit('clientPacket', meta, data, client, cancelMethod)

			if (meta.state === mc.states.PLAY && client.fakeClient.state === mc.states.PLAY && allowPacket) {
				client.fakeClient.write(meta.name, data)
			}
		})

		client.fakeClient.on('end', (reason) => {
			client.end(reason || ccf('&cYou have been disconnected.'))
			client.fakeClient = undefined;
			
		})

		client.on('end', () => {
			console.log('[-] ' + client.username + ' (' + client.uuid + ')')
			if (client.fakeClient) {
				client.fakeClient.end()
			}
		})
	}
}