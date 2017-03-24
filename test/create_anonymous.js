const config = require('../config.json');
const checkconfig = require('../lib/checkconfig.js');
const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const net = require('net');

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
require('../models/user.js');
require('../models/file.js');
require('../models/job.js');
const File = mongoose.model('File');
const User = mongoose.model('User');
const Job = mongoose.model('Job');

var supertest = require('supertest');
request = supertest('http://stvtest.babelomics.org');

var USER_ID;
var SID;
var HOMEFOLDER_ID;
var UPLOADED_FILE;
var USER_NAME = "test";

/* ----- */
/* USER */
/* ----- */

for (var i = 0; i < 2; i++) {
    setInterval(function () {
        request
            .get(config.urlPathPrefix + '/users/create?name=anonymous&email=anonymous@anonymous.anonymous')
            .set('Authorization', 'sid a94a8fe5ccb19ba61c4c0873d391e987982fbbd3')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
                console.log(res.body.response[0]);
            });
    }, 1000)
}
