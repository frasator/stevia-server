/**
 * @swagger
 * resourcePath: /user
 * description: All about USER
 */

var express = require('express');
var router = express.Router();
var utils = require('../lib/utils.js');
var StvResult = require('../lib/StvResult.js');

const mongoose = require('mongoose');
const User = mongoose.model('User');


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
    var stvResult = new StvResult();
    var email = req.params.email;
    var sid = req.query.sid;
    var updated_at = (req.query.updated_at != null) ? new Date(req.query.updated_at) : new Date();

    stvResult.id = email;

    User.findOne({
        'email': req.params.email,
        'sessions.id': sid
    }, function(err, user) {
        if (!user) {
            stvResult.error = "User does not exist";
            console.log("error: " + stvResult.error);
        } else {
            if (user.updated_at.getTime() !== updated_at.getTime()) {
                stvResult.results.push(user);
                stvResult.numTotalResults = 1;
            } else {
                stvResult.numTotalResults = 0;
            }
        }
        stvResult.end();
        res._stvres.response.push(stvResult);
        next();
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

module.exports = router;
