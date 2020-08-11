/*

Lost Lands -> 2b2t queue plugin

This plugin allows the ability to join 2b2t's queue while playing on Lost Lands.

This plugin is based on the project 2bored2wait created by 'themoonisacheese' - https://github.com/themoonisacheese/2bored2wait

*/

const path = require('path')
const fs = require('fs')
const mc = require('minecraft-protocol');

const configLocation = path.join(__dirname, 'servers.config.json')
var config = JSON.parse(fs.readFileSync(configLocation))

announce = function(msg, client) {
    if (client) {
        client.write('chat', {
            'message': JSON.stringify({
                'text': '',
                'extra': [
                    {'text': '[', 'color': 'gray'}, 
                    {'text': 'Lost Lands -> 2b2t', 'color': 'yellow'}, 
                    {'text': '] ', 'color': 'gray'}, 
                    {'text': msg, 'color': 'white'}
                ]
            })
        })
    }
}



let players = new Map()
let proxyClient;
let server;



//Lost Lands -> 2b2t server
server = mc.createServer({
    'online-mode': false,
    encryption: true,
    host: config.servers['2b2t'].host,
    port: config.servers['2b2t'].port,
    'version': false,
    'max-players': maxPlayers = 100
});

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } 
    while (currentDate - date < milliseconds);
}


module.exports = (onticord) => {
    
	onticord.on('clientPacket', (meta, data, client, cancelDefault) => {
		if (meta.name === 'chat') {
			if (data.message.indexOf('/') !== 0) return
			
			const segments = data.message.split(' ')

			if (segments[0] === '/queue') {
				if (segments[1] && segments[2]) {
                    var user = segments[1];
                    var password = segments[2];                    
                    player = mc.createClient({ // connect to 2b2t
                        host: "2b2t.org",
                        port: 25565,
                        username: user,
                        password: password,
                        version: client.version
                    });
                    // --> Catch error for signin here <--
                    announce("Attempting to join the 2b2t queue", client);
                    var countMessage = 20;
                    let joined = false;
                    let failed = false;
                    if (failed == false) {
                        player.on("packet", (data, meta) => { // each time 2b2t sends a packet
                            if (data.username) {
                                player.username = data.username;
                                if (player.username !== client.username) {
                                    announce(`The username you attempted to login does not match the username of the account you are currently on. Leaving the 2b2t queue.`, client);
                                    failed = true;
                                    player.write(0xff, {reason: "client.disconnect"}); //disconnect the player
                                }
                            }
                            if (proxyClient) { //if user is logged into 2b2t, send packets
                                filterPacketAndSend(data, meta, proxyClient);
                            }
    
                            if (meta.name === "playerlist_header") { // if the packet contains the player list, we can use it to see our place in the queue
                                let headermessage = JSON.parse(data.header);
                                if (headermessage.text.split("\n")[5]) {
                                    let positioninqueue = headermessage.text.split("\n")[5].substring(25);
                                    let ETA = headermessage.text.split("\n")[6].substring(27);
                       
                                    if (positioninqueue !== "None") { //wait until 2b2t's header message has actual position and estimated time values
                                        if (countMessage == 20) {
                                            countMessage = 0
                                            announce(`Position in queue: ${positioninqueue}, ETA: ${ETA}`, client);
                                        }
    
                                        countMessage++
                                    }
                                    else if (positioninqueue == "None") {
                                        if (countMessage == 20) {
                                            countMessage = 0
                                            announce(`Waiting for 2b2t...`, client);
                                        }
                                    }
                                    else if (positioninqueue === '5' || positioninqueue === '4' || positioninqueue === '3' || positioninqueue === '2' || positioninqueue === '1') {
                                        if (joined === false) {
                                            console.log("Sending "+player.username+" to 2b2t!");
                                            onticord.sendClient(client, config.servers['2b2t'].host, config.servers['2b2t'].port);
                                            client.currentServer = '2b2t';
                                            announce(`Welcome to 2b2t! You are now in the 2b2t queue server and will join shortly.`, client);
                                            //give enough time for the player to fully join
                                            joined = true;
                                        }
                                    }
                                    else {
                                        announce(`An unknown error occured. You have been removed from the 2b2t queue.`, client);
                                        player.write(0xff, {reason: "client.disconnect"});
                                    }
                                }
                                else if (headermessage.text == "\n§7§o§l2BUILDERS§r\n§7§o§l2TOOLS     §r\n") {
                                    announce(`There's currently no 2b2t queue. Please join through the official 2b2t IP, 2b2t.org`, client);
                                    player.write(0xff, {reason: "client.disconnect"});
                                }                            
                            }
                            if(meta.name=="login"){
                                playerId=data.entityId;
                                announce('Successfully entered the 2b2t queue', client);
                            }
                        });
                        player.on("player_info", function(data, meta) {
    
                            //We know we can access playerId once player_info is sent
                            if (data.data[0].name) { //filter out unnecessary player info
                                player.entityID = playerId
                                players.set(player.username, player);
                                
                            }
                            
                        })
                        // set up actions in case we get disconnected.
                        player.on('end', (err) => {
                            if (proxyClient) {
                                proxyClient.end("Connection reset server: "+err);
                                proxyClient = null
                                announce(`Connection reset by 2b2t server.`, client);
                            }
                            // setTimeout(startQueuing, 100); // reconnect after 100 ms
                        });
                        
                        player.on('error', (err) => {
                            if (proxyClient) {
                                proxyClient.end(`Connection error by 2b2t server.\n Error message: ${err}`);
                                proxyClient = null
                                announce(`Connection error by 2b2t server. Error message: ${err}`, client);
                            }
                            console.log('err', err);
                            // setTimeout(startQueuing, 100); // reconnect after 100 ms
                        });
                        client.on('end', () => { //Remove person from 2b2t if they leave the game.
                            player.write(0xff, {reason: "client.disconnect"}); //Disconnect the player from 2b2t
                            console.log("Removed player from 2b2t");
                        })     
                    }
                               
                } else {
					announce("Usage: /queue {username} {password}", client);
				}

				cancelDefault()
            }
        }
        
	});
}

server.on('login', (newProxyClient) => { // handle login

    var player = players.get(newProxyClient.username)

    newProxyClient.write('login', {
        entityId: player.entityID,
        levelType: 'flat',
        gameMode: 0,
        dimension: 1,
        difficulty: 0,
        maxPlayers: server.maxPlayers,
        reducedDebugInfo: false
    });
    newProxyClient.on('packet', (data, meta) => { // redirect everything we do to 2b2t
        filterPacketAndSend(data, meta, player);
    });

    proxyClient = newProxyClient;
});


function filterPacketAndSend(data, meta, dest) {
	if (meta.name !="keep_alive" && meta.name !="update_time") { 
        //keep alive packets are handled by the client we created, so if we were to forward them, the minecraft client would respond too and the server would kick us for responding twice.
		dest.write(meta.name, data);
    }
}

console.log("[2b2t -> Lost Lands] Plugin loaded.");