const config = require('./config.json');
const cluster = require('cluster');
const fs = require('fs');
const exec = require('child_process').exec;
const mongoose = require('mongoose');
require('./models/job.js');
require('./models/file.js');
require('./models/user.js');
const Job = mongoose.model('Job');
const File = mongoose.model('File');
const xml2js = require('xml2js');


if (cluster.isMaster) {
    // Code to run if we're in the master process

    // Count the machine's CPUs
    // var cpuCount = require('os').cpus().length;
    var cpuCount = 1;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for dying workers
    cluster.on('exit', function(worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        cluster.fork();
    });

} else {
    //  Code to run if we're in a worker process
    /******************************/
    /****** Server instance *******/
    /******************************/
    connect()
        .on('error', console.log)
        .on('disconnected', connect)
        .once('open', listen);

    function listen() {
        console.log('Worker %d running!', cluster.worker.id);
        var interval = setInterval(function() {
            run();
        }, 2000);
    }

    function connect() {
        var options = {
            server: {
                socketOptions: {
                    keepAlive: 120
                }
            }
        };
        return mongoose.connect(config.mongodb, options).connection;
    }
}


function run() {
    getDbJobs(function(jobs) {
        getSGEQstatJobs(jobs, function() {
            for (var id in jobs) {
                checkSGEQacctJob(jobs[id], function() {});
            }
        });
    });
}

function getDbJobs(cb) {
    // QUEUED RUNNING DONE ERROR EXEC_ERROR QUEUE_ERROR QUEUE_WAITING_ERROR
    var jobs = {};
    Job.where('status')
        .in(['QUEUED', 'RUNNING'])
        .populate('user')
        .populate({
            path: 'folder',
            populate: {
                path: 'files'
            }
        }).exec(function(err, result) {
            for (var i = 0; i < result.length; i++) {
                var job = result[i];
                jobs[job._id] = job;
            }
            cb(jobs);
        });
}

function getSGEQstatJobs(jobs, cb) {
    exec('qstat -xml', function(error, stdout, stderr) {
        // console.log('stdout: ' + stdout);
        // console.log('stderr: ' + stderr);
        xml2js.parseString(stdout, function(err, result) {
            if (result != null) {
                var items = [];
                var l1 = result.job_info.queue_info[0].job_list;
                var l2 = result.job_info.job_info[0].job_list;
                if (l1 != null) {
                    items = items.concat(l1);
                }
                if (l2 != null) {
                    items = items.concat(l2);
                }
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var id = item.JB_name[0].substring(1);
                    var state = item.state[0];
                    var dbJob = jobs[id];
                    var currentStatus = dbJob.status;
                    switch (state) {
                        case 'r':
                            if (dbJob.status != "RUNNING") {
                                dbJob.status = "RUNNING";
                                dbJob.save();
                                dbJob.user.save();
                            }
                            break;
                        case 'qw':
                            if (dbJob.status != "QUEUED") {
                                dbJob.status = "QUEUED";
                                dbJob.save();
                                dbJob.user.save();
                            }
                            break;
                        case 'Eqw':
                            if (dbJob.status != "QUEUE_WAITING_ERROR") {
                                dbJob.status = "QUEUE_WAITING_ERROR";
                                dbJob.save();
                                dbJob.user.save();
                            }
                            break;
                    }
                }
            }
        });
        if (error !== null) {
            var msg = 'exec error: ' + error;
            console.log(msg);
        }
        cb();
    });
}

function checkSGEQacctJob(dbJob, cb) {
    var qId = 'j' + dbJob._id;
    exec("qacct -j " + qId, function(error, stdout, stderr) {
        if (error == null) {
            var stdoutLines = stdout.split('\n');
            for (var i = 0; i < stdoutLines.length; i++) {
                var line = stdoutLines[i];
                if (line.indexOf('failed') != -1) {
                    var value = line.trim().split('failed')[1].trim();
                    if (value != '0') {
                        dbJob.status = "QUEUE_ERROR";
                        dbJob.save();
                        dbJob.user.save();
                        recordOutputFolder(dbJob);
                    }
                }
                if (line.indexOf('exit_status') != -1) {
                    var value = line.trim().split('exit_status')[1].trim();
                    if (value != '0') {
                        dbJob.status = "EXEC_ERROR";
                        dbJob.save();
                        dbJob.user.save();
                    } else {
                        dbJob.status = "DONE";
                        dbJob.save();
                        dbJob.user.save();
                    }
                    recordOutputFolder(dbJob);
                }
            }
        } else {
            // var msg = 'exec error: ' + error;
            // console.log(msg);
        }
        cb();
    });
}

function recordOutputFolder(job) {
    var folder = job.folder;
    var path = config.steviaDir + config.usersPath + folder.path + '/';
    try {
        var folderStats = fs.statSync(path);
        if (folderStats.isDirectory()) {
            var filesInFolder = fs.readdirSync(path);
            for (var i = 0; i < filesInFolder.length; i++) {
                var file = filesInFolder[i];
                if (folder.hasFile(file) == null) {
                    var filePath = path + file;
                    var stats = fs.statSync(filePath);

                    /* Database entry */
                    var type = "FILE";
                    if (stats.isDirectory()) {
                        type = "FOLDER";
                    }
                    var file = new File({
                        name: file,
                        user: folder.user,
                        parent: folder,
                        type: type,
                        path: filePath
                    });
                    folder.files.push(file);
                    file.save();
                    folder.save();
                    folder.user.save();
                }
            }
        }
    } catch (e) {
        console.log('recordOutputFolder: ');
        console.log(e);
    }
}
