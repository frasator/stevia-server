var config = require('../config.json');
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');

const shell = require('shelljs');
const path = require('path');

var db = mongoose.createConnection(config.mongodb);
db.once('open', function () {
    var File = db.model('File');
    var User = db.model('User');
    var Job = db.model('Job');

    User.find({
            'email': 'anonymous@anonymous.anonymous',
            'name': {
                $regex: new RegExp('^' + 'anonymous___')
            }
        },
        function (err, users) {
            console.log(users.length);
            var ids = [];
            for (var i = 0; i < users.length; i++) {
                var user = users[i];
                ids.push(user._id);

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
                }
            });
            File.where('user').in(ids).remove().exec(function () {
                count--;
                if (count == 0) {
                    db.close();
                }
            });
            Job.where('user').in(ids).remove().exec(function () {
                count--;
                if (count == 0) {
                    db.close();
                }
            });
        }).populate('home');
});
