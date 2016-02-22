/**
 * @swagger
 * resourcePath: /user
 * description: All about USER
 */

var express = require('express');
var router = express.Router();
var utils = require('../lib/utils.js');
var STVResult = require('../lib/STVResult.js');
var STVResponse = require('../lib/STVResponse.js');

const mongoose = require('mongoose');
const User = mongoose.model('User');


// middleware that is specific to this router
router.use(function timeLog(req, res, next) {

    res._stvResponse = new STVResponse({
        paramsOptions: req.params,
        queryOptions: req.query
    });

    next();
});


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
router.get('/create', function(req, res) {

    var stvResult = new STVResult();

    var email = req.query.email;
    var pass = req.query.password;

    stvResult.id = email;
    var start = new Date().getTime();

    const user = new User({
        email: email,
        password: pass
    });


    user.save(function(err) {
        if (err) {
            console.log("error: " + err)
            res.json({
                error: "Error: " + err
            })
        } else {

            // user.password = '';
            user.createHomeFolder();
            user.login();

            stvResult.numResults = 1;
            stvResult.numTotalResults = 1;
            stvResult.results.push(user);
            stvResult.time = (new Date().getTime()) - start;

            res._stvResponse.response.push(stvResult);

            res.json(res._stvResponse);
        }
    });
});

/**
 * @swagger
 * path: /user/create
 * operations:
 *   -  httpMethod: POST
 *      summary: Create User
 *      notes: Returns a new User
 *      responseClass: User
 *      nickname: create
 *      consumes:
 *        - application/json
 *      parameters:
 *        - name: body
 *          description: body
 *          paramType: body
 *          required: true
 *          dataType: string
 */
router.post('/create', function(req, res) {

    var email = req.body.email;
    var pass = req.body.password;

    const user = new User({
        email: email,
        password: pass
    });

    user.save(function(err) {
        if (err) {
            console.log("error: " + err)
        }
    });
    res.send(user);
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

    var stvResult = new STVResult();

    var email = req.params.email;
    var pass = req.query.password;

    stvResult.id = email;
    var start = new Date().getTime();

    User.findOne({
        'email': email
    }, function(err, user) {

        var end = new Date().getTime();

        stvResult.dbTime = new Date().getTime() - start;

        if (err) {
            return handleError(err);
        }

        if (!user) { // User does not exist;
            res.json({
                error: "User does not exist"
            });
        } else {
            if (user.password !== pass) {
                res.json({
                    error: "Password incorrect!!"
                });
            } else {
                var session = user.login();

                stvResult.numResults = 1;
                stvResult.numTotalResults = 1;
                stvResult.results.push(session);
                stvResult.time = (new Date().getTime()) - start;

                res._stvResponse.response.push(stvResult);

                next();
            }
        }
    }).select('+password');
});

/**
 * @swagger
 * path: /user/login
 * operations:
 *   -  httpMethod: POST
 *      summary: User login returns a valid session ID token
 *      notes:
 *      responseClass: User
 *      nickname: login
 *      consumes:
 *        - application/json
 *      parameters:
 *        - name: body
 *          description: body
 *          paramType: body
 *          required: true
 *          dataType: string
 */
router.post('/login', function(req, res) {

    var stvResult = new STVResult();

    var email = req.body.email;
    var pass = req.body.password;

    stvResult.id = email;
    var start = new Date().getTime();

    User.findOne({
        'email': email
    }, function(err, user) {

        var end = new Date().getTime();

        stvResult.dbTime = new Date().getTime() - start;

        if (err) {
            return handleError(err);
        }

        if (!user) { // User does not exist;
            res.json({
                error: "User does not exist"
            });
        } else {
            if (user.password !== pass) {
                res.json({
                    error: "Password incorrect!!"
                });
            } else {
                var session = user.login();

                stvResult.numResults = 1;
                stvResult.numTotalResults = 1;
                stvResult.results.push(session);
                stvResult.time = (new Date().getTime()) - start;

                res._stvResponse.response.push(stvResult);

                res.json(res._stvResponse);
            }
        }
    }).select('+password');
});

//logout user
router.get('/:email/logout', function(req, res) {
    var email = req.params.email;
    var sid = req.query.sid;

    User.findOne({
        'email': email
    }, function(err, user) {

        if (err) {
            return handleError(err);
        }

        if (!user) { // User does not exist;
            res.json({
                error: "User does not exist"
            });
        } else {

            user.removeSessionId(sid);

            res.json(user)
        }
    });
});



//Show user
router.get('/:email/info', function(req, res) {
    var stvResult = new STVResult();
    var email = req.params.email;
    var sid = req.query.sid;
    var updated_at = (req.query.updated_at != null) ? new Date(req.query.updated_at) : new Date();

    stvResult.id = email;
    var start = new Date().getTime();


    User.findOne({
        'email': req.params.email
    }, function(err, user) {
        if (user) {
            var end = new Date().getTime();
            // console.log(user.updated_at);
            // console.log(updated_at);
            if (user.updated_at.getTime() !== updated_at.getTime()) {
                stvResult.results.push(user);
            }

            stvResult.dbTime = new Date().getTime() - start;
            stvResult.numResults = 1;
            stvResult.numTotalResults = 1;
            stvResult.time = (new Date().getTime()) - start;

        }else{
            stvResult.errorMsg = "User not found!";
        }
        res._stvResponse.response.push(stvResult);
        res.json(res._stvResponse);
    }).populate('home');
});

//login user
router.get('/list', function(req, res) {
    User.find(function(err, user) {
        res.send(user);
    });
});

//delete user
router.delete('/:email', function(req, res) {
    User.remove({
        'email': req.params.email
    }, function(err, user) {
        if (!err) {
            res.send(user);

        } else {
            res.send("ERROR")
        }
    });
});

//delete user
router.get('/:email/delete', function(req, res) {
    User.remove({
        'email': req.query.email
    }, function(err, user) {
        if (!err) {
            res.send(user);

        } else {
            res.send("ERROR")
        }
    });
});

router.use(function(req, res, next) {

    console.log("after");
    res.json(res._stvResponse);

});

module.exports = router;
