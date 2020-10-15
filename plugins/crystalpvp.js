const fs = require('fs');
const path = require('path');
var mysql = require('mysql');
const https = require('https');


var pluginFolder = path.join(__dirname, "CrystalPVP");
var configFile = path.join(pluginFolder, "config.json");

module.exports = (onticord) => {
    init(function(err, config) {
        if (err) {
            console.err(err);
        } else {
            //config loaded

            var connection = mysql.createConnection(config.mysql);
            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_teams` (`ID` INT(6) AUTO_INCREMENT NOT NULL, `uuid` VARCHAR(36) NOT NULL, `team_name` TEXT NOT NULL, `team_rank` TEXT NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    console.error(err);
                } else {
                    log("Successfully ran query for MySQL cpvp_teams database");
                }
            });
            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_kills` (`ID` INT(6) AUTO_INCREMENT NOT NULL, `killer_uuid` VARCHAR(36) NOT NULL, `victim_uuid` VARCHAR(36) NOT NULL, `weapon` TEXT NOT NULL, `timestamp` bigint(16) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    console.error(err);
                } else {
                    log("Successfully ran query for MySQL cpvp_kills database");
                }
            });

            onticord.on('serverPacket', (meta, data, client, cancelDefault) => {
                if (meta.name == "chat") {
                    var chat = JSON.parse(JSON.stringify(data.message));
                    chat = JSON.parse(chat); // double parse, fix this
                    if (chat.extra && chat.extra[0] && chat.extra[0].extra) {
                        var deathMessage = chat.extra[0].extra;
                        /*
                        console.log("extra0", deathMessage[0]);
                        console.log("extra1", deathMessage[1]);
                        console.log("extra2", deathMessage[2]);
                        console.log("extra3", deathMessage[3]);
                        */
                        if (deathMessage[3].text.substring(1, 20) == "with an End Crystal") {
                            var victim;
                            var killer;
                            var weapon;
                            //handle crystal kills
                            weapon = "End Crystal";
                            if (deathMessage[2]) {
                                if (deathMessage[2].extra[0].text) {
                                    victim = deathMessage[2].extra[0].text
                                }
                            }
                            if (deathMessage[1].text) {
                                killer = deathMessage[1].text.slice(0, -8);
                            }
                            if (config.plan_support == true) {
                                if (client.username == victim) { //prevents logging the kill n number of times where n is the total players connected
                                    console.log(killer_uuid, victim_uuid);
                                    logDeath(killer, victim, weapon, connection);
                                }
                            }
                        }
                    }

                }
            })

            onticord.on('clientPacket', (meta, data, client, cancelDefault) => {
                if (meta.name === 'chat') {
                    if (data.message.indexOf('/') !== 0) return
                    const segments = data.message.split(' ')
                    if (segments[0] === '/arena') {
                        if (segments[1]) {
                            if (config.arenas[segments[1]]) {
                                onticord.sendClient(client, onticord.servers[config.arenas[segments[1]]].host, onticord.servers[config.arenas[segments[1]]].port)
                                client.currentServer = config.arenas[segments[1]];
                                client.currentArena = segments[1];
                            } else {
                                announce("Could not find that arena.", client);
                            }
                        } else {
                            if (client.currentArena) {
                                console.log(client.currentArena);
                                announce("You are currently connected to arena "+client.currentArena, client);
                            } else {
                                announce("Usage: /arena {number}", client);
                            }
                            
                        }
                        cancelDefault()
                    } else if (segments[0] === '/leave') {
                        if (client.currentServer !== "lobby") {
                            onticord.sendClient(client, config[config.lobby].host, onticord.servers[config.lobby].port)
                            client.currentServer = config.lobby;
                            client.currentArena = undefined;
                        } else {
                            announce("You're already in the lobby.", client)
                        }
                        cancelDefault();
                    } else if (segments[0] === '/team') {
                        if (segments[1] === "create") {
                            cancelDefault();
                        } else if (segments[1] === "disband"){
                            
                            cancelDefault();
                        }else if (segments[1] === "accept"){

                            cancelDefault();
                        } else if (segments[1] === "leave"){

                            cancelDefault();
                        } else {
                            client.write('chat', {
                                'message': JSON.stringify({
                                    'text': '',
                                    'extra': [
                                        {
                                            'text': 'CrystalPVP Teams Help\n',
                                            'color': 'yellow'
                                        },
                                        {
                                            'text': `/team create: `,
                                            'color': 'blue'
                                        },
                                        {
                                            'text': `Creates a team with the supplied team name\n`,
                                            'color': 'white'
                                        },
                                        {
                                            'text': `/team disband: `,
                                            'color': 'blue'
                                        },
                                        {
                                            'text': `Disbands your current team (owner only)\n`,
                                            'color': 'white'
                                        },
                                        {
                                            'text': `/team accept: `,
                                            'color': 'blue'
                                        },
                                        {
                                            'text': `Accepts a pending invite from the supplied team name\n`,
                                            'color': 'white'
                                        },
                                        {
                                            'text': `/team leave: `,
                                            'color': 'blue'
                                        },
                                        {
                                            'text': `Leaves your current team\n`,
                                            'color': 'white'
                                        },
                                    ]
                                })
                            })
                            cancelDefault();
                        }
                        
                    }
                }
            })

        }
    })
}
var defaults = {
    "mysql": {
        "host": "mysql.ip.here",
        "port": 3306,
        "user": "",
        "password": "",
        "database": ""
    },
    "plan_support": false,
    "lobby": "lobby",
    "arenas": {
        1: "arena1",
        2: "arena2"
    }
}

function log(message) {
    console.log(`[CrystalPVP] ${message}`);
}

function createConfig(callback) {
    if (!fs.existsSync(configFile)) {
        log("Creating configuration file...");
        fs.writeFile(configFile, JSON.stringify(defaults), function(err) {
            if (err) {
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
    if (!fs.existsSync(pluginFolder)) {
        log("Creating config folder...")
        fs.mkdir(pluginFolder, {
            recursive: true
        }, (err) => {
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

function getUUID(username, callback) {
    https.get('https://api.mojang.com/users/profiles/minecraft/'+username, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            callback(null, JSON.parse(data).id);
            
        });
    }).on("error", (err) => {
        callback(err);
    });
}

function uuidDashes(uuid) {
    return uuid.slice(0,8)+"-"+uuid.slice(8,12)+"-"+uuid.slice(12,16)+"-"+uuid.slice(16,20)+"-"+uuid.slice(20,32)
}
function logDeath(killer, victim, weapon, database) {
    var timestamp = Date.now();
   log(`${killer} killed ${victim} using ${weapon}`)

    getUUID(killer, function(err, uuid) {
        if (err) {
            console.err(err);
        } else {
            var killer_uuid = uuidDashes(uuid)
            getUUID(victim, function(err, uuid) {
                if (err) {
                    console.err(err);
                } else {
                    var victim_uuid = uuidDashes(uuid)

                    //log death
                    console.log(killer, killer_uuid);
                    console.log(victim, victim_uuid);                    
                    database.query(`INSERT INTO cpvp_kills (killer_uuid, victim_uuid, weapon, timestamp) VALUES ("${killer_uuid}", "${victim_uuid}", "${weapon}", "${timestamp}")`, function(err, result) {
                        if (err) {
                            console.error(err);
                        } else {
                            log(`Logged kill for ${killer} on ${victim} using ${weapon} at ${timestamp}`);
                        }
                    })
                    
                }
            })
        }
    })

}
function createTeam(name, owner, database) {

}
function disbandTeam(name, database) {
    
}
function acceptInvite(name, database) {

}
function leaveTeam(name, database) {

}
function startDuel(name, opponent, database) {

}
function acceptDuel(name, opponent, database) {

}