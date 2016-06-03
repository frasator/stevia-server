const config = require('../config.json');
const checkconfig = require('../lib/checkconfig.js');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const net = require('net');

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
var UPLOADED_FILE;
var USER_EMAIL = "test@test.com";

portInUse(config.httpPort, function (returnValue) {
    if (returnValue == false) {
        console.log('');
        console.log('Server must be started to run tests !!');
        console.log('Please run bin/start');
        console.log('-------------------------------------');
        console.log('');
        process.exit();
    }
});

test('delete user', function (t) {
    getUserByEmail(USER_EMAIL, function (err, user) {
        if (user != null) {
            var deleteUser = require('../manteinance/delete-user-module.js');
            deleteUser([user._id], function () {
                getUserByEmail(USER_EMAIL, function (err, user) {
                    t.is(user, null);
                    t.end();
                });
            });
        }else{
            t.end();
        }
    });
});

/* ----- */
/* USER */
/* ----- */
test('user create', function (t) {
    request
        .get('/users/create?email=' + USER_EMAIL)
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            // t.equal(res.body.response[0].error, undefined);
            getUserByEmail(USER_EMAIL, function (err, user) {
                t.isNot(user, null);
                USER_ID = user._id;
                var userPath = path.join(config.steviaDir, config.usersPath, USER_EMAIL);
                t.true(shell.test('-d', userPath), "Directory exists");
                t.end();
            });
        });
});

test('user login', function (t) {
    request
        .get('/users/' + USER_EMAIL + '/login')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
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
        .get('/users/' + USER_EMAIL + '/info')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);

            t.not(res.body.response[0].results[0].tree, undefined);
            t.equal(res.body.response[0].results[0].email, USER_EMAIL)
            HOMEFOLDER_ID = res.body.response[0].results[0].home._id;

            t.end();
        });
});

test('user change password', function (t) {
    request
        .get('/users/' + USER_EMAIL + '/change-password')
        .set('Authorization', 'sid ' + SID)
        .set('x-stv-1', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .set('x-stv-2', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

/* ----- */
/* FILES */
/* ----- */

test('file upload', function (t) {

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
            UPLOADED_FILE = chunkResponse.file;
            t.comment("file._id: " + UPLOADED_FILE._id);
            var uploadedFilePath = path.join(config.steviaDir, config.usersPath, chunkResponse.file.path);
            t.true(shell.test('-e', uploadedFilePath), "Check file system file");
            var uploadStats = fs.statSync(uploadedFilePath);
            t.true(stats.size === uploadStats.size, "Check file size");
            getFileById(UPLOADED_FILE._id, function (err, file) {
                t.isNot(file, null);
            });
            t.end();
        }
    };
    var callbackExists = function (file) {
        UPLOADED_FILE = file;
        var uploadedFilePath = path.join(config.steviaDir, config.usersPath, file.path);
        t.true(shell.test('-e', uploadedFilePath), "Check file system file");
        var uploadStats = fs.statSync(uploadedFilePath);
        t.true(stats.size === uploadStats.size, "Check file size");
        getFileById(UPLOADED_FILE._id, function (err, file) {
            t.isNot(file, null);
        });
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
    var BYTES_PER_CHUNK = 10;
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

test('file list - folder', function (t) {
    request
        .get('/files/' + HOMEFOLDER_ID + '/list')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            t.equal(res.body.response[0].results[0]._id, HOMEFOLDER_ID);
            t.ok(Array.isArray(res.body.response[0].results[0].files), 'is Array');
            t.equal(res.body.response[0].results[0].type, "FOLDER");
            t.end();
        });
});

test('file list - file', function (t) {
    request
        .get('/files/' + UPLOADED_FILE._id + '/list')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            t.equal(res.body.response[0].results[0]._id, UPLOADED_FILE._id);
            t.ok(Array.isArray(res.body.response[0].results[0].files), 'is Array');
            t.equal(res.body.response[0].results[0].type, "FILE");
            t.end();
        });
});

test('file info', function (t) {
    request
        .get('/files/' + UPLOADED_FILE._id + '/info')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            t.equal(res.body.response[0].results[0]._id, UPLOADED_FILE._id);
            t.ok(Array.isArray(res.body.response[0].results[0].files), 'is Array');
            t.end();
        });
});
test('file files', function (t) {
    request
        .get('/files/' + HOMEFOLDER_ID + '/files')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            t.ok(Array.isArray(res.body.response[0].results), 'is Array');
            for (var i = 0; i < res.body.response[0].results.length; i++) {
                var f = res.body.response[0].results[i];
                var filePath = path.join(config.steviaDir, config.usersPath, f.path);
                t.true(shell.test('-e', filePath), "File exists");
            }
            t.end();
        });
});

var FOLDER
test('file create-folder', function (t) {
    var folderName = "myfolder";
    request
        .get('/files/' + HOMEFOLDER_ID + '/create-folder?name=' + folderName)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            var f = res.body.response[0].results[0];
            t.not(f, null);
            t.equal(f.name, folderName);
            var filePath = path.join(config.steviaDir, config.usersPath, f.path);
            t.true(shell.test('-d', filePath), "Folder exists");
            FOLDER = f;

            getFileById(FOLDER._id, function (err, file) {
                t.isNot(file, null);
                t.end();
            });

        });
});
var FOLDER2
test('file create-folder2', function (t) {
    var folderName = "mysubfolder";
    request
        .get('/files/' + FOLDER._id + '/create-folder?name=' + folderName)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            var f = res.body.response[0].results[0];
            t.not(f, null);
            t.equal(f.name, folderName);
            var filePath = path.join(config.steviaDir, config.usersPath, f.path);
            t.true(shell.test('-d', filePath), "Folder exists");
            FOLDER2 = f;

            getFileById(FOLDER2._id, function (err, file) {
                t.isNot(file, null);
                t.end();
            });

        });
});

test('file content', function (t) {
    request
        .get('/files/' + UPLOADED_FILE._id + '/content')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /text/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);

            getFileById(UPLOADED_FILE._id, function (err, file) {
                t.is(err, null);
                t.not(file, null);
                var filePath = path.join(config.steviaDir, config.usersPath, file.path);
                t.true(shell.test('-e', filePath), "Check file system file");
                var stats = fs.statSync(filePath);
                t.true(stats.size === res.text.length + 1, "Check file size");
                t.end();
            });
        });
});

test('file content-example', function (t) {
    request
        .get('/files/content-example?tool=test-tool&file=test.txt')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /text/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
            var filePath = path.join(config.steviaDir, config.toolsPath, 'test-tool', 'examples', 'test.txt');
            t.true(shell.test('-e', filePath), "Check file system file");
            var stats = fs.statSync(filePath);
            t.true(stats.size === res.text.length + 1, "Check file size");
            t.end();
        });
});

test('file download', function (t) {
    request
        .get('/files/' + UPLOADED_FILE._id + '/download')
        .set('Authorization', 'sid ' + SID)
        .expect('content-disposition', /attachment/)
        .expect('content-disposition', /filename/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
            getFileById(UPLOADED_FILE._id, function (err, file) {
                t.is(err, null);
                t.not(file, null);
                var filePath = path.join(config.steviaDir, config.usersPath, file.path);
                t.true(shell.test('-e', filePath), "Check file system file");
                var stats = fs.statSync(filePath);
                t.true(stats.size === res.text.length, "Check file size");
                t.end();

            });
        });
});

test('file download-example', function (t) {
    request
        .get('/files/download-example?tool=test-tool&file=test.txt')
        .set('Authorization', 'sid ' + SID)
        .expect('content-disposition', /attachment/)
        .expect('content-disposition', /filename/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
            var filePath = path.join(config.steviaDir, config.toolsPath, 'test-tool', 'examples', 'test.txt');
            t.true(shell.test('-e', filePath), "Check file system file");
            var stats = fs.statSync(filePath);
            t.true(stats.size === res.text.length, "Check file size");
            t.end();
        });
});

test('file add-attribute', function (t) {
    var attributes = {
        foo: 'foo',
        bar: 'bar'
    };
    request
        .post('/files/' + UPLOADED_FILE._id + '/add-attribute')
        .send(attributes)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
            // console.log(res.body.response[0].results[0])
            var f = res.body.response[0].results[0];
            t.not(f, null);
            for (var key in attributes) {
                t.not(f.attributes[key], null);
                t.true(JSON.stringify(f.attributes[key]) == JSON.stringify(attributes[key]), 'Check attribute');
            }
            t.end();
        });
});
test('file move down', function (t) {
    var fileId = UPLOADED_FILE._id;
    var newParentId = FOLDER2._id;
    request
        .get('/files/move?fileId=' + fileId + "&newId=" + newParentId)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response)
            var filePath = path.join(config.steviaDir, config.usersPath, FOLDER2.path, UPLOADED_FILE.name);
            getFileById(fileId, function (err, file) {
                t.is(err, null);
                t.not(file, null);
                var filePathDb = path.join(config.steviaDir, config.usersPath, file.path).toString();
                t.true(filePath == filePathDb, "Check database path");
                t.true(shell.test('-e', filePath), "Check file system file");
                t.end();

            });
        });
});
test('file move up', function (t) {
    var fileId = FOLDER2._id;
    var newParentId = HOMEFOLDER_ID;
    request
        .get('/files/move?fileId=' + fileId + "&newId=" + newParentId)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response)
            var filePath = path.join(config.steviaDir, config.usersPath, USER_EMAIL, FOLDER2.name);
            getFileById(fileId, function (err, file) {
                t.is(err, null);
                t.not(file, null);
                var filePathDb = path.join(config.steviaDir, config.usersPath, file.path).toString();
                t.true(filePath == filePathDb, "Check database path");
                t.true(shell.test('-e', filePath), "Check file system file");
                t.end();
            });
        });
});

test('file delete', function (t) {
    request
        .get('/files/' + UPLOADED_FILE._id + '/delete')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);

            getFileById(UPLOADED_FILE._id, function (err, file) {
                t.is(file, null);
            });

            t.end();
        });
});
test('folder delete', function (t) {
    var folderName = "myfolder";
    request
        .get('/files/' + FOLDER._id + '/delete')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            var filePath = path.join(config.steviaDir, config.usersPath, FOLDER.path);
            t.false(shell.test('-e', filePath), "Folder not exists");

            getFileById(FOLDER._id, function (err, file) {
                t.is(file, null);
            });

            t.end();
        });
});

/* ----- */
/* JOBS */
/* ----- */
var JOB
test('launch job ', function (t) {
    var args = {
        tool: 'test-tool',
        execution: 'test',
        executable: 'test.sh',
        options: {
            "output-directory": {
                out: true,
            },
            "bar": {
                type: 'flag'
            },
            "file1": {
                "type": "file",
                "mode": "example",
                "value": "test.txt"
            },
            "file2": {
                "type": "file",
                "mode": "id",
                "value": UPLOADED_FILE._id
            },
            "param1": {
                "type": "text",
                "value": "param1_value"
            }
        }
    };
    request
        .post('/jobs/create?name=test-job&description=TestingJobWS')
        .send(args)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0].results[0])
            t.is(err, null);
            t.is(res.body.response[0].error, undefined);
            var j = res.body.response[0].results[0];
            JOB = j;
            t.not(j, null);

            var jobPath = path.join(config.steviaDir, config.usersPath, j.folder.path);
            t.true(shell.test('-d', jobPath), "Folder exists");
            t.is('test-job', j.name);

            t.end();
        });
});
test('delete job ', function (t) {
    request
        .get('/jobs/delete?jobId=' + JOB._id)
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);
            getJobById(JOB._id, function (err, job) {
                t.is(job, null);
                t.end();
            });
        });
});

/* ----- */
/* LOGOUT */
/* ----- */
test('user logout', function (t) {
    request
    // .get('/users/'+USER_EMAIL+'/logout?logoutOther=true')
        .get('/users/' + USER_EMAIL + '/logout')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.is(err, null);
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

test('delete user', function (t) {
    var deleteUser = require('../manteinance/delete-user-module.js');
    deleteUser([USER_ID], function () {
        getUserById(USER_ID, function (err, user) {
            t.is(user, null);
            t.end();
        });
    });
});

/**************/
/*HELP METHODS*/
/**************/
function getFileById(id, callback) {
    var conn = mongoose.connect(config.mongodb, function () {
        File.findOne({
                '_id': id
            },
            function (err, doc) {
                conn.close(function () {
                    callback(err, doc);
                });
            }).populate('home');
    }).connection;
}

function getUserByEmail(query, callback) {
    var conn = mongoose.connect(config.mongodb, function () {
        User.findOne({
                'email': query
            },
            function (err, doc) {
                conn.close(function () {
                    callback(err, doc);
                });
            }).populate('home');
    }).connection;
}

function getUserById(id, callback) {
    var conn = mongoose.connect(config.mongodb, function () {
        User.findOne({
                '_id': id
            },
            function (err, doc) {
                conn.close(function () {
                    callback(err, doc);
                });
            });
    }).connection;
}

function getJobById(id, callback) {
    var conn = mongoose.connect(config.mongodb, function () {
        Job.findOne({
                '_id': id
            },
            function (err, doc) {
                conn.close(function () {
                    callback(err, doc);
                });
            });
    }).connection;
}

function portInUse(port, callback) {
    var server = net.createServer(function (socket) {
        socket.write('Echo server\r\n');
        socket.pipe(socket);
    });

    server.listen(port, '127.0.0.1');
    server.on('error', function (e) {
        callback(true);
    });
    server.on('listening', function (e) {
        server.close();
        callback(false);
    });
}
