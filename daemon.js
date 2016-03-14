require('./models/job.js');
require('./models/file.js');
require('./models/user.js');
const config = require('./config.json');
const cluster = require('cluster');
const fs = require('fs');
const exec = require('child_process').exec;
const mongoose = require('mongoose');
const Job = mongoose.model('Job');
const File = mongoose.model('File');
const xml2js = require('xml2js');

/**/
const mail = require('./lib/mail/mail.js');
/**/

var LOCK = false;

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
            // console.log('LOCK is: ' + LOCK);
            if (LOCK == false) {
                LOCK = true;
                run(function() {
                    LOCK = false;
                });
            }
        }, 500);
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


function run(cb) {
    getDbJobs(function(dbJobs) {
        getSGEQstatJobs(function(qJobs) {
            var ids = Object.keys(dbJobs);
            var c = ids.length;
            if (c > 0) {
                console.log('---Jobs to check---');
                console.log(ids);
                console.log('-------------------');
                for (var qId in dbJobs) {
                    var dbJob = dbJobs[qId];
                    var qJob = qJobs[qId];
                    if (qJob != null) {
                        //The job is on the qstat
                        checkSGEQstatJob(dbJob, qJob);
                        c--;
                        if (c == 0) {
                            cb();
                        }
                    } else {
                        //If not in qstat check on qacct
                        checkSGEQacctJob(dbJob, function() {
                            c--;
                            if (c == 0) {
                                cb();
                            }
                        });
                    }
                }
            } else {
                cb();
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
                jobs[job.qId] = job;
            }
            cb(jobs);
        });
}

function getSGEQstatJobs(cb) {
    var jobs = {};
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
                    var jobName = item.JB_name[0];
                    var state = item.state[0];
                    jobs[jobName] = {
                        qId: jobName,
                        state: state
                    };
                }
            }
        });
        if (error !== null) {
            var msg = 'exec error: ' + error;
            console.log(msg);
        }
        cb(jobs);
    });
}


function checkSGEQstatJob(dbJob, qJob) {
    switch (qJob.state) {
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


function checkSGEQacctJob(dbJob, cb) {
    var qId = dbJob.qId;
    exec("qacct -j " + qId, function(error, stdout, stderr) {
        if (error == null) {
            var stdoutLines = stdout.split('\n');
            for (var i = 0; i < stdoutLines.length; i++) {
                var line = stdoutLines[i];
                if (line.indexOf('failed') != -1) {
                    var value = line.trim().split('failed')[1].trim();
                    if (value != '0' && dbJob.status != "QUEUE_ERROR") {
                        dbJob.status = "QUEUE_ERROR";
                        recordOutputFolder(dbJob.folder, dbJob);
                        dbJob.save();
                        dbJob.user.save();
                        notifyUser(dbJob.user.email,dbJob.status);
                    }
                } else if (line.indexOf('exit_status') != -1) {
                    var value = line.trim().split('exit_status')[1].trim();
                    if (value != '0' && dbJob.status != "EXEC_ERROR") {
                        dbJob.status = "EXEC_ERROR";
                        recordOutputFolder(dbJob.folder, dbJob);
                        dbJob.save();
                        dbJob.user.save();
                        notifyUser(dbJob.user.email,dbJob.status);
                    } else if (dbJob.status != "DONE") {
                        dbJob.status = "DONE";
                        recordOutputFolder(dbJob.folder, dbJob);
                        dbJob.save();
                        dbJob.user.save();
                        notifyUser(dbJob.user.email,dbJob.status);
                    }
                }
            }
        } else {
            // var msg = 'exec error: ' + error;
            // console.log(msg);
            // cb(error, dbJob);
        }
        cb();
    });
}

function recordOutputFolder(folder, dbJob) {
    var folderPath = config.steviaDir + config.usersPath + folder.path + '/';
    try {
        var folderStats = fs.statSync(folderPath);
        if (folderStats.isDirectory()) {
            var filesInFolder = fs.readdirSync(folderPath);
            for (var i = 0; i < filesInFolder.length; i++) {
                var fileName = filesInFolder[i];
                var filePath = folderPath + fileName;
                var fileStats = fs.statSync(filePath);

                /* Database entry */
                var type = "FILE";
                if (fileStats.isDirectory()) {
                    type = "FOLDER";
                }
                var file = new File({
                    name: fileName,
                    user: folder.user,
                    parent: folder,
                    type: type,
                    path: folder.path + '/' + fileName
                });
                folder.files.push(file);
                file.save();

                /* RECORD elog and olog */
                if (dbJob != null) {
                    if (file.name.indexOf(dbJob.qId + '.o') != -1) {
                        dbJob.olog = file;
                    }
                    if (file.name.indexOf(dbJob.qId + '.e') != -1) {
                        dbJob.elog = file;
                    }
                }
                /* */

                if (fileStats.isDirectory()) {
                    recordOutputFolder(file);
                }

            }
            folder.save();

            /* RECORD elog and olog */
            if (dbJob != null) {
                for (var i = 0; i < folder.files.length; i++) {
                }
                dbJob.save();
            }
            /* */
        }
    } catch (e) {
        console.log('recordOutputFolder: ');
        console.log(e);
    }
}

function notifyUser(email,status){
  mail.send({
      to: email,
      subject: 'FYI',
      text: 'Your job has finished with the next status: ' + status + '\n'
  }, function(error, info) {
      if (error) {
          console.log(error);
      }
      console.log('Message sent: ' + info.response);
  });
}
