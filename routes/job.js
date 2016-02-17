var config = require('../config.json');
var express = require('express');
var router = express.Router();

const mongoose = require('mongoose');
const Job = mongoose.model('Job');
const File = mongoose.model('File');

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});


router.post('/create', function(req, res) {

    var parentId = req.query.fileId;
    var name = req.query.name;
    var description = req.query.description;
    var tool = req.query.tool;
    var execution = req.query.execution;
    var args = req.query.args;
    //Crear carpeta del job en una carpeta parent o el home del usuario
    // user: {
    // name: {
    // description: {
    // tool: {
    // execution: {
    // status: {
    // folder: {
    // commandLine: {
    // params: {
    // attributes: {
    var job = new Job({
        name: name,
        description: description,
        tool: tool,
        execution: execution,
        args: args
    });

    File.findOne({
        '_id': parentId
    }, function(err, parent) {

        job.createJobFolder(name);

        //Obtener la carpeta del job;
        var toolPath = config.toolPath + steviaDir + tool + '/' + execution + '.sh';
        var commandLine = toolPath



    }).populate("user");

    job.createJobFolder(folderName, parentId);



    // const user = new User(req.query);
    // console.log(user);
    // console.log(user.save(function(err) {
    //     if (err) {
    //         console.log("error: " + err)
    //     }
    // }));
    res.send('user works!!!!!');
});

router.delete('/delete', function(req, res) {
    // User.findOne({
    //     'email': req.query.email
    // }, function(err, user) {
    //     if (err) return handleError(err);
    //     console.log(user);
    //     user.save();
    //
    //     res.send(user);
    // });
});


module.exports = router;
