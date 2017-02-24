#!/usr/bin/env node

const config = require('../config.json');
const checkconfig = require('../lib/checkconfig.js');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const async = require('async');
var util = require('util')

const mongoose = require("mongoose");
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
    var files;
    var users;
    async.series([
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       User count                //')
            console.log('/////////////////////////////////////')
            User.count({}, function (err, count) {
                console.log("Number of users:", count);
                cb();
            });
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       Job user check            //')
            console.log('/////////////////////////////////////')
            Job.find({}, function (err, results) {
                jobs = results;
                console.log("Jobs length: " + results.length);
                for (var i = 0; i < results.length; i++) {
                    var j = results[i];
                    userIdsToFindMap[j.user.toString()] = true;
                }
                userIdsToFind = Object.keys(userIdsToFindMap);
                console.log("Users with jobs length: " + userIdsToFind.length);
                cb();
            });
        },
        function (cb) {
            async.each(userIdsToFind, function (u, eachcb) {
                User.findOne({
                    "_id": u
                }, function (err, result) {
                    if (result == null) {
                        console.log("Error job user not found," + j._id);
                    } else {
                        // console.log('OK user found: '+ result._id);
                    }
                    eachcb();
                });
            }, function (err) {
                cb();
            });
        },
        function (cb) {
            console.log('');
            console.log('/////////////////////////////////////')
            console.log('//       File user check           //')
            console.log('/////////////////////////////////////')
            File.find({}, function (err, results) {
                files = results;
                console.log("Files length: " + results.length);
                for (var i = 0; i < results.length; i++) {
                    var f = results[i];
                    userIdsToFindMap[f.user.toString()] = true;
                }
                userIdsToFind = Object.keys(userIdsToFindMap);
                console.log("Users with files length: " + userIdsToFind.length);
                cb();
            });
        },
        function (cb) {
            async.each(userIdsToFind, function (u, eachcb) {
                User.findOne({
                    "_id": u
                }, function (err, result) {
                    if (result == null) {
                        console.log("Error user not found," + u);
                    } else {
                        // console.log('OK user found: '+ result._id);
                    }
                    eachcb();
                });
            }, function (err) {
                cb();
            });
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
