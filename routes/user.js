/**
 * @swagger
 * resourcePath: /user
 * description: All about USER
 */
var mail = require('../lib/mail/mail.js');
var mailConfig = require('../mail.json');
const StvResult = require('../lib/StvResult.js');

const crypto = require('crypto');
const async = require('async');

const express = require('express');
const router = express.Router();
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const User = mongoose.model('User');
const File = mongoose.model('File');
const Job = mongoose.model('Job');

// // middleware that is specific to this router
// router.use(function timeLog(req, res, next) {
//     next();
// });

/**
 * @swagger
 * path: /user/create
 * operations:
 *   -  httpMethod: GET
 *      summary: Create User
 *      notes: Returns a new User
 *      responseClass: User
 *      nickname: create
 *      consumes:
 *        - application/json
 *      parameters:
 *        - name: name
 *          description: User name
 *          paramType: query
 *          required: true
 *          dataType: string
 *        - name: password
 *          description: Your password
 *          paramType: query
 *          required: true
 *          dataType: string
 */
router.get('/create', function (req, res, next) {
    var stvResult = new StvResult();

    var name = req.query.name;
    var email = req.query.email;
    var pass = req._sid;

    stvResult.id = email;

    var user = new User({
        name: name,
        email: email,
        password: pass
    });

    if (email === 'anonymous@anonymous.anonymous') {
        user.name = 'anonymous___' + user._id;
    }

    async.waterfall([
        function (cb) {
            User.findOne({
                'name': name
            }, function (err, dbUser) {
                if (dbUser == null) {
                    cb(null);
                } else {
                    stvResult.error = 'User already exists.';
                    console.log("error: " + stvResult.error);
                    cb(stvResult.error);
                }
            })
        },
        function (cb) {
            user.save(function (err) {
                if (err != null) {
                    console.log(err);
                    stvResult.error = 'User already exists';
                    console.log("error: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    cb(null);
                }
            });
        },
        function (cb) {
            user.createHomeFolder(function () {
                cb(null);
            });
        },
        function (cb) {
            user.login(function (session) {
                stvResult.results.push(user);
                cb(null);
            });
        },
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

/**
 * @swagger
 * path: /user/{email}/login
 * operations:
 *   -  httpMethod: GET
 *      summary: User login returns a valid session ID token
 *      notes:
 *      responseClass: User
 *      nickname: login
 *      consumes:
 *        - application/json
 *      parameters:
 *        - name: email
 *          description: Your email
 *          paramType: path
 *          required: true
 *          dataType: string
 *        - name: password
 *          description: Your password
 *          paramType: query
 *          required: true
 *          dataType: string
 */
router.get('/:name/login', function (req, res, next) {
    var stvResult = new StvResult();
    var name = req.params.name;
    var pass = req._sid;

    stvResult.id = name;

    async.waterfall([
        function (cb) {
            User.findOne({
                'name': name
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "User does not exist";
                    console.log("login ws: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    if (user.password !== pass) {
                        stvResult.error = "Password incorrect";
                        console.log("error: " + stvResult.error);
                        cb(stvResult.error);
                    } else {
                        user.login(function (session) {
                            stvResult.results.push(session);
                            cb(null);
                        });
                    }
                }
            }).select('+password');
        },
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

// logout user
router.get('/:name/logout', function (req, res, next) {
    var stvResult = new StvResult();
    var name = req.params.name;
    var sid = req._sid;
    var logoutOther = false;
    if (req.query.logoutOther != null) {
        logoutOther = req.query.logoutOther === 'true';
    }
    async.waterfall([
        function (cb) {
            User.findOne({
                'name': name,
                'sessions.id': sid
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "User does not exist";
                    console.log("logout ws: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    user.removeSessionId(sid, logoutOther, function () {
                        cb(null);
                    });
                }
            });
        },
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

// info user
router.get('/:name/info', function (req, res, next) {
    var stvResult = new StvResult();
    var name = req.params.name;
    var sid = req._sid;
    var updatedAt = (req.query.updatedAt != null) ? new Date(req.query.updatedAt) : new Date();

    stvResult.id = name;

    async.waterfall([
        function (cb) {
            User.findOne({
                'name': req.params.name,
                'sessions.id': sid
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "User does not exist";
                    console.log("info ws: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    var userObject = user.toObject();
                    if (user.updatedAt.getTime() !== updatedAt.getTime()) {
                        File.tree(user.home, user._id, function (tree) {
                            userObject.tree = tree;
                            Job.find({
                                user: user._id
                            }, function (error, jobs) {
                                userObject.jobs = jobs;
                                stvResult.results.push(userObject);
                                stvResult.numTotalResults = 1;
                                cb(null);
                            }).sort({
                                createdAt: -1
                            }).populate('folder');

                        });
                    } else {
                        stvResult.numTotalResults = 0;
                        cb(null);
                    }
                }
            }).populate('home');
        },
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });

});

//
// //delete user
// router.get('/:name/delete', function(req, res) {
//     User.remove({
//         'name': req.params.name
//     }, function(err, user) {
//         if (!err) {
//             res.send(user);
//         } else {
//             res.send("ERROR");
//         }
//     });
// });

router.post('/:name/change-notifications', function (req, res, next) {
    var stvResult = new StvResult();
    var name = req.params.name;
    var sid = req._sid;

    async.waterfall([
        function (cb) {
            User.findOne({
                'name': name,
                'sessions.id': sid
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "User does not exist";
                    console.log("info ws: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    var newNotifications = req.body;
                    var obj = {};
                    for (var key in user.notifications) {
                        obj[key] = user.notifications[key];
                    }
                    for (var key in newNotifications) {
                        obj[key] = newNotifications[key];
                    }
                    user.notifications = obj;
                    user.save(function (err) {
                        stvResult.results.push(user.notifications);
                        cb(null);
                    });
                }
            }).populate('home');
        },
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });

});

router.get('/:name/change-password', function (req, res, next) {
    var stvResult = new StvResult();
    var name = req.params.name;

    var password = req.get('x-stv-1');
    var npassword = req.get('x-stv-2');
    var sid = req._sid;

    async.waterfall([
        function (cb) {
            User.findOne({
                'name': name,
                'sessions.id': sid,
                'password': password
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "Authentication error";
                    console.log("error: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    user.password = npassword;
                    user.save(function (err) {
                        cb(null);
                    });
                }
            });
        }
    ], function (err) {
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

//reset pasword
router.get('/reset-password', function (req, res, next) {
    console.log('reset');
    var stvResult = new StvResult();
    var name = req.query.name;
    console.log(name);

    async.waterfall([
        function (cb) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString('hex');
                console.log(token);
                cb(err, token);
            });
        },
        function (token, cb) {
            User.findOne({
                'name': name
            }, function (err, user) {
                if (!user) {
                    stvResult.error = "User not found";
                    console.log("error: " + stvResult.error);
                    cb(stvResult.error);
                } else {
                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                    user.save(function (err) {
                        cb(err, token, user);
                    });
                }
            });
        },
        function (token, user, cb) {
            mail.send({
                to: user.email,
                subject: 'Reset password instructions',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/users/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            }, function (err, info) {
                if (err) {
                    stvResult.error = err
                    console.log("error: " + stvResult.error);
                    cb(err);
                } else {
                    stvResult.results.push('An e-mail has been sent to ' + user.email + ' with further instructions.');
                    console.log('Message sent: ' + info.response);
                    cb(null);
                }
            });
        },
    ], function (err) {
        if (err) {
            console.log(err)
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

router.get('/reset/:token', function (req, res) {
    var stvResult = new StvResult();

    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function (err, user) {
        if (!user) {
            stvResult.error = "Password reset token is invalid or has expired";
            console.log("error: " + stvResult.error);
            res.render('resetinvalid');
        } else {
            console.log('reset-token')
            res.render('reset');
        }
    });
});

router.post('/reset/:token', function (req, res, next) {
    var stvResult = new StvResult();

    console.log(req.params.token)

    async.waterfall([
        function (cb) {
            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function (err, user) {
                console.log(user.email);
                if (!user) {
                    stvResult.error = "Password reset token is invalid or has expired";
                    console.log("error: " + stvResult.error);
                    res.render('resetinvalid');
                }
                if (req.body.password != req.body.confirm) {
                    stvResult.error = "Password and confirm password are not the same";
                    console.log("error: " + stvResult.error);
                    res.render('reset');
                } else {
                    console.log('post-reset-invalid')
                    var encPassword = crypto.createHash('sha1').update(req.body.password).digest('hex');
                    user.password = encPassword;
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;
                    console.log('reset-token-post')

                    user.save(function (err) {
                        cb(err, user);
                    });
                }
            });
        },
        function (user, cb) {
            mail.send({
                to: user.email,
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            }, function (error, info) {
                if (error) {
                    stvResult.error = error
                    console.log(error);
                    cb(err);
                }
                console.log('Message sent: ' + info.response);
            });
            res.render('resetcomplete');
        }
    ], function (err) {
        if (err) {
            console.log(err)
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});

router.get('/feedback', function (req, res, next) {
    var stvResult = new StvResult();
    var subject = req.query.subject;
    var type = req.query.type;
    var text = req.query.text;
    console.log('feedback');
    mail.send({
        to: mailConfig.mail,
        subject: subject,
        text: 'Type of email: ' + type + '\n' + text
    }, function (error, info) {
        if (error) {
            stvResult.error = error
            console.log(error);
        }
        stvResult.results.push('It has send your email! Thank you!');
        stvResult.end();
        res._stvres.response.push(stvResult);
        console.log('Message sent: ' + info.response);
        next();
    });
});

module.exports = router;
