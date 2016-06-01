const config = require('../config.json');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');

const mongoose = require("mongoose");
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

var supertest = require('supertest');
request = supertest('http://localhost:5555');
var test = require('tape');

var USER_ID;
var SID;
var HOMEFOLDER_ID;
var UPLOADED_FILE_ID;

/* ----- */
/* USER */
/* ----- */

test('user create', function (t) {
    request
        .get('/users/create?email=test@test.com')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            // t.equal(res.body.response[0].error, undefined);

            var db = mongoose.connect(config.mongodb, function () {
                User.findOne({
                        'email': 'test@test.com'
                    },
                    function (err, user) {
                        mongoose.disconnect();
                        t.error(err, 'No error');
                        t.not(user, null);
                        USER_ID = user._id;
                        var userPath = path.join(config.steviaDir, config.usersPath, 'test@test.com');
                        t.true(shell.test('-d', userPath), "Directory exists");
                        t.end();
                    }).populate('home');
            });
        });
});

test('user login', function (t) {
    request
        .get('/users/test@test.com/login')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.not(res.body.response[0].results[0].id, undefined);
            t.not(res.body.response[0].results[0].date, undefined);
            SID = res.body.response[0].results[0].id;
            // console.log(sid)

            t.end();

        });
});

test('user info', function (t) {
    request
        .get('/users/test@test.com/info')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.not(res.body.response[0].results[0].tree, undefined);
            t.equal(res.body.response[0].results[0].email, 'test@test.com')
            HOMEFOLDER_ID = res.body.response[0].results[0].home._id;

            t.end();
        });
});

test('user change password', function (t) {
    request
        .get('/users/test@test.com/change-password')
        .set('Authorization', 'sid ' + SID)
        .set('x-stv-1', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .set('x-stv-2', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

/* ----- */
/* FILES */
/* ----- */

test('file create', function (t) {

    var filePath = path.join(__dirname, 'test-file.txt');
    // var filePath = './test/Leaf_icon_03.svg.png';
    var stats = fs.statSync(filePath);

    var name = path.basename(filePath);
    var parentId = HOMEFOLDER_ID;
    // var userId = args.userId;
    var format;
    var bioFormat = 'NONE';
    var callbackProgress = function (chunk, total, chunkResponse) {
        // var percentProgress = Math.round((chunk.id / total) * 100);
        if (chunk.last) {
            // console.log(chunkResponse)
            UPLOADED_FILE_ID = chunkResponse.file._id;
            t.comment("file._id: " + UPLOADED_FILE_ID);
            var uploadedFilePath = path.join(config.steviaDir, config.usersPath, chunkResponse.file.path);
            t.true(shell.test('-e', uploadedFilePath), "File exists");
            var uploadStats = fs.statSync(uploadedFilePath);
            t.true(stats.size === uploadStats.size, "File size is the same");
            t.end();
        }
    };
    var callbackExists = function (file) {
        UPLOADED_FILE_ID = file._id;
        var uploadedFilePath = path.join(config.steviaDir, config.usersPath, file.path);
        t.true(shell.test('-e', uploadedFilePath), "File exists");
        var uploadStats = fs.statSync(uploadedFilePath);
        t.true(stats.size === uploadStats.size, "File size is the same");
        t.end();
    };

    var resume = true;
    var resumeInfo = {};
    var chunkMap = {};
    var chunkId = 0;
    var start;
    var end;

    /**/
    var resumeResponse;
    /**/

    var getResumeInfo = function (callback) {
        request
            .post('/files/upload?name=' + name + '&parentId=' + parentId)
            .set('Authorization', 'sid ' + SID)
            .field('resume_upload', resume.toString())
            .field('chunk_map', JSON.stringify(chunkMap))
            .field('name', name)
            .field('parentId', parentId)
            .expect(200)
            .end(function (err, res) {
                callback(res.body);
            });
    };
    var uploadChunk = function (buffer, bytesRead, chunk, callback) {
        var requestPost = request.post('/files/upload?name=' + name + '&parentId=' + parentId);

        requestPost
            .set('Authorization', 'sid ' + SID)
            .field('chunk_id', chunk.id)
            .field('chunk_size', bytesRead)
            // .field('chunk_hash', hash)
            .field('name', name)
            // .field('userId', userId);
            .field('parentId', parentId);
        // .field('chunk_gzip', )

        if (chunk.last) {
            requestPost
                .field('last_chunk', 'true')
                .field('total_size', SIZE)
                // .field('format', '')
                .field('bioFormat', bioFormat);
        }

        requestPost
            .attach('chunk_content', buffer, "blob")
            .expect(200)
            .end(function (err, res) {
                chunk.done = true;
                // console.log('chunk ' + chunk.id + ' done');
                callback(res.body);
            });
    };
    var checkChunk = function (id, size) {
        if (typeof resumeInfo[id] === 'undefined') {
            return false;
        } else if (resumeInfo[id].size != size /*|| resumeInfo[id].hash != hash*/ ) {
            return false;
        }
        return true;
    };

    var processChunk = function (c) {
        // var chunkBlob = blob.slice(c.start, c.end);
        var buffer = new Buffer(c.size);
        var fd = fs.openSync(filePath, 'r');
        var bytesRead = fs.readSync(fd, buffer, 0, c.size, c.start);

        // console.log(c);
        if (checkChunk(c.id, bytesRead) == false) {
            // console.log('chunk ' + c.id + ' not uploaded');
            uploadChunk(buffer, bytesRead, c, function (chunkResponse) {
                callbackProgress(c, NUM_CHUNKS, chunkResponse);
                if (!c.last) {
                    processChunk(chunkMap[(c.id + 1)]);
                } else {

                }
            });
        } else {
            // console.log('chunk ' + c.id + ' already uploaded');
            callbackProgress(c, NUM_CHUNKS, resumeResponse);
            if (!c.last) {
                processChunk(chunkMap[(c.id + 1)]);
            } else {

            }
        }

    };
    /**/

    // var BYTES_PER_CHUNK = 4 * 1024 * 1024;
    var BYTES_PER_CHUNK = 5;
    var SIZE = stats.size;
    var NUM_CHUNKS = Math.max(Math.ceil(SIZE / BYTES_PER_CHUNK), 1);

    start = 0;
    end = BYTES_PER_CHUNK;
    while (start < SIZE) {
        var last = false;
        if (chunkId == (NUM_CHUNKS - 1)) {
            last = true;
        }
        chunkMap[chunkId] = {
            id: chunkId,
            start: start,
            end: end,
            size: end - start,
            done: false,
            last: last
        };
        start = end;
        end = start + BYTES_PER_CHUNK;
        if (end > SIZE) {
            end = SIZE;
        }
        chunkId++;
    }
    // console.log(chunkMap)

    if (resume) {
        getResumeInfo(function (response) {
            if (response.error == null) {
                // console.log(response)
                resumeInfo = response.resumeInfo;
                resumeResponse = response;
                if (response.exists) {
                    callbackExists(response.file);
                } else {
                    setTimeout(function () {
                        processChunk(chunkMap[0]);
                    }, 50);
                }
            } else {
                // console.log(response.error)
            }
        });
    }
});

test('file delete', function (t) {
    request
        .get('/files/' + UPLOADED_FILE_ID + '/delete')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

/* ----- */
/* LOGOUT */
/* ----- */
test('user logout', function (t) {
    request
    // .get('/users/test@test.com/logout?logoutOther=true')
        .get('/users/test@test.com/logout')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

test('delete user', function (t) {
    var deleteUser = require('../manteinance/delete-user-module.js');
    deleteUser(USER_ID);
    t.end();
});
