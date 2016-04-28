var config = require('../config.json');
var exec = require('child_process').exec;
var StvResult = require('../lib/StvResult.js');
var fs = require('fs');
var mail = require('../lib/mail/mail.js');
var mailConfig = require('../mail.json');
const util = require('util')

var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const Job = mongoose.model('Job');
const File = mongoose.model('File');
const User = mongoose.model('User');

// // middleware that is specific to this router
router.use(function (req, res, next) {
    var sid = req.query.sid;
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

    var fileIdsFromJobConfig = [];
    for (var name in jobConfig.options) {
        var option = jobConfig.options[name];
        if (option.type === 'file' && option.mode === 'id') {
            fileIdsFromJobConfig.push(option.value);
        }
    }

    var jobName = req.query.name;
    var jobDescription = req.query.description;

    var fileMap = {};
    File.where('_id').in(fileIdsFromJobConfig).exec(function (err, result) {
        if (err) {
            console.log(err);
            stvResult.error = 'File id provided in options is not valid.';
            stvResult.end();
            res._stvres.response.push(stvResult);
            next();
        } else {

            var job = new Job({
                name: jobName,
                description: jobDescription,
                tool: jobConfig.tool,
                execution: jobConfig.execution,
                executable: jobConfig.executable,
                options: jobConfig.options,
                status: 'QUEUED'
            });
            job.qId = job.tool + '-' + job.execution + '-' + job._id;

            job.createJobFolder(jobName, req._parent, req._user);
            var realOutPath = (config.steviaDir + config.usersPath + job.folder.path + '/');

            for (var i = 0; i < result.length; i++) {
                var file = result[i];
                fileMap[file._id] = file;
            }
            var computedOptions = [],
                prefix;
            for (var name in jobConfig.options) {
                var option = jobConfig.options[name];
                prefix = '--';
                if (option.short) {
                    prefix = '-';
                }
                switch (option.type) {
                case 'file':
                    if (option.mode === 'id') {
                        if (fileMap[option.value] != null) {
                            var userspath = config.steviaDir + config.usersPath;
                            var realPath = userspath + fileMap[option.value].path;
                            computedOptions.push("'" + prefix + name + "'");
                            computedOptions.push("'" + realPath + "'");
                        }
                    }
                    if (option.mode === 'text') {
                        var filename = name + '.txt';
                        var userspath = config.steviaDir + config.usersPath;
                        var realPath = userspath + job.folder.path + '/' + filename;
                        fs.writeFileSync(realPath, option.value);

                        /* Database entry */
                        var file = File.createFile(filename, job.folder, req._user);

                        computedOptions.push("'" + prefix + name + "'");
                        computedOptions.push("'" + realPath + "'");
                    }
                    if (option.mode === 'example') {
                        var realPath = config.steviaDir + config.toolPath + jobConfig.tool + "/examples/" + option.value;
                        computedOptions.push("'" + prefix + name + "'");
                        computedOptions.push("'" + realPath + "'");
                    }
                    break;
                case 'text':
                    computedOptions.push("'" + prefix + name + "'");
                    computedOptions.push("'" + option.value + "'");
                    break;
                case 'flag':
                    computedOptions.push("'" + prefix + name + "'");
                    break;
                }
                if (option.out === true) {
                    computedOptions.push("'" + prefix + name + "'");
                    computedOptions.push("'" + realOutPath + "'");
                }
            }

            var commandLine = "'" + config.steviaDir + config.toolPath + jobConfig.tool + "/" + jobConfig.executable + "' " + computedOptions.join(" ");
            var commandQsub = realOutPath + ".command.qsub.sh";
            try {
                fs.writeFileSync(commandQsub, "#!/bin/bash\n" + commandLine);
            } catch (e) {
                //TODO handle error
            }

            var command = "qsub -j y -N '" + job.qId + "' -q '" + config.queue + "' -o '" + realOutPath + ".out.job" +  "' '" + commandQsub + "'";

            console.log('++++++++++++');
            console.log(command);
            console.log('++++++++++++');

            exec(command, function (error, stdout, stderr) {
                // console.log('stdout: ' + stdout);
                // console.log('stderr: ' + stderr);
                if (error == null) {
                    job.commandLine = commandLine;
                    job.save();
                    stvResult.results.push(job);
                    stvResult.end();
                    res._stvres.response.push(stvResult);
                } else {
                    File.delete(job.folder, req._parent, job);
                    var msg = 'exec error: ' + error;
                    console.log(msg);
                    stvResult.error = 'Execution error';
                    stvResult.end();
                    res._stvres.response.push(stvResult);
                }
                req._user.save();
                next();
            });
        }
    });
});

//Report error in job
router.get('/:id/report-error', function (req, res, next) {
    var id = req.params.id;
    var stvResult = new StvResult();
    console.log('--------------');
    console.log(id);
    Job.findOne({
        '_id': id
    }, function (err, job) {
        if (!job) {
            stvResult.error = "report-error: User does not exist";
            console.log("error: " + stvResult.error);
            stvResult.end();
            res._stvres.response.push(stvResult);
            next();
        } else {
            mail.send({
                to: mailConfig.mail,
                subject: 'Job reported ' + job.id,
                text: 'Hello,\n\n' +
                    'The job ' + id + ' from user ' + job.user.email + ' was reported.\n\n' + util.inspect(job) + '\n'
            }, function (error, info) {
                if (error) {
                    stvResult.error = error
                    console.log(error);
                }
                stvResult.results.push('It has reported the error! Thank you!');
                stvResult.end();
                res._stvres.response.push(stvResult);
                console.log('Message sent: ' + info.response);
                next();
            });
        }
    }).populate('user');
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

router.get('/delete', function (req, res, next) {
    var stvResult = new StvResult();
    Job.findOne({
        '_id': req.query.jobId
    }, function (err, job) {
        if (!job) {
            stvResult.error = "File not exist";
            console.log("error: " + stvResult.error);
        } else {
            File.delete(job.folder, job.folder.parent, job);
            job.user.save();
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    }).populate({
        path: 'folder',
        populate: {
            path: 'files',
        }
    }).populate({
        path: 'folder',
        populate: {
            path: 'parent',
            populate: {
                path: 'files'
            }
        }
    }).populate('user');
});

module.exports = router;
