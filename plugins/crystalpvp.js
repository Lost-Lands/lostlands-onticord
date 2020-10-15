const fs = require('fs');
const path = require('path');
var mysql = require('mysql');

var pluginFolder = path.join(__dirname, "CrystalPVP");
var configFile = path.join(pluginFolder, "config.json");


function log(message) {
    console.log(`[CrystalPVP] ${message}`);
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

function logDeath(killer, victim, weapon) {
    console.log(`${killer} killed ${victim} using ${weapon}`)
}


module.exports = (onticord) => {
    init(function(err, config) {
        if (err) {
            console.err(err);
        } else {
            //config loaded

            var connection = mysql.createConnection(config.mysql);
            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_teams` (`ID` INT(6) NOT NULL, `uuid` VARCHAR(32) NOT NULL, `team_name` TEXT NOT NULL, `team_rank` TEXT NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    console.error(err);
                } else {
                    log("Successfully ran query for MySQL cpvp_teams database");
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
                                logDeath(victim, killer, weapon);
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
                            }
                        } else {

                        }
                        cancelDefault()
                    } else if (segments[0] === '/leave') {
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