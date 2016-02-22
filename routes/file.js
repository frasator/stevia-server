var config = require('../config.json');
var multiparty = require('multiparty');
var fs = require('fs');
var remove = require('remove');
var exec = require('child_process').exec;
var STVResult = require('../lib/STVResult.js');
var STVResponse = require('../lib/STVResponse.js');

var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const File = mongoose.model('File');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    res._stvResponse = new STVResponse({
        paramsOptions: req.params,
        queryOptions: req.query
    });
    next();
});

router.get('/:fileId/delete', function(req, res) {
    var stvResult = new STVResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;

    stvResult.id = fileId;
    var start = new Date().getTime();

    File.findOne({
        '_id': fileId
    }, function(err, file) {
        var end = new Date().getTime();


        var index = file.parent.files.indexOf(file._id);
        console.log(index);
        if (index != -1) {
            file.parent.files.splice(index, 1);
        }
        file.parent.save();

        if (file.job) {
            file.job.remove();
        }
        file.removeChilds();
        file.remove();

        file.fsDelete();
        stvResult.results = [];

        stvResult.dbTime = new Date().getTime() - start;

        stvResult.numResults = 0;
        stvResult.numTotalResults = 0;
        stvResult.time = (new Date().getTime()) - start;

        res._stvResponse.response.push(stvResult);

        res.json(res._stvResponse);

    }).populate('parent').populate('job');
});

router.get('/:fileId/list', function(req, res) {

    var stvResult = new STVResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;
    var type = req.query.type;
    var status = req.query.status;

    stvResult.id = fileId;
    var start = new Date().getTime();

    File.findOne({
        '_id': fileId
    }, function(err, file) {
        var end = new Date().getTime();

        stvResult.results = file.files;

        stvResult.dbTime = new Date().getTime() - start;

        stvResult.numResults = file.files.length;
        stvResult.numTotalResults = file.files.length;
        stvResult.time = (new Date().getTime()) - start;

        res._stvResponse.response.push(stvResult);

        res.json(res._stvResponse);
    }).populate({
        path: 'files',
        populate: {
            path: 'job'
        }
    }).populate('job');
});

router.get('/:fileId/create-folder', function(req, res) {
    var stvResult = new STVResult();

    var fileId = req.params.fileId;
    var sid = req.query.sid;
    var name = req.query.name;


    stvResult.id = fileId;
    var start = new Date().getTime();

    File.findOne({
        '_id': fileId
    }, function(err, parent) {
        var folder = parent.hasFile(name);
        if (folder != null) {
            stvResult.results.push(folder);
            res._stvResponse.response.push(stvResult);
            res.json(res._stvResponse);
        } else {
            var folder = new File({
                name: name,
                user: parent.user,
                parent: parent._id,
                type: "FOLDER",
                path: parent.path + '/' + name
            });

            parent.files.push(folder);
            folder.save();
            parent.save();

            parent.user.save();
            folder.fsCreateFolder(parent);

            var end = new Date().getTime();

            stvResult.results.push(folder);

            stvResult.dbTime = new Date().getTime() - start;

            stvResult.numResults = 1;
            stvResult.numTotalResults = 1;
            stvResult.time = (new Date().getTime()) - start;

            res._stvResponse.response.push(stvResult);

            res.json(res._stvResponse);
        }

        // var newFolder = parent.createFolder(name);
    }).populate("user").populate('files');
});

/******************************/
/******** Upload file *********/
/******************************/

/******************************/
/******************************/
router.post('/upload', function(req, res, next) {
    console.log(req.query.parentId);
    File.findOne({
        '_id': req.query.parentId
    }, function(err, parent) {
        req._parent = parent;
        next();
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
    var file = new File({
        name: fields.name,
        user: parent.user,
        parent: parent._id,
        type: "FILE",
        path: parent.path + '/' + fields.name
    });

    parent.files.push(file);
    file.save();
    parent.save();

    parent.user.save();

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
