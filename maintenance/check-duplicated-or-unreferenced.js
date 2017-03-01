#!/usr/bin/env node

const config = require('../config.json');
const checkconfig = require('../lib/checkconfig.js');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const async = require('async');
var util = require('util')

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');

var supertest = require('supertest');
request = supertest('http://localhost:' + config.httpPort);

var args = process.argv.slice(2);

var db = mongoose.createConnection(config.mongodb);
db.once('open', function () {
    var File = db.model('File');
    var User = db.model('User');
    var Job = db.model('Job');

    var userIdsToFindMap = {};
    var userIdsToFind = [];
    var jobs;
    var jobsMap = {};
    var files;
    var filesMap = {};
    var users;
    var usersMap = {};
    async.series([
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       User count                //')
            console.log('/////////////////////////////////////')
            User.find({}, {
                _id: 1
            }, function (err, results) {
                users = results;
                console.log("Number of users:", results.length);
                for (var i = 0; i < results.length; i++) {
                    var u = results[i];
                    usersMap[u._id.toString()] = true;
                }
                cb();
            });
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       File count                //')
            console.log('/////////////////////////////////////')
            File.find({}, function (err, results) {
                files = results;
                console.log("Number of files: " + results.length);
                for (var i = 0; i < results.length; i++) {
                    var f = results[i];
                    filesMap[f._id.toString()] = true;
                }
                cb();
            });
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       Job count                 //')
            console.log('/////////////////////////////////////')
            Job.find({}, function (err, results) {
                jobs = results;
                console.log("Number of Jobs: " + results.length);
                for (var i = 0; i < results.length; i++) {
                    var j = results[i];
                    jobsMap[j._id.toString()] = true;
                }
                cb();
            });
            console.log('')
            console.log('/////////////////////////////////////')
            console.log('/////////////////////////////////////')
            console.log('')
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//   Folder children files check   //')
            console.log('/////////////////////////////////////')
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (Array.isArray(f.files)) {
                    for (var j = 0; j < f.files.length; j++) {
                        var ff = f.files[j];
                        if (filesMap[ff.toString()] != true) {
                            console.log('File id: ' + ff + ' inside Folder: ' + f.path + ' not found.');
                        }
                    }
                }
            }
            cb();
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       File path check           //')
            console.log('/////////////////////////////////////')
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                var realPath = path.join(config.steviaDir, config.usersPath, f.path);
                if (shell.test('-e', realPath) == false) {
                    console.log(realPath);
                }
            }
            cb();
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       Job user check            //')
            console.log('/////////////////////////////////////')
            for (var i = 0; i < jobs.length; i++) {
                var j = jobs[i];
                if (usersMap[j.user.toString()] != true) {
                    console.log('Job user ' + j.user + ' not found for Job id: ' + j._id + ', Job name:' + j.name);
                }
            }
            cb();
        }
    ], function (err) {
        console.log('');
        console.log('');
        if (err) {
            console.log(err);
        }
        db.close();
    });

});
