var config = require('../config.json');
var multiparty = require('multiparty');
var fs = require('fs');

var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const File = mongoose.model('File');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});


router.get('/create', function(req, res) {
    // const user = new User(req.query);
    // console.log(user);
    // console.log(user.save(function(err) {
    //     if (err) {
    //         console.log("error: " + err)
    //     }
    // }));
    res.send('user works!!!!!');
});

router.delete('/delete', function(req, res) {
    // User.findOne({
    //     'email': req.query.email
    // }, function(err, user) {
    //     if (err) return handleError(err);
    //     console.log(user);
    //     user.save();
    //
    //     res.send(user);
    // });
});

router.get('/:fileId/get', function(req, res) {
    // User.findOne({
    //     'email': req.params.email
    // }, function(err, user) {
    //     res.send(user);
    // });
});

/******************************/
/******** Upload file *********/
/******************************/

/******************************/
/******************************/
router.post('/upload', function(req, res, next) {
    console.log('one');
    var fields = {};
    var stream;
    var form = new multiparty.Form({
        autoFields: true
    });

    // Fields
    form.on('field', function(name, value) {
        console.log(name + ': ' + value);
        fields[name] = value;
    });

    //Files, should be only one;
    form.on('part', function(part) {
        var path = config.dirname;
        var uploadPath = path + fields.name + "_partial";
        try {
            fs.mkdirSync(uploadPath);
        } catch (e) {
            console.log('Upload: ' + uploadPath + ' ' + 'already created');
        }
        var filepath = uploadPath + '/' + fields.chunk_id + "_" + fields.chunk_size + "_partial";
        var writeStream = fs.createWriteStream(filepath);
        part.pipe(writeStream);


        if(fields.last_chunk === 'true'){
            // TODO join all files maybe using for with pipe ??
        }
    });

    form.on('close', function() {
        req._multipartFields = fields;
        req._multipartStream = stream;
        next();
    });

    form.parse(req);

}, function(req, res, next) {
    var multipartFields = req._multipartFields;
    console.log(multipartFields);
    if (multipartFields.resume_upload === 'true') {
        // TODO get file dir with multipartFields.parentId
        var path = config.dirname;
        var uploadPath = path + multipartFields.name + "_partial";
        console.log('uploadPath:' + uploadPath);
        res.setHeader('Content-Type', 'application/json');
        res.send(getResumeFileInfo(uploadPath));
    } else {
        next();
    }
}, function(req, res) {
    console.log('three');
    res.send({});// TODO return file model

    // res.send('upload');
    // console.log(path);
    // User.findOne({
    //     'email': req.params.email
    // }, function(err, user) {
    //     res.send(user);
    // });
});
/******************************/
/******************************/
function getResumeFileInfo(path) {
    var info = {};
    try {
        fs.accessSync(path);
        var stats = fs.statSync(path);
        if (stats.isDirectory()) {
            console.log('is directory !!!!');
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


module.exports = router;
