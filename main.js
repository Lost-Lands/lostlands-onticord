var mc = require("minecraft-protocol");


const states = mc.states

var hub = require("./hub"); //Load the "hub" server

const proxy = mc.createServer({ //Create proxy server for players to join through
    'online-mode': false,
    port: "25565",
    keepAlive: false,
    version: "1.12.2"
})

function joinServer(client, server) {
    console.log(client.username+" requested to join "+server);
    //Connect to specified server 
}

proxy.on('login', function(client) {
    const addr = client.socket.remoteAddress
    const port = client.socket.remotePort
    console.log(`Incoming connection from ${client.username} (${addr}:${port})`)


    let endedClient = false
    let endedTargetClient = false
    client.on('end', function() {
        endedClient = true
        console.log('Connection closed by client', '(' + addr + ')')
        if (!endedTargetClient) {
            targetClient.end('End')
        }
    })
    client.on('error', function(err) {
        endedClient = true
        console.log('Connection error by client', '(' + addr + ')')
        console.log(err.stack)
        if (!endedTargetClient) {
            targetClient.end('Error')
        }
    })
    client.on('join', function(data, neta) {
        /*
        Failed Attempt at forwarding IP: 
        targetClient.write('0x00', client.socket.remoteAddress+":"+client.socket.remotePort+"\00"+client.uuid);
        */
    })


    client.on('packet', function(data, meta) {
        if (targetClient.state === states.PLAY && meta.state === states.PLAY) {
            if (!endedTargetClient) {
                targetClient.write(meta.name, data)
            }
        }
    })

    client.on('raw', function(buffer, meta) {
        if (meta.state !== states.PLAY || targetClient.state !== states.PLAY) {
            return
        }
        const packetData = client.deserializer.parsePacketBuffer(buffer).data.params
        const packetBuff = targetClient.serializer.createPacketBuffer({
            name: meta.name,
            params: packetData
        })
        if (!bufferEqual(buffer, packetBuff)) {
            console.log('client->server: Error in packet ' + meta.state + '.' + meta.name)
            console.log('received buffer', buffer.toString('hex'))
            console.log('produced buffer', packetBuff.toString('hex'))
            console.log('received length', buffer.length)
            console.log('produced length', packetBuff.length)
        }
    })

    client.on('chat', (data, metadata) => {
        let split = data.message.split(' ')
        console.log(split);
        if (split[0] === '/server') {
          if (typeof split[1] !== 'undefined') {
              joinServer(client, split[1])
          } else {
            const message = '[Error] You must provide a server to switch to'
            client.write('chat', {
                message: JSON.stringify(message),
                position: 0,
                sender: '0'
              })
              
          }
        }
      })
    

    const targetClient = mc.createClient({ //Attempt to connect to local spigot server
        host: "localhost",
        port: "25580", //Change this to port 25566 to connect to "Hub" server
        version: "1.12.2",
        username: client.username, //Pass the client's username
        keepAlive: false
    })

    

    targetClient.on('packet', function(data, meta) {
        if (meta.state === states.PLAY && client.state === states.PLAY) {

            /*
            // LOG OUTGOING PACKETS:

            console.log('client<-server:',
              targetClient.state + '.' + meta.name + ' :' +
              JSON.stringify(data))

            */

            if (!endedClient) {
                client.write(meta.name, data)
                if (meta.name === 'set_compression') {
                    client.compressionThreshold = data.threshold
                } // Set compression
            }
        }
    })
    const bufferEqual = require('buffer-equal')
    targetClient.on('raw', function(buffer, meta) {
        if (client.state !== states.PLAY || meta.state !== states.PLAY) {
            return
        }
        const packetData = targetClient.deserializer.parsePacketBuffer(buffer).data.params
        const packetBuff = client.serializer.createPacketBuffer({
            name: meta.name,
            params: packetData
        })
        if (!bufferEqual(buffer, packetBuff)) {
            console.log('client<-server: Error in packet ' + meta.state + '.' + meta.name)
            console.log('received buffer', buffer.toString('hex'))
            console.log('produced buffer', packetBuff.toString('hex'))
            console.log('received length', buffer.length)
            console.log('produced length', packetBuff.length)
        }
        /* if (client.state === states.PLAY && brokenPackets.indexOf(packetId.value) !=== -1)
         {
         console.log(`client<-server: raw packet);
         console.log(packetData);
         if (!endedClient)
         client.writeRaw(buffer);
         } */
    })

    targetClient.on('end', function() {
        endedTargetClient = true
        console.log('Connection closed by server', '(' + addr + ')')
        if (!endedClient) {
            client.end('End')
        }
    })
    targetClient.on('error', function(err) {
        endedTargetClient = true
        console.log('Connection error by server', '(' + addr + ') ', err)
        console.log(err.stack)
        if (!endedClient) {
            client.end('Error')
        }
    })

})

