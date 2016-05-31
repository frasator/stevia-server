const config = require('../config.json');
const path = require('path');

const mongoose = require("mongoose");
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

const shell = require('shelljs');

var supertest = require('supertest');
request = supertest('http://localhost:5555');
var test = require('tape');

var SID;
test('user create', function (t) {
    request
        .get('/users/create?email=test@test.com')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            // t.equal(res.body.response[0].error, undefined);

            var db = mongoose.connect(config.mongodb, function () {
                User.findOne({
                        'email': 'test@test.com'
                    },
                    function (err, user) {
                        mongoose.disconnect();
                        t.error(err, 'No error');
                        t.not(user, null);
                        var userPath = path.join(config.steviaDir, config.usersPath, 'test@test.com');
                        t.true(shell.test('-d', userPath), "Directory exists");
                        t.end();
                    }).populate('home');
            });
        });
});

test('user login', function (t) {
    request
        .get('/users/test@test.com/login')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
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
        .get('/users/test@test.com/info')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.not(res.body.response[0].results[0].tree, undefined);
            t.equal(res.body.response[0].results[0].email, 'test@test.com')

            t.end();
        });
});

test('user change password', function (t) {
    request
        .get('/users/test@test.com/change-password')
        .set('Authorization', 'sid ' + SID)
        .set('x-stv-1', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .set('x-stv-2', 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});

test('user logout', function (t) {
    request
    // .get('/users/test@test.com/logout?logoutOther=true')
        .get('/users/test@test.com/logout')
        .set('Authorization', 'sid ' + SID)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
            // console.log(res.body.response[0]);
            t.error(err, 'No error');
            t.equal(res.body.response[0].error, undefined);

            t.end();
        });
});
