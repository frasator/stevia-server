var config = require('../config.json');
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');

const shell = require('shelljs');
const path = require('path');

function runDelete(ids, callback) {
    var db = mongoose.createConnection(config.mongodb);
    db.once('open', function () {
        var File = db.model('File');
        var User = db.model('User');
        var Job = db.model('Job');
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

                        var realPath = path.join(config.steviaDir, config.usersPath, user.name);
                        try {
                            if (shell.test('-e', realPath)) {
                                shell.rm('-rf', realPath);
                            }
                        } catch (e) {
                            console.log("File fsDelete: file not exists on file system")
                        }
                    }

                    var count = 3;
                    User.where('_id').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            db.close();
                            callback();
                        }
                    });
                    File.where('user').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            db.close();
                            callback();
                        }
                    });
                    Job.where('user').in(ids).remove().exec(function () {
                        count--;
                        if (count == 0) {
                            db.close();
                            callback();
                        }
                    });
                } else {
                    console.log(err);
                    db.close();
                    callback();
                }
            }).populate('home');
    });
};

module.exports = runDelete;
