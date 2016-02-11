/**
 * @swagger
 * resourcePath: /user
 * description: All about USER
 */

var express = require('express');
var router = express.Router();
var utils = require('../lib/utils.js');

const mongoose = require('mongoose');
const User = mongoose.model('User');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  console.log('Time: ', Date.now());
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

  var email = req.query.email;
  var pass = req.query.password;

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

//login user
router.get('/login', function(req, res) {

  var email = req.query.email;
  var pass = req.query.pass;

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

      if (user.password !== pass) {
        res.json({
          error: "Password incorrect!!"
        });
      } else {
        user.sessions.push({
          id: utils.generateRandomString(),
          date: Date.now()
        })
        user.save();

        res.json(user);
      }
    }
  });
});

//login user
router.post('/login', function(req, res) {

  var email = req.body.email;
  var pass = req.body.password;

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

      if (user.password !== pass) {
        res.json({
          error: "Password incorrect!!"
        });
      } else {
        user.sessions.push({
          id: utils.generateRandomString(),
          date: Date.now()
        })
        user.save();

        res.json(user);
      }
    }
  });
});

//logout user
router.get('/logout', function(req, res) {
  User.findOne({
    'email': req.query.email
  }, function(err, user) {

    if (err) {
      return handleError(err);
    }

    if (!user) { // User does not exist;
      res.json({
        error: "User does not exist"
      });
    } else {

      var sessionId = req.query.sessionId;

      user.removeSessionId(sessionId);

      res.json(user)
    }
  });
});



//login user
router.get('/:email/show', function(req, res) {
  User.findOne({
    'email': req.params.email
  }, function(err, user) {
    res.send(user);
  });
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

module.exports = router;
