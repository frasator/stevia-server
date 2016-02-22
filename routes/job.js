var config = require('../config.json');
var exec = require('child_process').exec;
var STVResult = require('../lib/STVResult.js');
var STVResponse = require('../lib/STVResponse.js');
var fs = require('fs');

var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const Job = mongoose.model('Job');
const File = mongoose.model('File');
const User = mongoose.model('User');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    res._stvResponse = new STVResponse({
        paramsOptions: req.params,
        queryOptions: req.query
    });
    next();
});


router.post('/create', function(req, res, next) {
    var sid = req.query.sid;
    if (sid != null) {
        User.findOne({
            'sessions.id': sid
        }, function(err, user) {
            if (user != null) {
                req._user = user;
                next();
            } else {
                res.json({});
            }
        }).populate({
            path: 'home',
            populate: {
                path: 'files'
            }
        });
    }
}, function(req, res, next) {
    var parentId = req.query.outdirId;
    if (parentId != null) {
        File.findOne({
            '_id': parentId
        }, function(err, parent) {
            if (parent != null) {
                req._parent = parent;
                next();
            } else {
                req._parent = req._user.home;
                next();
            }
        }).populate('files');
    } else {
        req._parent = req._user.home;
        next();
    }
}, function(req, res) {
    var jobConfig = req.body;
    var name = req.query.name;
    var description = req.query.description;
    var tool = req.query.tool;
    var execution = req.query.execution;

    var job = new Job({
        name: name,
        description: description,
        tool: jobConfig.tool,
        execution: jobConfig.execution,
        executable: jobConfig.executable,
        options: jobConfig.options,
        status: 'QUEUED'
    });

    job.createJobFolder(name, req._parent, req._user);
    var realOutPath = config.steviaDir + config.usersPath + job.folder.path + '/';
    realOutPath = realOutPath.replace(/ /gi, '\\ ');

    var fileIdsFromJobConfig = [];
    for (var name in jobConfig.options) {
        var option = jobConfig.options[name];
        if (option.type === 'file' && option.mode === 'id') {
            fileIdsFromJobConfig.push(option.value);
        }
    }

    var fileMap = {};
    File.where('_id').in(fileIdsFromJobConfig).exec(function(err, result) {
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
                        var userspath = config.steviaDir + config.usersPath;
                        var realPath = userspath + fileMap[option.value].path;
                        computedOptions.push(prefix + name);
                        computedOptions.push(realPath.replace(/ /gi, '\\ '));
                    }
                    if (option.mode === 'text') {
                        var filename = name + '.txt';
                        var userspath = config.steviaDir + config.usersPath;
                        var realPath = userspath + job.folder.path + '/' + filename;
                        fs.writeFileSync(realPath, option.value);
                        var file = new File({
                            name: filename,
                            user: req._user,
                            parent: job.folder,
                            type: "FILE",
                            path: job.folder.path + '/' + filename
                        });
                        job.folder.files.push(file);
                        file.save();
                        job.folder.save();
                        req._user.save();
                        computedOptions.push(prefix + name);
                        computedOptions.push(realPath.replace(/ /gi, '\\ '));
                    }
                    break;
                case 'text':
                    computedOptions.push(prefix + name);
                    computedOptions.push(option.value);
                    break;
                case 'flag':
                    computedOptions.push(prefix + name);
                    break;
            }
            if (option.out === true) {
                computedOptions.push(prefix + name);
                computedOptions.push(realOutPath.replace(/ /gi, '\\ '));
            }
        }
        var commandLine = config.steviaDir + config.toolPath + jobConfig.tool + '/' + jobConfig.executable + ' ' + computedOptions.join(' ');
        var command = 'qsub -N "j' + job._id + '" -q ' + config.queue + ' -o ' + realOutPath + ' -b y ' + commandLine;
        console.log(command);


        exec(command, function(error, stdout, stderr) {
            // console.log('stdout: ' + stdout);
            // console.log('stderr: ' + stderr);

            var stvResult = new STVResult();
            res._stvResponse.response.push(stvResult);
            res.json(res._stvResponse);

            if (error !== null) {
                var msg = 'exec error: ' + error;
                console.log(msg);
            }
        });
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

router.delete('/delete', function(req, res) {});


module.exports = router;
