#!/usr/bin/env node

const config = require('../config.json');
const checkconfig = require('../lib/checkconfig.js');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const async = require('async');

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');

var supertest = require('supertest');
request = supertest('http://localhost:' + config.httpPort);

var args = process.argv.slice(2);

var user = args[0];
var name = args[1];
var folder = args[2];
var execution = args[3];
if(execution == null || (execution != null && execution.trim() == "")){
    execution = "report"
}

if (shell.test('-d', folder)) {
    var reportPath = path.join(folder, 'report.xml');
    if (shell.test('-e', reportPath)) {

        var db = mongoose.createConnection(config.mongodb);
        async.waterfall([
            function (cb) {
                db.once('open', function () {
                    var File = db.model('File');
                    var User = db.model('User');
                    var Job = db.model('Job');
                    User.findOne({
                            'name': user
                        },
                        function (err, user) {
                            if (user != null) {
                                cb(null, user);
                            } else {
                                cb('User name not found')
                            }
                        }).select('+password');
                });
            },
            function (user, cb) {
                request
                    .get(config.urlPathPrefix + '/users/' + user.name + '/login')
                    .set('Authorization', 'sid ' + user.password)
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function (err, res) {
                        var sid = res.body.response[0].results[0].id;
                        cb(null, user, sid)
                    });
            },
            function (user, sid, cb) {
                var jobargs = {
                    tool: 'utils',
                    execution: execution,
                    executable: 'copy-report-folder.sh',
                    options: {
                        "directory": {
                            "type": "text",
                            "value": folder
                        },
                        "output-directory": {
                            out: true,
                        }
                    }
                };
                request
                    .post(config.urlPathPrefix + '/jobs/create?name=' + name)
                    .send(jobargs)
                    .set('Authorization', 'sid ' + sid)
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function (err, res) {
                        var job = res.body.response[0].results[0];
                        cb(null, user, sid, job)
                    });
            },
            function (user, sid, job, cb) {
                request
                    .get(config.urlPathPrefix + '/users/' + user.name + '/logout')
                    .set('Authorization', 'sid ' + sid)
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function (err, res) {
                        cb(null);
                    });
            },
        ], function (err) {
            if (err) {
                console.log(err);
            }
            db.close();
        });
    } else {
        console.log('Report file not found')
    }
} else {
    console.log('Folder not found')
}
