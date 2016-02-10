var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const User = mongoose.model('User');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});


//create user
router.get('/create', function(req, res) {
    const user = new User(req.query);
    console.log(user);
    console.log(user.save(function(err) {
        if (err) {
            console.log("error: " + err)
        }
    }));
    res.send('user works!!!!!');
});

//login user
router.get('/login', function(req, res) {
    User.findOne({
        'email': req.query.email
    }, function(err, user) {
        if (err) return handleError(err);
        console.log(user);
        user.save();

        res.send(user);
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

module.exports = router;
