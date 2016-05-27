var config = require('../config.json');
var mongoose = require("mongoose");
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

var args = process.argv.slice(2);
const shell = require('shelljs');

var db = mongoose.connect(config.mongodb, function () {

    User.find({
            '_id': {
                $in: args
            }
        },
        function (err, users) {
            for (var i = 0; i < users.length; i++) {
                var user = users[i];

                var userspath = config.steviaDir + config.usersPath;
                var realPath = userspath + user.email;
                try {
                    shell.rm('-rf', realPath);
                } catch (e) {
                    console.log("File fsDelete: file not exists on file system")
                }
            }

            var count = 3;
            User.where('_id').in(args).remove().exec(function () {
                count--;
                if (count == 0) {
                    mongoose.disconnect();
                }
            });
            File.where('user').in(args).remove().exec(function () {
                count--;
                if (count == 0) {
                    mongoose.disconnect();
                }
            });
            Job.where('user').in(args).remove().exec(function () {
                count--;
                if (count == 0) {
                    mongoose.disconnect();
                }
            });

        }).populate('home');
});

//
