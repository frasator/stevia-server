const config = require('../config.json');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');

var supertest = require('supertest');
request = supertest('http://localhost:' + config.httpPort);

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');

var args = process.argv.slice(2);
var USER_NAME = args[0];
var PASS;

var db = mongoose.createConnection(config.mongodb);
db.once('open', function () {
    var File = db.model('File');
    var User = db.model('User');
    var Job = db.model('Job');

    console.log(USER_NAME)
    User.findOne({
            'name': USER_NAME
        }, {
            _id:1,
            password: 1,
            name:1
        },
        function (err, user) {
            console.log("User   id: " + user._id);
            console.log("User name: " + user.name);
            request
                .get(config.urlPathPrefix + '/users/' + user.name + '/login')
                .set('Authorization', 'sid ' + user.password)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function (err, res) {
                    console.log("User  sid: " + res.body.response[0].results[0].id);
                    console.log("Cookies('bioinfo_user','" + user.name + "'); Cookies('bioinfo_sid', '" + res.body.response[0].results[0].id + "');");
                    db.close();
                });
        });
});
