/**
 * @swagger
 * resourcePath: /user
 * description: All about USER
 */
var mail = require('../lib/mail/mail.js');
var crypto = require('crypto');
var express = require('express');
var router = express.Router();
var utils = require('../lib/utils.js');
var StvResult = require('../lib/StvResult.js');
const async = require('async');

const mongoose = require('mongoose');
const User = mongoose.model('User');
const File = mongoose.model('File');


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
 *        - name: email
 *          description: Your email
 *          paramType: query
 *          required: true
 *          dataType: string
 *        - name: password
 *          description: Your password
 *          paramType: query
 *          required: true
 *          dataType: string
 */
router.get('/create', function(req, res, next) {
    var stvResult = new StvResult();

    var email = req.query.email;
    var pass = req.query.password;

    stvResult.id = email;

    const user = new User({
        email: email,
        password: pass
    });

    user.save(function(err) {
        if (err) {
            stvResult.error = 'User already exists';
            console.log("error: " + stvResult.error);
        } else {
            user.createHomeFolder();
            user.login();

            stvResult.results.push(user);
        }
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
router.get('/:email/login', function(req, res, next) {
    var stvResult = new StvResult();
    var email = req.params.email;
    var pass = req.query.password;

    stvResult.id = email;

    User.findOne({
        'email': email
    }, function(err, user) {
        if (!user) {
            stvResult.error = "User does not exist";
            console.log("error: " + stvResult.error);
        } else {
            if (user.password !== pass) {
                stvResult.error = "Password incorrect";
                console.log("error: " + stvResult.error);
            } else {
                var session = user.login();

                stvResult.results.push(session);
            }
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    }).select('+password');
});

// logout user
router.get('/:email/logout', function(req, res, next) {
    var stvResult = new StvResult();
    var email = req.params.email;
    var sid = req.query.sid;

    User.findOne({
        'email': email,
        'sessions.id': sid
    }, function(err, user) {
        if (!user) {
            stvResult.error = "User does not exist";
            console.log("error: " + stvResult.error);
        } else {
            user.removeSessionId(sid);
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});



// info user
router.get('/:email/info', function(req, res, next) {
    console.log('info');
    var stvResult = new StvResult();
    var email = req.params.email;
    var sid = req.query.sid;
    var updated_at = (req.query.updated_at != null) ? new Date(req.query.updated_at) : new Date();

    stvResult.id = email;

    User.findOne({
        'email': req.params.email,
        'sessions.id': sid
    }, function(err, user) {
        console.log(user);
        if (!user) {
            stvResult.error = "User does not exist";
            console.log("error: " + stvResult.error);
        } else {
            if (user.updated_at.getTime() !== updated_at.getTime()) {
                File.tree(user.home, user._id, function(tree) {
                    var userObject = user.toObject();
                    userObject.tree = tree;
                    stvResult.results.push(userObject);
                    stvResult.numTotalResults = 1;
                    stvResult.end();
                    res._stvres.response.push(stvResult);
                    next();
                });
            } else {
                stvResult.numTotalResults = 0;
                stvResult.end();
                res._stvres.response.push(stvResult);
                next();
            }

        }
    }).populate('home');
});


//
// //delete user
// router.get('/:email/delete', function(req, res) {
//     User.remove({
//         'email': req.params.email
//     }, function(err, user) {
//         if (!err) {
//             res.send(user);
//         } else {
//             res.send("ERROR");
//         }
//     });
// });

router.get('/:email/change-password', function(req, res, next) {
    var stvResult = new StvResult();
    var email = req.params.email;
    var password = req.query.password;
    var npassword = req.query.npassword;
    var sid = req.query.sid;
    User.findOne({
        'email': email,
        'sessions.id': sid,
        'password': password
    }, function(err, user) {
        if (!user) {
            stvResult.error = "Authentication error";
            console.log("error: " + stvResult.error);
        } else {
            user.password = npassword;
            user.save();
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
    });
});


//reset pasword
router.get('/reset-password', function(req, res, next) {
    console.log('reset')
    var stvResult = new StvResult();
    var email = req.query.email;
    console.log(email)
    async.waterfall([
            function(done) {
                console.log("waterfall-1");
                crypto.randomBytes(20, function(err, buf) {
                    var token = buf.toString('hex');
                    console.log(token)
                    done(err, token);
                });
            },
            function(token, done) {
                console.log("waterfall-2");
                User.findOne({
                    'email': email
                }, function(err, user) {
                    if (!user) {
                        stvResult.error = "No account with that email address exists";
                        console.log("error: " + stvResult.error);
                        return res.redirect('/reset-password');
                    } else {
                        user.resetPasswordToken = token;
                        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                        user.save(function(err) {
                            done(err, token, user);
                        });
                    }
                });
            },
            function(token, user, done) {
                console.log("waterfall-3");
                mail.send({
                    to: user.email,
                    subject: 'Reset password instructions',
                    text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                        'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                        'http://' + req.headers.host + '/users/reset/' + token + '\n\n' +
                        'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                }, function(err, info) {
                    if (err) {
                        stvResult.error = err
                        console.log(err);
                        done(err, 'done');
                    } else {
                        stvResult.results.push('An e-mail has been sent to ' + user.email + ' with further instructions.');
                        console.log('Message sent: ' + info.response);
                        done(err, 'done');
                    }
                });
            },
        ],
        function(err) {
            console.log("waterfall-end");
            if (err) {
                console.log(err)
                return next(err);
            } else {
                stvResult.end();
                res._stvres.response.push(stvResult);
                next();
            }
        });
});

router.get('/reset/:token', function(req, res) {
    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function(err, user) {
        if (!user) {
            stvResult.error = "Password reset token is invalid or has expired";
            console.log("error: " + stvResult.error);
        }
        console.log('reset-token')
        res.render('reset');
    });
});

router.post('/reset/:token', function(req, res, next) {
  var stvResult = new StvResult();
    async.waterfall([
        function(done) {
            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {
                    $gt: Date.now()
                }
            }, function(err, user) {
                console.log(user.email);
                if (!user) {
                    stvResult.error = "Password reset token is invalid or has expired";
                    console.log("error: " + stvResult.error);
                }
                var encPassword = crypto.createHash('sha1').update(req.body.password).digest('hex');
                user.password = encPassword;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                console.log('reset-token-post')

                user.save(function(err) {
                    done(err, user);
                });
            });
        },
        function(user, done) {
            mail.send({
                to: user.email,
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            }, function(error, info) {
                if (error) {
                    stvResult.error = error
                    console.log(error);
                    done(err);
                }
                console.log('Message sent: ' + info.response);
                res.render('resetcomplete');
            });
        }
    ], function(err) {
        if (err) {
            console.log(err)
            return next(err);
        }else {
            stvResult.end();
            res._stvres.response.push(stvResult);
            next();
        }
    });
});


module.exports = router;
