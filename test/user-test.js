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

test('user create', function (t) {
    request
        .get('/users/create?email=test@test.com')
        .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {

            t.error(err, 'No error');
            console.log(res.body.response[0]);

            var db = mongoose.connect(config.mongodb, function () {
                User.findOne({
                        'email': 'test@test.com'
                    },
                    function (err, user) {
                        t.error(err, 'No error');
                        t.not(user, null);
                        mongoose.disconnect();
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
            t.error(err, 'No error');
            console.log(res.body.response[0]);
            t.not(res.body.response[0].results.id, null);
            t.not(res.body.response[0].results.date, null);
            t.end();
        });
});
