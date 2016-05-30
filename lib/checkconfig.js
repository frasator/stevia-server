const config = require('../config.json');
const fs = require('fs');
const shell = require('shelljs');
const async = require('async');
const path = require('path');
const exec = require('child_process').exec;
const net = require('net');
const mongoose = require("mongoose");
//check queue name exists

function logerr(msg, emptyLine) {
    log(' ERROR. ' + msg, emptyLine)
}

function logok(msg, emptyLine) {
    log(' OK. ' + msg, emptyLine)
}

function logSgeHelp() {
    logerr("Please check https://github.com/babelomics/stevia-server/wiki/Installing-Sun-Grid-Engine");
}

function log(msg, emptyLine) {
    if (emptyLine === true) {
        console.log('');
    }
    console.log('  ' + msg);
}

var portInUse = function (port, callback) {
    var server = net.createServer(function (socket) {
        socket.write('Echo server\r\n');
        socket.pipe(socket);
    });

    server.listen(port, '127.0.0.1');
    server.on('error', function (e) {
        callback(true);
    });
    server.on('listening', function (e) {
        server.close();
        callback(false);
    });
};

module.exports = function (callback) {
    console.log('')
    console.log('')
    console.log("Starting stevia server...");
    console.log("=========================");
    console.log('')
    console.log('Cheking configuration...');
    async.waterfall([
        function (cb) {
            log("Cheking port...");
            portInUse(config.httpPort, function (returnValue) {
                if (returnValue == true) {
                    logerr("Port " + config.httpPort + " already in use.");
                    cb('Port in use.');
                } else {
                    logok("Port " + config.httpPort + " not in use.");
                    cb(null)
                }
            });
        },
        function (cb) {
            log("Cheking mongodb database...");
            var conn = mongoose.connect(config.mongodb).connection;
            conn.close(function () {
                cb(null);
            });
            conn.on('error', function (error) {
                logerr("Could not connect to " + config.mongodb + " please check mongodb is runnig.");
                mongoose.disconnect();
                cb("Could not connect to mongodb");
            })
            conn.once('open', function () {
                logok("Mongodb is running on " + config.mongodb);
                mongoose.disconnect();
            });
        },
        function (cb) {
            log("Cheking steviaDir...");
            fs.stat(config.steviaDir, function (err, stats) {
                if (err != null) {
                    logerr("Stevia dir '" + config.steviaDir + "' not found, please create it or check steviaDir in the config.json file.");
                    cb(err);
                } else {
                    logok("Stevia dir found.");
                    try {
                        fs.mkdirSync(path.join(config.steviaDir, config.toolsPath));
                        fs.mkdirSync(path.join(config.steviaDir, config.usersPath));
                    } catch (e) {

                    }
                    cb(null)
                }
            });
        },
        function (cb) {
            log("Cheking SGE qconf...");
            exec('which qconf', function (error, stdout, stderr) {
                if (error) {
                    logerr("qconf not found, SGE seems to be not installed and configured.");
                    logSgeHelp();
                } else {
                    logok('qconf found.')
                }
                cb(error);
            });
        },
        function (cb) {
            log("Cheking SGE admin host...");
            exec('qconf -sh', function (error, stdout, stderr) {
                if (error) {
                    logerr("No admin host found.");
                    logSgeHelp();
                } else {
                    logok('Admin host found: ' + stdout.trim().split(/\s+/g).join(' '));
                }
                cb(error);
            });
        },
        function (cb) {
            log("Cheking SGE execution hosts...");
            exec('qconf -sel', function (error, stdout, stderr) {
                if (error) {
                    logerr("No execution hosts defined.");
                    logerr("use 'sudo qconf -ae' to create a new execution host.");
                    logSgeHelp();
                } else {
                    logok('Execution hosts found: ' + stdout.trim().split(/\s+/g).join(' '));
                }
                cb(error);
            });
        },
        function (cb) {
            log("Cheking SGE submit hosts...");
            exec('qconf -ss', function (error, stdout, stderr) {
                if (error) {
                    logerr("No submit hosts defined.");
                    logerr("use 'sudo qconf -as hostname' to create a new submit host.");
                    logSgeHelp();
                } else {
                    logok('Submit hosts found: ' + stdout.trim().split(/\s+/g).join(' '));
                }
                cb(error);
            });
        },
        function (cb) {
            log("Cheking SGE queue...");
            exec('qconf -sq ' + config.queue, function (error, stdout, stderr) {
                if (error) {
                    logerr("queue " + config.queue + " not found please create or select a valid queue.");
                    logerr("use 'sudo qconf -aq' to create a new queue");
                    logSgeHelp();
                } else {
                    logok('queue found: ' + config.queue);
                }
                cb(error);
            });
        },
    ], function (err, result) {
        if (err != null) {
            // console.log(err);
            console.log(" ");
            console.log("Failed to start the server: Configuration errors found.");
            callback(err);
        } else {
            callback(null);
        }
    });
};
