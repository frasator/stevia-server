var config = require('../config.json');
var mongoose = require("mongoose");
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

const shell = require('shelljs');
const path = require('path');


function runDelete(ids, callback) {
    var conn = mongoose.connect(config.mongodb, function () {
        User.find({
                '_id': {
                    $in: ids
                }
            },
            function (err, users) {
                if (users != null) {
                    console.log('Users found to delete: ' + users.length);
                    for (var i = 0; i < users.length; i++) {
                        var user = users[i];

                        var realPath = path.join(config.steviaDir, config.usersPath, user.email);
                        try {
                            shell.rm('-rf', realPath);
                        } catch (e) {
                            console.log("File fsDelete: file not exists on file system")
                        }
                    }

                    var count = 3;
                    User.where('_id').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            conn.close(function(){
                                callback();
                            });
                        }
                    });
                    File.where('user').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            conn.close(function(){
                                callback();
                            });;
                        }
                    });
                    Job.where('user').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            conn.close(function(){
                                callback();
                            });
                        }
                    });
                }else{
                    console.log(err);
                    conn.close(function(){
                        callback();
                    });
                }

            }).populate('home');
    }).connection;
};

module.exports = runDelete;
