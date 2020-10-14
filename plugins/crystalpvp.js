const fs = require('fs');
const path = require('path')

var pluginFolder = path.join(__dirname, "CrystalPVP");
var configFile = path.join(pluginFolder, "config.json");


function log(message) {
    console.log(`[CrystalPVP] ${message}`);
}

var defaults = {
    "lobby": "lobby",
    "arenas": {
        1: "arena1",
        2: "arena2"
    }
}

function createConfig(callback) {
    if (!fs.existsSync(configFile)) {
        log("Creating configuration file...");
        fs.writeFile(configFile, JSON.stringify(defaults), function(err) {
            if(err) {
                callback(err);
            }
            log("Created configuration file");
            callback(null, true);
        });
    } else {
        callback(null, true);
    }
}
function loadConfig(callback) {
    fs.readFile(configFile, 'utf8', (err, data) => {

        if (err) {
            callback(err);
        } else {
            callback(null, JSON.parse(data));
        }
    });
}

function init(callback) {
    if(!fs.existsSync(pluginFolder)){
        log("Creating config folder...")
        fs.mkdir(pluginFolder, { recursive: true }, (err) => { 
            if (err) { 
                callback(err); 
            } 
            log("Created config folder");
            createConfig(function(err, response) {
                if (err) {
                    callback(err);
                } else {
                    //load config 
                    loadConfig(function(err, config) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, config);
                        }
                    })
                }
                
            })
        }); 
    
    } else {
        createConfig(function(err, response) {
            if (err) {
                callback(err);
            } else {
                loadConfig(function(err, config) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, config);
                    }
                })
            }
        })
    }
}

function announce(msg, client) {
    if (client) {
        client.write('chat', {
            'message': JSON.stringify({
                'text': '',
                'extra': [{
                        'text': '[',
                        'color': 'gray'
                    },
                    {
                        'text': 'CrystalPVP',
                        'color': 'yellow'
                    },
                    {
                        'text': '] ',
                        'color': 'gray'
                    },
                    {
                        'text': msg,
                        'color': 'white'
                    }
                ]
            })
        })
    }
}


module.exports = (onticord) => {
    init(function(err, config) {
        if (err) {
            console.err(err);
        } else {
            //config loaded
            onticord.on('clientPacket', (meta, data, client, cancelDefault) => {
                if (meta.name === 'chat') {
                    if (data.message.indexOf('/') !== 0) return
                    const segments = data.message.split(' ')
                    if (segments[0] === '/arena') {
                        if (segments[1]) {
                            if (config.arenas[segments[1]]) {
                                onticord.sendClient(client, onticord.servers[config.arenas[segments[1]]].host, onticord.servers[config.arenas[segments[1]]].port)
					            client.currentServer = config.arenas[segments[1]];
                            }
                        }
                        else {
                            
                        }
                    cancelDefault()
                    } else if (segments[0] === '/leave') {
                        console.log(client.currentServer);
                        if (client.currentServer !== "lobby") {
                            onticord.sendClient(client, config[config.lobby].host, onticord.servers[config.lobby].port)
					        client.currentServer = config.lobby;
                        } else {
                            announce("You're already in the lobby.", client)
                        }
                        cancelDefault();
                    }
                }
            })

        }
    })
}