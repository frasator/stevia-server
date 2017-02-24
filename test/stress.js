// /*
//     This file will create many users on a database and then will create many files and folders
// */
// require('../models/job.js');
// require('../models/file.js');
// require('../models/user.js');
//
// const config = require('../config.json');
// const fs = require('fs');
// var mongoose = require("mongoose");
// mongoose.Promise = global.Promise;
// const Job = mongoose.model('Job');
// const User = mongoose.model('User');
// const File = mongoose.model('File');
//
// var http = require('http');
//
// var Path = require('path');
//
// connect()
//     .on('error', console.log)
//     .on('disconnected', connect)
//     .once('open', listen);
//
// function listen() {
//     run();
// }
//
// function connect() {
//     var options = {
//         server: {
//             socketOptions: {
//                 keepAlive: 120
//             }
//         },
//         config: {
//             autoIndex: false
//         }
//     };
//     return mongoose.connect(config.mongodb, options).connection;
// }
//
// function callPath(path, cb) {
//     http.get({
//         hostname: 'localhost',
//         port: 5555,
//         path: path,
//         agent: false // create a new agent just for this one request
//     }, (res) => {
//         var str = '';
//         //another chunk of data has been recieved, so append it to `str`
//         res.on('data', function (chunk) {
//             str += chunk;
//         });
//         //the whole response has been recieved, so we just print it out here
//         res.on('end', function () {
//             // console.log(str);
//             cb(str);
//         });
//     })
// }
//
// function run() {
//
//     var t = Date.now();
//
//     callPath('/test', function (content) {
//         console.log(content);
//     });
//
//     /* Create many users */
//     // http: //localhost:5555/users/create?email=demo@demo.com&password=89e495e7941cf9e40e6980d14a16bf023ccd4c91
//     var numUsers = 1000 * 100 * 1 * 1;
//     var it = 0;
//     var lock = false;
//
//     var interval = setInterval(function () {
//         if (it < numUsers) {
//             if (lock == false) {
//                 lock = true;
//                 var email = it + '.' + t + '@demo.com';
//                 callPath('/users/create?email=' + email + '&password=89e495e7941cf9e40e6980d14a16bf023ccd4c91', function (content) {
//                     var json = JSON.parse(content);
//                     var user = json.response[0].results[0];
//                     if (user != null) {
//                         var home = user.home;
//                         console.log(user.email);
//                         File.findOne({
//                             '_id': home._id
//                         }, function (err, file) {
//                             copyFilesScaffold(file.user.email);
//                             recordOutputFolder(file.user, file);
//                             it++;
//                             console.log(it);
//                             lock = false;
//                         }).populate("user");
//                     } else {
//                         it++;
//                         // console.log(it);
//                         lock = false;
//                     }
//
//                 });
//             } else {
//                 // console.log('locked!!');
//             }
//         } else {
//             clear();
//         }
//     }, 50);
//
//     function clear() {
//         clearInterval(interval);
//     }
//
// }
//
// function recordOutputFolder(user, folder) {
//     var folderPath = config.steviaDir + config.usersPath + folder.path + '/';
//     try {
//         var folderStats = fs.statSync(folderPath);
//         if (folderStats.isDirectory()) {
//             var filesInFolder = fs.readdirSync(folderPath);
//             for (var i = 0; i < filesInFolder.length; i++) {
//                 var fileName = filesInFolder[i];
//                 var filePath = folderPath + fileName;
//                 var fileStats = fs.statSync(filePath);
//
//                 /* Database entry */
//                 var type = "FILE";
//                 if (fileStats.isDirectory()) {
//                     type = "FOLDER";
//                 }
//                 var file = new File({
//                     name: fileName,
//                     user: user._id,
//                     parent: folder._id,
//                     type: type,
//                     path: folder.path + '/' + fileName
//                 });
//                 folder.files.push(file);
//                 file.save();
//
//                 if (fileStats.isDirectory()) {
//                     recordOutputFolder(user, file);
//                 }
//
//             }
//             folder.save();
//         }
//     } catch (e) {
//         console.log('recordOutputFolder: ');
//         console.log(e);
//     }
// }
//
// function copyFilesScaffold(email) {
//     var source = '/tmp/random-files/';
//     var target = '/opt/stevia/users/' + email + '/';
//     copyFolderRecursiveSync(source, target);
// }
//
// function copyFileSync(source, target) {
//     var targetFile = target;
//     //if target is a directory a new file with the same name will be created
//     if (fs.existsSync(target)) {
//         if (fs.lstatSync(target).isDirectory()) {
//             targetFile = Path.join(target, Path.basename(source));
//         }
//     }
//     fs.writeFileSync(targetFile, fs.readFileSync(source));
// }
//
// function copyFolderRecursiveSync(source, target) {
//     var files = [];
//
//     //check if folder needs to be created or integrated
//     var targetFolder = Path.join(target, Path.basename(source));
//     if (!fs.existsSync(targetFolder)) {
//         fs.mkdirSync(targetFolder);
//     }
//
//     //copy
//     if (fs.lstatSync(source).isDirectory()) {
//         files = fs.readdirSync(source);
//         files.forEach(function (file) {
//             var curSource = Path.join(source, file);
//             if (fs.lstatSync(curSource).isDirectory()) {
//                 copyFolderRecursiveSync(curSource, targetFolder);
//             } else {
//                 copyFileSync(curSource, targetFolder);
//             }
//         });
//     }
// }
