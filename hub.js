var mc = require("minecraft-protocol");
hub = mc.createServer({ // Create "hub" server
    'online-mode': false,
    encryption: true,
    host: 'localhost',
    port: '25566',
    version: '1.12.2',
    'max-players': maxPlayers = 1
});
hub.on('login', (proxyClient) => { // handle login
    proxyClient.write('login', {
        entityId: proxyClient.id,
        levelType: 'default',
        gameMode: 0,
        dimension: 0,
        difficulty: 2,
        maxPlayers: proxyClient.maxPlayers,
        reducedDebugInfo: false
    });
    proxyClient.write('position', {
        x: 0,
        y: 1.62,
        z: 0,
        yaw: 0,
        pitch: 0,
        flags: 0x00
    });

    proxyClient.on('packet', (data, meta) => {
        console.log('client<-server:',
        meta.name + ' :' +
        JSON.stringify(data))
    });
});
module.exports = {
    hub: hub
}