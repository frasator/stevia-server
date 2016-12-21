var config = require('../config.json');
const mail = require('../lib/mail/mail.js');
const mailConfig = require('../mail.json');
const StvResult = require('../lib/StvResult.js');

const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs');
const archiver = require('archiver');
const util = require('util');
const path = require('path');
const shell = require('shelljs');
const tmp = require('tmp');

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
                    console.log(err)
                    cb(err)
                } else {
                    cb(null, job._id)
                }
            });
        },
        function (jobId, cb) {
            Job.findOne({
                '_id': jobId
            }, function (err, job) {
                cb(null, job);
            }).populate('folder').populate('user');
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
                    console.log(commandLine);
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
                    cb(null, null);
                } else {
                    cb(null, folder);
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
            var prefix = tool + '_' + executable + '_';
            var tmpobj = tmp.dirSync({
                prefix: prefix + '-',
                dir: path.join(config.steviaDir, "tmp"),
                keep: true
            });
            var randFolder = tmpobj.name;

            if (folder != null) {
                var computedOptions = computeOptions(jobConfig, fileMap, folder, req._user, false);
            } else {
                var computedOptions = computeOptions(jobConfig, fileMap, randFolder, req._user, false);
            }

            var commandLine = "'" + path.join(config.steviaDir, config.toolsPath, tool, executable) + "' " + computedOptions.join(" ");
            var commandQsub = path.join(randFolder, "sync.command.qsub.sh");
            var outFile = path.join(randFolder, "out.job");

            fs.writeFile(commandQsub, "#!/bin/bash\n" + commandLine, function (err) {
                if (err) {
                    cb('Could not create ' + commandQsub);
                } else {
                    shell.chmod('+x', commandQsub);

                    var command;
                    if (jobConfig.disableQueue === true) {
                        command = commandQsub;
                    } else {
                        command = "qsub -sync y -q '" + config.queue + "' -j y -o '" + outFile + "' '" + commandQsub + "'";
                    }

                    // console.log('++++++++++++');
                    // console.log(command);
                    // console.log(commandLine);
                    // console.log('++++++++++++');

                    exec(command, function (error, stdout, stderr) {
                        stvResult.results.push({
                            err: stderr,
                            out: stdout,
                            output: shell.cat(outFile)
                        });
                        if (error != null) {
                            cb(error);
                        } else {
                            cb(null)
                        }
                        if (shell.test('-e', randFolder)) {
                            shell.rm('-rf', randFolder);
                        }
                    });
                }
            });

            // console.log(commandLine);
            // exec(commandLine, function (error, stdout, stderr) {

            // });
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

router.get('/example', function (req, res, next) {
    var stvResult = new StvResult();
    var folderName = req.query.folderName;
    var tool = req.query.tool.replace(/[^a-zA-Z0-9._\-]/g, "_");
    var execution = req.query.execution.replace(/[^a-zA-Z0-9._\-]/g, "_");

    async.waterfall([
        function (cb) {
            var folderPath = path.join(config.steviaDir, config.toolsPath, tool, "examples", "folderName");
            if (shell.test('-d', folderPath)) {
                cb(null, folderPath);
            } else {
                cb('Example folder not exists.');
            }
        },
        function (folderPath, cb) {
            var registerScript = path.join(__dirname, '..', 'maintenance', 'register-job-folder.js');
            var command = [registerScript, req._user.name, folderName, folderPath, execution];
            exec(command, function (error, stdout, stderr) {
                stvResult.results.push({
                    err: stderr,
                    out: stdout
                });
                if (error != null) {
                    cb(error);
                } else {
                    cb(null)
                }
            });
        }
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
                    cb("report-error: Job does not exist")
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
                    cb("Job not exist");
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

router.get('/:jobId/download', function (req, res, next) {
    var jobId = req.params.jobId;

    async.waterfall([
        function (cb) {
            Job.findOne({
                '_id': jobId,
                "user": req._user._id
            }, function (err, job) {
                if (!job) {
                    cb("Job not exist");
                } else {

                    var userspath = path.join(config.steviaDir, config.usersPath);
                    var zippath = path.join(config.steviaDir, "tmp", job._id + ".zip");
                    var realPath = path.join(userspath, job.folder.path);

                    var output = fs.createWriteStream(zippath);
                    var archive = archiver('zip');

                    output.on('close', function () {
                        // res.attachment(zippath);
                        res.download(zippath, job.name + ".zip", function (err) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, zippath)
                            }
                        });
                        // shell.rm('-rf', zippath);
                    });

                    archive.on('error', function (err) {
                        cb(err);
                    });

                    archive.pipe(output);
                    archive.bulk([{
                        expand: true,
                        cwd: realPath,
                        src: ['**']
                            // dest: 'source'
                    }]);
                    archive.finalize();

                }
            }).populate('folder');
        },
        function (zippath, cb) {
            shell.rm('-rf', zippath);
            cb(null);
        }
    ], function (err) {
        if (err) {
            console.log("Error in ws: " + req.originalUrl);
            console.log(err);
            res.send();
        }
    });
});

/* get file Bean*/
router.get('/:jobId/info', function (req, res, next) {
    var stvResult = new StvResult();

    var jobId = req.params.jobId;
    var sid = req._sid;

    stvResult.id = jobId;

    async.waterfall([
        function (cb) {
            Job.findOne({
                "_id": jobId,
                "user": req._user._id
            }, function (err, job) {
                if (!job) {
                    cb("Job not exist");
                } else {
                    stvResult.results = [job];
                    cb(null);
                }
            }).populate('folder');
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

    var jobFolder;
    if (folder.path != null) {
        jobFolder = folder;
    }

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
                    computedOptions.push(_secureStr(prefix + name));
                    computedOptions.push(_secureStr(realPath));
                }
            } else if (option.mode === 'text') {
                var filename = name + '.txt';
                var realPath;
                if (jobFolder != null) {
                    /* Database entry */
                    if (registerTextFile !== false) {
                        File.createFile(filename, jobFolder, user, function (file) {});
                    }
                    realPath = path.join(config.steviaDir, config.usersPath, jobFolder.path, filename);
                } else {
                    realPath = path.join(folder, filename);
                }
                fs.writeFileSync(realPath, option.value);

                computedOptions.push(_secureStr(prefix + name));
                computedOptions.push(_secureStr(realPath));

            } else if (option.mode === 'example') {
                var realPath = path.join(config.steviaDir, config.toolsPath, tool, "/examples/", option.value);
                computedOptions.push(_secureStr(prefix + name));
                computedOptions.push(_secureStr(realPath));
            }
            break;
        case 'text':
            computedOptions.push(_secureStr(prefix + name));
            computedOptions.push(_secureStr(option.value));
            break;
        case 'flag':
            computedOptions.push(_secureStr(prefix + name));
            break;
        }
        if (option.out === true) {
            var realOutPath;
            if (jobFolder != null) {
                realOutPath = path.join(config.steviaDir, config.usersPath, jobFolder.path);
            } else {
                realOutPath = folder;
            }

            computedOptions.push(_secureStr(prefix + name));
            computedOptions.push(_secureStr(realOutPath));
        }
    }
    return computedOptions;
};

function _secureStr(str) {
    return "'" + str.toString().replace(/\'/g, "") + "'";
}

module.exports = router;
