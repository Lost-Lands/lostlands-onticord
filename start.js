const path = require('path')

console.log('[Onticord] Starting...')

const OnticordServer = require(path.join(__dirname, 'OnticordServer.js'))

const config = require(path.join(__dirname, 'config.js'))

const server = new OnticordServer(config)

require(path.join(__dirname, 'plugin.js'))(server)

console.log('[Onticord] Running.')