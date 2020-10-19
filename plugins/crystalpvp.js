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
                    throw err;
                } else {
                    log("Successfully ran query for MySQL cpvp_teams database");
                }
            });
            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_kills` (`ID` INT(6) AUTO_INCREMENT NOT NULL, `killer_uuid` VARCHAR(36) NOT NULL, `victim_uuid` VARCHAR(36) NOT NULL, `weapon` TEXT NOT NULL, `timestamp` bigint(16) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    throw err;
                } else {
                    log("Successfully ran query for MySQL cpvp_kills database");
                }
            });

            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_duels` ( `ID` INT(6) NOT NULL AUTO_INCREMENT , `player1` VARCHAR(36) NOT NULL , `player2` VARCHAR(36) NOT NULL , `active` BOOLEAN NOT NULL , `arena` TEXT NOT NULL , `winner` VARCHAR(36) NOT NULL , `timestamp` BIGINT(16) NOT NULL , PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    throw err;
                } else {
                    log("Successfully ran query for MySQL cpvp_duels database");
                }
            });
            connection.query("CREATE TABLE IF NOT EXISTS `cpvp_matches` ( `ID` INT(6) NOT NULL AUTO_INCREMENT , `team1` VARCHAR(36) NOT NULL , `team2` VARCHAR(36) NOT NULL , `active` BOOLEAN NOT NULL , `arena` TEXT NOT NULL , `winner` VARCHAR(36) NOT NULL , `timestamp` BIGINT(16) NOT NULL , PRIMARY KEY (`ID`)) ENGINE = InnoDB;", function(err, result) {
                if (err) {
                    throw err;
                } else {
                    log("Successfully ran query for MySQL cpvp_matches database");
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
                                    logDeath(killer, victim, weapon, connection);
                                    checkKill(killer, victim, connection, config, onticord);
                                }
                            }
                        }
                    }
                }
                if (meta.name == "combat_event") { //handle PVP events
                    if (data.message) {
                        if (data.message.translate == "death.attack.player") {
                            console.log(data.message);
                            var event = JSON.parse(data.message);
                            var victim = event.with[0].text;
                            var killer = event.with[1].text
                            if (client.username == victim) { //prevents logging the kill n number of times where n is the total players connected
                                checkKill(killer, victim, connection, config, onticord);
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
                                announce("You are currently connected to arena " + client.currentArena, client);
                            } else {
                                announce("Usage: /arena {number}", client);
                            }

                        }
                        cancelDefault()
                    } else if (segments[0] === '/leave') {
                        leaveArena(client, config, onticord);
                        cancelDefault();
                    } else if (segments[0] === '/team') {
                        if (segments[1] === "create") {
                            createTeam(segments[2], client.username, connection, client);
                            cancelDefault();
                        } else if (segments[1] === "disband") {

                            cancelDefault();
                        } else if (segments[1] === "accept") {

                            cancelDefault();
                        } else if (segments[1] === "leave") {

                            cancelDefault();
                        } else if (segments[1] === "stats") {
                            if (segments[2]) {
                                //look up specific team
                            }
                            else {
                                //check if the user belongs to a team and get its stats
                            }
                        } else {
                            client.write('chat', {
                                'message': JSON.stringify({
                                    'text': '',
                                    'extra': [{
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
                                        {
                                            'text': `/team stats <team>: `,
                                            'color': 'blue'
                                        },
                                        {
                                            'text': `Look up stats of your or a supplied team\n`,
                                            'color': 'white'
                                        }
                                        
                                    ]
                                })
                            })
                            cancelDefault();
                        }

                    } else if (segments[0] === '/duel') {
                        if (segments[1]) {
                            if (segments[1] == "accept") {
                                if (segments[2]) {
                                    acceptDuel(segments[2], connection, client, config, onticord);
                                } else {
                                    announce("Usage: /duel accept {username}", client);
                                }
                            } else {
                                startDuel(segments[1], connection, client, onticord);
                            }
                        } else {
                            announce("Usage: /duel {username}", client);
                        }
                        cancelDefault();
                    } else if (segments[0] === "/challenge") {
                        if (segments[1]) {

                            if (segments[1] == "accept") {
                                if (segments[2]) {
                                    acceptChallenge(client, segments[2], config, connection, onticord);
                                } else {
                                    announce("Usage: /challenge accept {team}", client);
                                }
                            } else {
                                challenge(client, segments[1], connection, onticord); 
                            }
                        } else {
                            announce("Usage: /challenge {team}", client);
                        }
                        cancelDefault();
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

//Setup maps
var arenas = new Map();
var duels = new Map();

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
                            populateArenas(config.arenas)
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
                        populateArenas(config.arenas)
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
    https.get('https://api.mojang.com/users/profiles/minecraft/' + username, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            if (data.length > 0) {
                callback(null, JSON.parse(data).id);
            }

        });
    }).on("error", (err) => {
        callback(err);
    });
}

function uuidDashes(uuid) {
    return uuid.slice(0, 8) + "-" + uuid.slice(8, 12) + "-" + uuid.slice(12, 16) + "-" + uuid.slice(16, 20) + "-" + uuid.slice(20, 32)
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

function checkKill(killer, victim, database, config, onticord, a = arenas, m = matches) {
    //checks if player was in an event such as a duel or teams

    killer = onticord.players.get(killer);
    victim = onticord.players.get(victim);

    if (killer.event && victim.event && killer.event.type && victim.event.type && killer.event.type === victim.event.type) {
        if (victim.event.type == "duel") {
            //killer wins
            database.query(`UPDATE cpvp_duels SET active=false, winner="${killer.uuid}" WHERE player1 = "${killer.event.host}";`, function(err, result) {
                if (err) {
                    console.error(err);
                    announce(`Failed saving duel stats with ${victim.username}, please report on Discord.`, killer);
                    announce(`Failed saving duel stats with ${killer.username}, please report on Discord.`, victim);
                } else {

                    announce(`You won the duel with ${victim.username}!`, killer);
                    announce(`You lost the duel with ${killer.username}.`, victim);
                    a.set(killer.event.arena, false);
                    log(`Set arena ${killer.event.arena} to open.`)
                    delete killer.event; //remove from event
                    delete victim.event; //remove from event
                    setTimeout(function() {
                        leaveArena(victim, config, onticord);
                        leaveArena(killer, config, onticord);
                    }, 5000);
                }
            })

        } else if (victim.event.type == "match") {
            //handle match kills
            log("Match kill");
            var map = victim.event.map;
            var team = m.get(map);
            if (team) {
                team.delete(victim.uuid);
                if (team.size === 0) {
                    //killer's team wins
                    var match = a.get(victim.event.arena)
                    console.log(match);
                    var challenger = match[0];
                    var opponent = match[1];
                    database.query(`UPDATE cpvp_matches SET active=false, winner="${killer.event.team}" WHERE id = ${killer.event.id};`, function(err, result) {
                        if (err) {
                            console.error(err);
                            challenger.forEach(function(player) {
                                var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                announce(`Failed saving match winner.`, onlinePlayer);
                                setTimeout(function() {
                                    leaveArena(onlinePlayer, config, onticord);
                                }, 5000);
                            })
                            opponent.forEach(function(player) {
                                var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                announce(`Failed saving match winner.`, onlinePlayer);
                                setTimeout(function() {
                                    leaveArena(onlinePlayer, config, onticord);
                                }, 5000);
                            })
                        } else {
                            challenger.forEach(function(player) {
                                var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                announce(`${killer.event.team} has won the match!`, onlinePlayer);
                                setTimeout(function() {
                                    leaveArena(onlinePlayer, config, onticord);
                                }, 5000);
                            })
                            opponent.forEach(function(player) {
                                var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                announce(`${killer.event.team} has won the match!`, onlinePlayer);
                                setTimeout(function() {
                                    leaveArena(onlinePlayer, config, onticord);
                                }, 5000);
                            })
                            //clear map arrays
                            a.set(victim.event.arena, false);
                            m.delete(victim.event.map);
                            m.delete(killer.event.map);
                        }
                    });
                    
                }
            }           

        }
    } else {
        // not in event, disregard
    }

}

//team handling
function createTeam(name, owner, database, client) {
    if (name) {
        if (name.length < 16) {
            getUUID(owner, function(err, uuid) {
                //check if user owns another team
                uuid = uuidDashes(uuid);

                database.query(`SELECT * FROM cpvp_teams WHERE UUID like "${uuid}" AND team_rank LIKE "owner"`, function(err, result) {
                    if (err) {
                        announce("Failed to create team, please report this issue in Discord.", client);
                        console.error(err);
                    } else {
                        if (result.length > 0) {
                            announce("You can only own one team!", client);
                        } else {
                            teamRank(name, "owner", database, function(err, result) {
                                if (err) {
                                    announce("Failed to create team, please report this issue in Discord.", client);
                                    console.error(err);
                                } else {
                                    if (result.length > 0) {
                                        announce("Team already exists", client);
                                    } else {
                                        database.query(`INSERT INTO cpvp_teams (uuid, team_name, team_rank) VALUES ("${uuid}", "${name}", "owner")`, function(err, result) {
                                            if (err) {
                                                announce("Failed to create team, please report this issue in Discord.", client);
                                                console.error(err);
                                            } else {
                                                log(`Created new team with name "${name}" for owner "${owner}"`);
                                                announce("Successfully created team named " + name, client);
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            });
        } else {
            announce("Team names cannot be longer than 16 characters!", client);
        }
    } else {
        announce("Usage: /team create {name}", client);
    }
}


function getTeam(name, database, callback) {
    database.query(`SELECT * FROM cpvp_teams WHERE team_name LIKE "${name}"`, function(err, result) {
        if (err) {
            callback(err);
            console.error(err);
        } else {
            callback(null, result)
        }
    });
}

function getPlayersTeam(uuid, database, callback) {
    database.query(`SELECT * FROM cpvp_teams WHERE uuid = "${uuid}"`, function(err, result) {
        if (err) {
            callback(err);
            console.error(err);
        } else {
            callback(null, result)
        }
    });
}

function isTeamOwner(uuid, database, callback) {
    database.query(`SELECT * FROM cpvp_teams WHERE uuid = "${uuid}" AND team_rank LIKE "owner"`, function(err, result) {
        if (err) {
            callback(err);
            console.error(err);
        } else {
            callback(null, result)
        }
    });
}
function isTeamOfficer(uuid, database, callback) {
    console.log(uuid);
    database.query(`SELECT * FROM cpvp_teams WHERE uuid LIKE "${uuid}" AND team_rank LIKE "owner" OR uuid LIKE "${uuid}" AND team_rank LIKE "officer"`, function(err, result) {
        if (err) {
            callback(err);
            console.error(err);
        } else {
            callback(null, result)
        }
    });
}

function teamRank(name, rank, database, callback) {
    database.query(`SELECT * FROM cpvp_teams WHERE team_name like "${name}" AND team_rank LIKE "${rank}"`, function(err, result) {
        if (err) {
            callback(err);
            console.error(err);
        } else {
            callback(null, result)
        }
    });
}

function teamStats(name, database, client) {

}

function disbandTeam(name, database, client) {

}

function acceptInvite(name, database, client) {

}

function leaveTeam(name, database, client) {

}

//Match handling
var matches = new Map();

function challenge(client, opp, database, onticord) {
    getPlayersTeam(client.uuid, database, function(err, team) {
        if (err){
            console.error(error);
            announce("Error getting your team, please report on Discord.", client);
        } else {
            if (team && team[0] && team[0].team_name) {
                if (team[0].team_name !== opp) {
                    if (team[0].team_rank == "owner" || team[0].team_rank == "officer") {
                        getTeam(opp, database, function(err, opponent) {
                            if (err) {
                                announce("Error getting opposing team, please report on Discord.", client);
                            } else {
                                if (opponent && opponent[0] && opponent[0].team_name) {
                                    getTeam(team[0].team_name, database, function(err, challenger) {
                                        if (err) {
                                            console.error(error);
                                            announce("Error getting your team, please report on Discord.", client);
                                        } else {
                                            console.log(challenger);
                                            if (challenger && challenger[0] && challenger[0].team_name) {
                                                //challenger and opponent variables are set
                                                matches.set(challenger[0].team_name, [challenger, opponent]);
                                                setTimeout(function() {
                                                    if (matches.get(challenger[0].team_name)) {
                                                        matches.delete(challenger[0].team_name);
                                                        challenger.forEach(function(player) {
                                                            onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                                            if (onlinePlayer) {
                                                                //player is online
                                                                announce(`Your team's match request to ${opponent[0].team_name} has expired.`, onlinePlayer);
                                                            }
                                                        });
                                                    };
                                                }, 30000);
                                                console.log(matches);
                                                challenger.forEach(function(player) {
                                                    onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                                    if (onlinePlayer) {
                                                        //player is online
                                                        announce(`Your team has challenged ${opponent[0].team_name}!`, onlinePlayer);
                                                    }
                                                });
                                                opponent.forEach(function(player) {
                                                    onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                                    if (onlinePlayer) {
                                                        //player is online
                                                        if (player.team_rank == "owner" || player.team_rank == "officer") {
                                                            announce(`${challenger[0].team_name} wants to start a match with your team. Type /challenge accept ${challenger[0].team_name}`, onlinePlayer);
                                                        }
                                                    }
                                                });                                        
                                            } else {
                                                announce("Could not find that team.", client);
                                            }
                                        }
                                    })
                                }
                                else {
                                    announce("Could not find that team.", client);
                                }
                                
                            }
                        })
                    }
                    else {
                        announce("You do not have permission to challenge teams", client);
                    }
                } else {
                    announce("You cannot challenge your own team", client);
                }
                
            } else {
                announce("You don't seem to be a part of a team", client);
            }
        }
    })
}
function acceptChallenge(client, opp, config, database, onticord) {
    getPlayersTeam(client.uuid, database, function(err, team) {
        if (err){
            console.error(error);
            announce("Error getting your team, please report on Discord.", client);
        } else {
            if (team && team[0] && team[0].team_name) {
                if (team[0].team_rank == "owner" || team[0].team_rank == "officer") {
                    var match = matches.get(opp);
                    if (match) {
                        var challenger = match[0];
                        var opponent = match[1];
                        if (openArenas()[Object.keys(openArenas())[0]]) {
                            var arena = openArenas()[Object.keys(openArenas())[0]];
                            var timestamp = Date.now();
                            database.query(`INSERT INTO cpvp_matches  (team1, team2, active, arena, winner, timestamp) VALUES ("${challenger[0].team_name}", "${opponent[0].team_name}", true, "${arena}", "none", "${timestamp}")`, function(err, result) {
                                if (err) {
                                    announce("Failed to initiate match. Please report this issue in Discord", client);
                                    console.error(err);
                                } else {
                                    console.log(result.insertId);
                                    var opponentMap = new Map();
                                    var challengerMap = new Map();
                                    matches.set(`match_${result.insertId}_team1`, challengerMap);
                                    matches.set(`match_${result.insertId}_team2`, opponentMap);
                                    arenas.set(arena, [opponent, challenger]);

                                    challenger.forEach(function(player) {
                                        var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                        if (onlinePlayer) {
                                            var event = {
                                                id: result.insertId,
                                                map: `match_${result.insertId}_team1`,
                                                type: "match",
                                                team: player.team_name,
                                                arena
                                            };
                                            challengerMap.set(player.uuid, "alive");
                                            log(`Setting player ${onlinePlayer.username} from ${player.team_name} to match with ${opponent[0].team_name} in arena ${arena}`);
                                            onlinePlayer.event = event;
                                            announce(`Match with ${opponent[0].team_name} starting in 10 seconds in arena ${arena}!`, onlinePlayer);
                                            setTimeout(function() {
                                                joinArena(arena, onlinePlayer, config, onticord);
                                                announce(`Joined arena ${arena}!`, onlinePlayer);
                                            }, 3000); // <--- change this to 10s
                                        }
                                    });
                                    opponent.forEach(function(player) {
                                        var onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                        if (onlinePlayer) {
                                            var event = {
                                                id: result.insertId,
                                                map: `match_${result.insertId}_team2`,
                                                type: "match",
                                                team: player.team_name,
                                                arena
                                            };
                                            opponentMap.set(player.uuid, "alive");
                                            log(`Setting player ${onlinePlayer.username} from ${player.team_name} to match with ${challenger[0].team_name} in arena ${arena}`);
                                            event.team = player.team_name;
                                            onlinePlayer.event = event;
                                            announce(`Match with ${challenger[0].team_name} starting in 10 seconds in arena ${arena}!`, onlinePlayer);
                                            setTimeout(function() {
                                                joinArena(arena, onlinePlayer, config, onticord)
                                                announce(`Joined arena ${arena}!`, onlinePlayer);
                                            }, 3000);
                                        }
                                    });
                                    
                                    setTimeout(function() {
                                        //delete match invitation
                                        matches.delete(opp);
                                    }, 3000)
                                }
                            });
                        } else {

                            matches.delete(opp);
                        
                            challenger.forEach(function(player) {
                                onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                if (onlinePlayer) {
                                    if (player.team_rank == "owner" || player.team_rank == "officer") {
                                        announce(`Match with ${opponent[0].team_name} canceled due to no open arenas.`, onlinePlayer);
                                    }
                                    
                                    
                                }
                            });
                            opponent.forEach(function(player) {
                                onlinePlayer = onticord.players.getByUUID(player.uuid, onticord.players)
                                if (onlinePlayer) {
                                    if (player.team_rank == "owner" || player.team_rank == "officer") {
                                        announce(`Match with ${opponent[0].team_name} canceled due to no open arenas.`, onlinePlayer);
                                    }
                                    
                                }
                            }); 
                        }

                          

                    } else {
                        announce("No pending challenge found.", client);
                    }
                }
                else {
                    announce("You do not have permission to challenge teams", client);
                }
            } else {
                announce("You don't seem to be a part of a team", client);
            }
        }
    })
}
function getMatchByOpponent(opponent, m = matches) {
    var match = [...matches].find(([key, match]) => match === opponent)[0];
	return m.get(match);
}



//Duel handling
function startDuel(opponent, database, client, onticord) {

    if (opponent.username == client.username) {
        announce(`You can't duel yourself!`, client);
    } else {
        if (duels.get(client.username)) {
            announce(`You currently have a pending duel with ${duels.get(client.username)}`, client);
        } else {
            opponent = onticord.players.get(opponent);
            if (opponent) {
                duels.set(client.username, opponent.username);
                setTimeout(function() {
                    if (duels.get(client.username)) {
                        announce(`Your duel request to ${duels.get(client.username)} has expired.`, client);
                        duels.delete(client.username);
                    }
                }, 30000);
                announce(`Duel request sent to ${opponent.username}`, client);
                announce(`${client.username} wants to duel! Type "/duel accept ${client.username}" to accept the duel.`, opponent);
            } else {
                announce("Could not find that player.", client);
            }
        }
    }
}

function acceptDuel(opponent, database, client, config, onticord) {
    if (duels.get(opponent)) {
        if (onticord.players.get(opponent)) { //check if player is online
            if (duels.get(opponent) == client.username) {
                //start duel
                opponent = onticord.players.get(opponent)
                announce(`Starting duel with ${opponent.username}...`, client);
                announce(`Starting duel with ${client.username}...`, opponent);

                //remove duel request
                duels.delete(opponent.username);
                //log duel in database
                var timestamp = Date.now();
                if (openArenas()[Object.keys(openArenas())[0]]) {
                    var arena = openArenas()[Object.keys(openArenas())[0]];
                    database.query(`INSERT INTO cpvp_duels  (player1, player2, active, arena, winner, timestamp) VALUES ("${opponent.uuid}", "${client.uuid}", true, "${arena}", "none", "${timestamp}")`, function(err, result) {
                        if (err) {
                            announce("Failed to initiate duel. Please report this issue in Discord", client);
                            console.error(err);
                        } else {
                            arenas.set(arena, true);

                            var event = {
                                type: "duel",
                                host: opponent.uuid,
                                arena
                            };

                            client.event = event;
                            opponent.event = event;
                            joinArena(arena, client, config, onticord);
                            joinArena(arena, opponent, config, onticord);
                            announce(`Taking you to arena ${arena}`, client);
                            announce(`Taking you to arena ${arena}`, opponent);
                        }
                    });
                    //send to open arena server
                } else {
                    //No open arenas
                    announce(`There are no open areans at the moment. Please try again later.`, client);
                    announce(`There are no open areans at the moment. Please try again later.`, opponent);
                }
            } else {
                announce(`You do not have a pending duel with that player.`, client);
            }
        } else {
            announce("That player is offline.", client)
        }
    } else {
        announce("Could not find a duel with that player.", client)
    }
}
//Arena handling
function populateArenas(array) {
    for (id in array) {
        arenas.set(id, false);
    }
    return arenas;
}

function openArenas(a = arenas) {
    var result = []
    a.forEach(function(arena, id) {
        if (arena === false) {
            result.push(id, arena);
        }
    })
    return result;
}

function joinArena(arena, client, config, onticord) {
    var server = config.arenas[arena];
    if (server) {
        log(`Sending ${client.username} to arena ${arena}`);
        onticord.sendClient(client, onticord.servers[server].host, onticord.servers[server].port)
        client.currentServer = server;
        client.currentArena = arena;
    } else {
        announce(`Unable to send you to arena ${arena}. Please report on Discord.`, client);
    }
}

function leaveArena(client, config, onticord) {
    if (client.currentServer !== "lobby") {
        onticord.sendClient(client, config[config.lobby].host, onticord.servers[config.lobby].port)
        client.currentServer = config.lobby;
        client.currentArena = undefined;
        announce("Taking you to the lobby.", client)
    } else {
        announce("You're already in the lobby.", client)
    }
}