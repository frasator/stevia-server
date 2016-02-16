var config = require('../config.json');
var multiparty = require('multiparty');
var rimraf = require('rimraf');
var fs = require('fs');
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


router.get('/create', function(req, res, next) {

    var name = req.query.name;
    var parentId = req.query.parentId;
    var type = req.query.type;

    var file = new File(req.query);

    if (parentId != null) {
        File.getFile(parentId, function(err, parent) {
            if (err) {
                console.log("error")
            } else {
                console.log(parent);
                if (parent.type === "FOLDER") {

                    file.parent = parent;
                    parent.addFile(file);
                    parent.save();
                    file.save();
                    res.json(file);

                } else {
                    res.json({
                        error: "PARENT is not a folder"
                    })
                }
            }
        });
    } else {
        file.save();
        res.json(file);
    }

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

        file.removeChilds();
        file.remove();

        stvResult.results = [];

        stvResult.dbTime = new Date().getTime() - start;

        stvResult.numResults = 0;
        stvResult.numTotalResults = 0;
        stvResult.time = (new Date().getTime()) - start;

        res._stvResponse.response.push(stvResult);

        res.json(res._stvResponse);
    }).populate('parent');
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
    }).populate('files');
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

        // var newFolder = parent.createFolder(name);

        var folder = new File({
            name: name,
            user: parent.user,
            parent: parent._id,
            type: "FOLDER"
        });

        parent.files.push(folder);
        folder.save();
        parent.save();

        parent.user.save();

        var end = new Date().getTime();

        stvResult.results.push(folder);

        stvResult.dbTime = new Date().getTime() - start;

        stvResult.numResults = 1;
        stvResult.numTotalResults = 1;
        stvResult.time = (new Date().getTime()) - start;

        res._stvResponse.response.push(stvResult);

        res.json(res._stvResponse);
    }).populate("user");
});

/******************************/
/******** Upload file *********/
/******************************/

/******************************/
/******************************/
router.post('/upload', function(req, res, next) {
    var fields = {};
    var stream;
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
        var path = config.steviaDir; // TODO get file dir with multipartFields.parentId
        var uploadPath = path + fields.name + "_partial";
        try {
            fs.mkdirSync(uploadPath);
        } catch (e) {
            console.log('Upload: ' + uploadPath + ' ' + 'already created');
        }
        var filepath = uploadPath + '/' + fields.chunk_id + "_" + fields.chunk_size + "_partial";
        var writeStream = fs.createWriteStream(filepath);
        part.pipe(writeStream);
        writeStream.on('finish', function() {
            var stats = fs.statSync(filepath);
            console.log('Chunk ' + fields.chunk_id + ' created. Chunk size: ' + stats.size);

            if (fields.last_chunk === 'true') {
                console.log('Chunk ' + fields.chunk_id + ' is the last');
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
                File.findOne({
                    '_id': fields.parentId
                }, function(err, parent) {

                    var file = new File({
                        name: fields.name,
                        user: parent.user,
                        parent: parent._id,
                        type: "FILE"
                    });

                    parent.files.push(file);
                    file.save();
                    parent.save();

                    parent.user.save();

                    var stvResult = new STVResult();
                    stvResult.results.push(file);

                    stvResult.dbTime = -1;

                    stvResult.numResults = 1;
                    stvResult.numTotalResults = 1;
                    stvResult.time = -1;

                    res._stvResponse.response.push(stvResult);

                    rimraf(uploadPath, function() {
                        console.log('Temporal upload folder ' + uploadPath + ' removed');
                        res.json(res._stvResponse);
                    });
                }).populate("user");

            } else {
                res.send({});
            }
        });
    });

    form.on('close', function() {
        req._multipartFields = fields;
        var path = config.dirname; // TODO get file dir with multipartFields.parentId
        var uploadPath = path + fields.name + "_partial";
        if (fields.resume_upload === 'true') {
            res.setHeader('Content-Type', 'application/json');
            res.send(getResumeFileInfo(uploadPath));
        }
    });
    form.parse(req);
});

/******************************/
/******************************/
function getResumeFileInfo(path) {
    var info = {};
    try {
        fs.accessSync(path);
        var stats = fs.statSync(path);
        if (stats.isDirectory()) {
            var filesInFolder = fs.readdirSync(path);
            for (var i = 0; i < filesInFolder.length; i++) {
                var file = filesInFolder[i];
                var nameSplit = file.split("_");
                info[nameSplit[0]] = {
                    size: nameSplit[1]
                };
            }
        }
    } catch (e) {
        console.log('Resume upload: ' + e.message);
        console.log('Resume upload: ' + 'Nothing to resume');
    }
    return info;
};

function getSortedChunkList(path) {
    var files, chunkId, file, nameSplit;
    try {
        fs.accessSync(path);
        var stats = fs.statSync(path);
        if (stats.isDirectory()) {
            files = [];
            var filesInFolder = fs.readdirSync(path);
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
}


module.exports = router;
