module.exports = (onticord) => {
    onticord.core.on('login', (client) => {
        onticord.sendClient(client, onticord.servers[onticord.servers.defaultServer].host, onticord.servers[onticord.servers.defaultServer].port)
        client.currentServer = onticord.servers.defaultServer;
    });
}