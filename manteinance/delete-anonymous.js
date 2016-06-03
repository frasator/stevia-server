var config = require('../config.json');
var mongoose = require("mongoose");
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

const shell = require('shelljs');

var conn = mongoose.connect(config.mongodb, function () {

    User.find({
            'email': {
                $regex: new RegExp('^' + 'anonymous_')
            }
        },
        function (err, users) {
            console.log(users.length);
            var ids = [];
            for (var i = 0; i < users.length; i++) {
                var user = users[i];
                ids.push(user._id);

                var realPath = path.join(config.steviaDir, config.usersPath, user.email);
                try {
                    shell.rm('-rf', realPath);
                } catch (e) {
                    console.log("File fsDelete: file not exists on file system")
                }
            }
            // console.log("asdf");
            // console.log(ids);
            // User.remove({
            //     "id": {
            //         $in: ids
            //     }
            // }, function (err, a) {
            //     console.log(err);
            //     console.log(a);
            //     console.log('done');
            // });
            var count = 3;
            User.where('_id').in(ids).remove().exec(function () {
                count--;
                if (count == 0) {
                    conn.close(function () {});
                }
            });
            File.where('user').in(ids).remove().exec(function () {
                count--;
                if (count == 0) {
                    conn.close(function () {});
                }
            });
            Job.where('user').in(ids).remove().exec(function () {
                count--;
                if (count == 0) {
                    conn.close(function () {});
                }
            });

        }).populate('home');

}).connection;

//
