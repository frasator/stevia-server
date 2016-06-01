var config = require('../config.json');
const mail = require('../lib/mail/mail.js');
const mailConfig = require('../mail.json');
const StvResult = require('../lib/StvResult.js');

const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs');
const util = require('util');
const path = require('path');

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = mongoose.model('Job');
const File = mongoose.model('File');
const User = mongoose.model('User');

// // middleware that is specific to this router
router.use(function (req, res, next) {
    var sid = req._sid;
    User.findOne({
        'sessions.id': sid
    }, function (err, user) {
        if (!user) {
            var stvResult = new StvResult();
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
            stvResult.end();
            res._stvres.response.push(stvResult);
            res.json(res._stvres);
        } else {
            req._user = user;
            next();
        }
    }).select('+password').populate({
        path: 'home',
        populate: {
            path: 'files'
        }
    });
});

router.post('/create', function (req, res, next) {
    var parentId = req.query.outdirId;
    if (parentId != null) {
        File.findOne({
            '_id': parentId
        }, function (err, parent) {
            if (!parent) {
                req._parent = req._user.home;
            } else if (parent.user.toString() != req._user._id.toString()) {
                req._parent = req._user.home;
            } else {
                req._parent = parent;
            }
            next();
        }).populate('files');
    } else {
        req._parent = req._user.home;
        next();
    }
}, function (req, res, next) {
    var stvResult = new StvResult();

    var jobConfig = req.body;
    var tool = jobConfig.tool.replace(/[^a-zA-Z0-9._\-]/g, "_");
    var executable = jobConfig.executable.replace(/[^a-zA-Z0-9._\-]/g, "_");

    var fileIdsFromJobConfig = [];
    for (var name in jobConfig.options) {
        var option = jobConfig.options[name];
        if (option.type === 'file' && option.mode === 'id') {
            fileIdsFromJobConfig.push(option.value);
        }
    }

    var folderName = req.query.name.replace(/[^a-zA-Z0-9._\-]/g, "_");
    var jobName = req.query.name;
    var jobDescription = req.query.description;

    var fileMap = {};
    async.waterfall([
        function (cb) {
            File.where('_id').in(fileIdsFromJobConfig).exec(function (err, result) {
                if (err) {
                    cb('File id provided in options is not valid.');
                } else {
                    for (var i = 0; i < result.length; i++) {
                        var file = result[i];
                        fileMap[file._id] = file;
                    }
                    cb(null);
                }
            });
        },
        function (cb) {
            var job = new Job({
                name: jobName,
                description: jobDescription,
                tool: tool,
                execution: jobConfig.execution,
                executable: executable,
                options: jobConfig.options,
                status: 'QUEUED'
            });
            job.qId = job.tool + '-' + job.execution + '-' + job._id;

            job.createJobFolder(folderName, req._parent, req._user, function (err) {
                if (err) {
                    cb(err)
                } else {
                    cb(null, job)
                }
            });
        },
        function (job, cb) {
            var realOutPath = path.join(config.steviaDir, config.usersPath, job.folder.path);

            var computedOptions = computeOptions(jobConfig, fileMap, job.folder, req._user);

            var commandLine = "'" + path.join(config.steviaDir, config.toolsPath, tool, executable) + "' " + computedOptions.join(" ");
            var commandQsub = path.join(realOutPath, ".command.qsub.sh");

            fs.writeFile(commandQsub, "#!/bin/bash\n" + commandLine, function (err) {
                if (err) {
                    cb('Could not create ' + commandQsub);
                } else {
                    var command = "qsub -N '" + job.qId + "' -q '" + config.queue + "' -j y -o '" + path.join(realOutPath, ".out.job") + "' '" + commandQsub + "'";

                    console.log('++++++++++++');
                    console.log(command);
                    console.log('++++++++++++');

                    exec(command, function (error, stdout, stderr) {
                        if (error) {
                            File.delete(job.folder._id, function () {
                                req._user.save(function () {
                                    cb(error);
                                });
                            });
                        } else {
                            job.commandLine = commandLine;
                            job.save(function () {
                                req._user.save(function () {
                                    stvResult.results.push(job);
                                    cb(null);
                                });
                            });
                        }
                    });
                }
            });

        },
    ], function (err) {
        if (err) {
            stvResult.error = err;
            console.log("Error in ws: " + req.originalUrl);
            console.log(err);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

router.post('/run', function (req, res, next) {
    var stvResult = new StvResult();
    var folderId = req.query.workingdirId;
    async.waterfall([
        function (cb) {
            File.findOne({
                '_id': folderId
            }, function (err, folder) {
                if (err) {
                    cb(err);
                } else if (folder.user.toString() != req._user._id.toString()) {
                    cb("Authentication error");
                } else {
                    cb(null, folder)
                }
            }).populate('files');
        },
        function (folder, cb) {
            var jobConfig = req.body;

            var fileIdsFromJobConfig = [];
            for (var name in jobConfig.options) {
                var option = jobConfig.options[name];
                if (option.type === 'file' && option.mode === 'id') {
                    fileIdsFromJobConfig.push(option.value);
                }
            }
            var fileMap = {};
            File.find({
                '_id': {
                    $in: fileIdsFromJobConfig
                },
            }, function (err, files) {
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    fileMap[file._id] = file;
                }
                cb(null, jobConfig, fileMap, folder);
            }).populate('files');
        },
        function (jobConfig, fileMap, folder, cb) {
            var tool = jobConfig.tool.replace(/[^a-zA-Z0-9._\-]/g, "_");
            var executable = jobConfig.executable.replace(/[^a-zA-Z0-9._\-]/g, "_");

            var computedOptions = computeOptions(jobConfig, fileMap, folder, req._user, false);

            var commandLine = "'" + path.join(config.steviaDir, config.toolsPath, tool, executable) + "' " + computedOptions.join(" ");

            var randStr = Date.now() + Math.random().toString().replace('0.', '');
            var commandQsub = "/tmp/" + "stv-tmp-cmd-" + randStr + ".qsub-sync.sh";
            try {
                fs.writeFileSync(commandQsub, "#!/bin/bash\n" + commandLine);
            } catch (e) {
                //TODO handle error
            }
            var command = "qsub -sync y -q '" + config.queue + "' -j y -o '/tmp/" + randStr + ".out.job" + "' '" + commandQsub + "'";

            // console.log(commandLine);
            exec(commandLine, function (error, stdout, stderr) {
                // console.log('stdout: ' + stdout);
                // console.log('stderr: ' + stderr);
                if (error != null) {
                    cb(error);
                } else {
                    cb(null)
                }
            });
        },
    ], function (err) {
        if (err) {
            stvResult.error = err;
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });

});

//Report error in job
router.get('/:id/report-error', function (req, res, next) {
    var id = req.params.id;
    var stvResult = new StvResult();
    console.log('--------------');
    console.log(id);

    async.waterfall([
        function (cb) {
            Job.findOne({
                '_id': id
            }, function (err, job) {
                if (!job) {
                    cb("report-error: User does not exist")
                } else {
                    mail.send({
                        to: mailConfig.mail,
                        subject: 'Job reported ' + job.id,
                        text: 'Hello,\n\n' +
                            'The job ' + id + ' from user ' + job.user.email + ' was reported.\n\n' + util.inspect(job) + '\n'
                    }, function (error, info) {
                        if (error) {
                            cb(error)
                        } else {
                            stvResult.results.push('It has reported the error! Thank you!');
                            console.log('Message sent: ' + info.response);
                            cb(null);
                        }
                    });
                }
            }).populate('user');
        }
    ], function (err) {
        if (err) {
            stvResult.error = err;
            console.log("Error in ws: " + req.originalUrl);
            console.log(err);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

router.get('/delete', function (req, res, next) {
    var stvResult = new StvResult();

    async.waterfall([
        function (cb) {
            Job.findOne({
                '_id': req.query.jobId
            }, function (err, job) {
                if (!job) {
                    cb("File not exist");
                } else {
                    File.delete(job.folder, function () {
                        cb(null);
                    });
                }
            });
        }
    ], function (err) {
        if (err) {
            stvResult.error = err;
            console.log("Error in ws: " + req.originalUrl);
            console.log(err);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

/* input from web */
// var jobConfig = {
//     tool: 'fatigo',
//     execution: 'fatigo',
//     executable: 'fatigo.sh',
//     options: {
//         list1: {
//             type: 'file',
//             mode: 'id',
//             value: '56c71e5bb0a5883a06f9ad04'
//         },
//         list2: {
//             type: 'file',
//             mode: 'text',
//             value: 'asdfsda\nsdfsafdsa\nfdsfds'
//         },
//         outdir: {
//             type: 'file',
//             mode: 'id',
//             value: '56c71e4c5e32704a051c1b44',
//             out: true,
//         },
//         genome: {
//             type: 'text',
//             value: 'asdfasdf'
//         },
//         f: {
//             type: 'flag',
//             short: true
//         }
//     }
// }

function computeOptions(jobConfig, fileMap, folder, user, registerTextFile) {
    var options = jobConfig.options;
    var tool = jobConfig.tool.replace(/[^a-zA-Z0-9._\-]/g, "_");

    var computedOptions = [],
        prefix;
    for (var name in options) {
        var option = options[name];
        prefix = '--';
        if (option.short) {
            prefix = '-';
        }
        switch (option.type) {
        case 'file':
            if (option.mode === 'id') {
                if (fileMap[option.value] != null) {
                    var userspath = path.join(config.steviaDir, config.usersPath);
                    var realPath = path.join(userspath, fileMap[option.value].path);
                    computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
                    computedOptions.push("'" + realPath.replace(/\'/g, "_") + "'");
                }
            }
            if (option.mode === 'text') {
                var filename = name + '.txt';
                var userspath = path.join(config.steviaDir, config.usersPath);
                var realPath = path.join(userspath, folder.path, filename);;
                fs.writeFileSync(realPath, option.value.toString());

                /* Database entry */
                if (registerTextFile !== false) {
                    File.createFile(filename, folder, user);
                }

                computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
                computedOptions.push("'" + realPath.replace(/\'/g, "_") + "'");
            }
            if (option.mode === 'example') {
                var realPath = path.join(config.steviaDir, config.toolsPath, tool, "/examples/", option.value);
                computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
                computedOptions.push("'" + realPath.replace(/\'/g, "_") + "'");
            }
            break;
        case 'text':
            computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
            computedOptions.push("'" + option.value.toString().replace(/\'/g, "_") + "'");
            break;
        case 'flag':
            computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
            break;
        }
        if (option.out === true) {
            var realOutPath = path.join(config.steviaDir, config.usersPath, folder.path);
            computedOptions.push("'" + (prefix + name).replace(/\'/g, "_") + "'");
            computedOptions.push("'" + realOutPath.replace(/\'/g, "_") + "'");
        }
    }
    return computedOptions;
};

module.exports = router;
