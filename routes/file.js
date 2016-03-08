var config = require('../config.json');
var multiparty = require('multiparty');
var remove = require('remove');
var exec = require('child_process').exec;
const fs = require('fs');
const readline = require('readline');
var StvResult = require('../lib/StvResult.js');

var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const File = mongoose.model('File');
const User = mongoose.model('User');

// // middleware that is specific to this router
router.use(function(req, res, next) {
    var sid = req.query.sid;
    User.findOne({
        'sessions.id': sid
    }, function(err, user) {
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
    }).select('+password');
});

router.get('/:fileId/delete', function(req, res, next) {
    var stvResult = new StvResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;

    stvResult.id = fileId;

    File.findOne({
        '_id': fileId
    }, function(err, file) {
        if (!file) {
            stvResult.error = "File not exist";
            console.log("error: " + stvResult.error);
        } else if (file.user.toString() != req._user._id.toString()) {
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
        } else {
            File.delete(file, file.parent, file.job);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    }).populate('parent').populate('job');
});

router.get('/:fileId/list', function(req, res, next) {
    var stvResult = new StvResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;
    var type = req.query.type;
    var status = req.query.status;

    stvResult.id = fileId;

    File.findOne({
        '_id': fileId
    }, function(err, file) {
        if (!file) {
            stvResult.error = "File not exist";
            console.log("error: " + stvResult.error);
        } else if (file.user.toString() != req._user._id.toString()) {
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
        } else {
            stvResult.results.push(file);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    }).populate({
        path: 'files',
        populate: {
            path: 'job'
        }
    }).populate('job');
});

router.get('/:fileId/create-folder', function(req, res, next) {
    var stvResult = new StvResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;
    var name = req.query.name;

    stvResult.id = fileId;

    File.findOne({
        '_id': fileId
    }, function(err, parent) {
        if (!parent) {
            stvResult.error = "File not exist";
            console.log("error: " + stvResult.error);
        } else if (parent.user._id.toString() != req._user._id.toString()) {
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
        } else {
            var folder = parent.hasFile(name);
            if (folder != null) {
                stvResult.results.push(folder);
            } else {
                var folder = File.createFolder(name, parent, req._user);
                stvResult.results.push(folder);
            }
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    }).populate("user").populate('files');
});


router.get('/:fileId/content', function(req, res, next) {
    var stvResult = new StvResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;
    var start = 0;
    var limit = 0;
    var l = parseInt(req.query.limit);
    var s = parseInt(req.query.start);

    if (!isNaN(l) && l > 0) {
        limit = l;
    }
    if (!isNaN(s) && s >= 0) {
        start = s;
    }

    stvResult.id = fileId;

    File.findOne({
        '_id': fileId
    }, function(err, file) {
        if (!file) {
            stvResult.error = "File not exist";
            console.log("error: " + stvResult.error);
            stvResult.end();
            res._stvres.response.push(stvResult);
            next();
        } else if (file.user._id.toString() != req._user._id.toString()) {
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
            stvResult.end();
            res._stvres.response.push(stvResult);
            next();
        } else {
            try {
                var lines = [];
                var lineCount = 0;
                var end = start + limit;
                var filePath = (config.steviaDir + config.usersPath + file.path);
                const rl = readline.createInterface({
                    input: fs.createReadStream(filePath)
                });
                rl.on('line', (line) => {
                    if (lineCount >= start) {
                        lines.push(line);
                    }
                    if (limit > 0 && lineCount > end) {
                        rl.close()
                    }
                    lineCount++;
                });
                rl.on('close', function() {
                    stvResult.results.push(lines.join('\n'));
                    stvResult.end();
                    res._stvres.response.push(stvResult);
                    next();
                });
            } catch (e) {
                stvResult.error = "Could not read the file.";
                stvResult.end();
                res._stvres.response.push(stvResult);
                next();
            }
        }
    }).populate("user").populate('parent');
});

/******************************/
/******** Upload file *********/
/******************************/

/******************************/
/******************************/
router.post('/upload', function(req, res, next) {
    File.findOne({
        '_id': req.query.parentId
    }, function(err, parent) {
        if (!parent) {
            res.json({
                error: "File not exist"
            });
        } else if (parent.user.toString() != req._user._id.toString()) {
            res.json({
                error: "Authentication error"
            });
        } else {
            req._parent = parent;
            next();
        }
    }).populate('files');
}, function(req, res, next) {
    console.log(req.query.name);
    var parent = req._parent;
    var file = parent.hasFile(req.query.name);
    if (file != null) {
        res.json({
            exists: true,
            file: file
        });
    } else {
        next();
    }

}, function(req, res, next) {
    var fields = {};
    var form = new multiparty.Form({
        // Parts for fields are not emitted when autoFields is on, and likewise parts for files are not emitted when autoFiles is on.
        autoFields: true
    });

    // Fields
    form.on('field', function(name, value) {
        // console.log(name + ': ' + value);
        fields[name] = value;
    });

    //Files, should be only one;
    form.on('part', function(part) {
        File.findOne({
            '_id': fields.parentId
        }, function(err, parent) {
            var path = config.steviaDir + config.usersPath + parent.path + '/';
            var uploadPath = path + fields.name + "_partial";
            try {
                fs.mkdirSync(uploadPath);
            } catch (e) {
                console.log('Upload: ' + uploadPath + ' ' + 'already created');
            }
            var filepath = uploadPath + '/' + fields.chunk_id + "_chunk";
            var writeStream = fs.createWriteStream(filepath);
            part.pipe(writeStream);
            writeStream.on('finish', function() {
                var stats = fs.statSync(filepath);
                console.log('Chunk ' + fields.chunk_id + ' created. Chunk size: ' + stats.size);

                if (fields.last_chunk === 'true') {
                    console.log('Chunk ' + fields.chunk_id + ' is the last');
                    joinAllChunks(path, uploadPath, fields, parent, function(file) {
                        res.json({
                            file: file
                        });
                    })
                } else {
                    res.json({
                        chunkId: fields.chunk_id
                    });
                }
            });
        }).populate("user");
    });

    form.on('close', function() {
        File.findOne({
            '_id': fields.parentId
        }, function(err, parent) {
            var path = config.steviaDir + config.usersPath + parent.path + '/';
            var uploadPath = path + fields.name + "_partial";
            if (fields.resume_upload === 'true') {
                var chunkMap = JSON.parse(fields.chunk_map);
                var resumeInfo = getResumeFileInfo(uploadPath, chunkMap);
                if (checkAllIsUploaded(resumeInfo, chunkMap)) {
                    joinAllChunks(path, uploadPath, fields, parent, function(file) {
                        res.json({
                            file: file,
                            resumeInfo: resumeInfo
                        });
                    })
                } else {
                    res.json({
                        resumeInfo: resumeInfo
                    });
                }
            }
        }).populate("user");
    });
    form.on('aborted', function() {
        console.log('form parse aborted !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ');
    });
    form.parse(req);
});
/******************************/
/******************************/

function joinAllChunks(path, uploadPath, fields, parent, callback) {
    console.log('Joining all chunks...');
    var finalFilePath = path + fields.name;
    var files = getSortedChunkList(uploadPath);
    var fd = fs.openSync(finalFilePath, 'w');
    fs.closeSync(fd);
    var fd = fs.openSync(finalFilePath, 'a');
    var c = 0;
    for (var i = 0; i < files.length; i++) {
        var file = uploadPath + '/' + files[i];
        var data = fs.readFileSync(file);
        fs.appendFileSync(fd, data, null);
    }
    fs.closeSync(fd);
    var stats = fs.statSync(finalFilePath);
    console.log('File ' + finalFilePath + ' created. Final size: ' + stats.size);

    /* Database entry */
    var file = File.createFile(fields.name, parent, parent.user);

    remove.removeSync(uploadPath);
    console.log('Temporal upload folder ' + uploadPath + ' removed');
    callback(file);
};

function getResumeFileInfo(uploadPath, chunkMap) {
    var info = {};
    try {
        fs.accessSync(uploadPath);
        var stats = fs.statSync(uploadPath);
        if (stats.isDirectory()) {
            var filesInFolder = fs.readdirSync(uploadPath);
            for (var i = 0; i < filesInFolder.length; i++) {
                var file = filesInFolder[i];
                var stats = fs.statSync(uploadPath + '/' + file);
                var nameSplit = file.split("_");
                var chunkId = nameSplit[0];
                if (stats.size === chunkMap[chunkId].size) {
                    info[chunkId] = {
                        size: stats.size
                    };
                }
            }
        }
    } catch (e) {
        console.log('Resume upload: ' + e.message);
        console.log('Resume upload: ' + 'Nothing to resume');
    }
    return info;
};

function checkAllIsUploaded(resumeInfo, chunkMap) {
    var allUploaded = true;
    for (var key in chunkMap) {
        if (resumeInfo[key] == null) {
            allUploaded = false;
            break;
        }
    }
    return allUploaded;
};

function getSortedChunkList(uploadPath) {
    var files, chunkId, file, nameSplit;
    try {
        fs.accessSync(uploadPath);
        var stats = fs.statSync(uploadPath);
        if (stats.isDirectory()) {
            files = [];
            var filesInFolder = fs.readdirSync(uploadPath);
            files.length = filesInFolder.length;
            for (var i = 0; i < filesInFolder.length; i++) {
                file = filesInFolder[i];
                nameSplit = file.split("_");
                chunkId = nameSplit[0];
                files[chunkId] = file;
            }
        }
    } catch (e) {
        console.log('Sort chunks: ' + e.message);
        console.log('Sort chunks: ' + 'Could not get chunks from partial folder.');
    }
    return files;
};


module.exports = router;
