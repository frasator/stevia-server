const config = require('../config.json');

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;
const util = require('util');
const exec = require('child_process').exec;
const fs = require('fs');

const mime = require('mime');
const path = require('path');
const async = require('async');
const shell = require('shelljs');
const crypto = require('crypto');

// require('./job.js');
// require('./user.js');
// require('./job.js');

/**
 * File Schema
 */

const FileSchema = new Schema({
    name: {
        type: String,
        default: '',
    },
    path: {
        type: String
    },
    type: {
        type: String,
        default: '',
    },
    format: {
        type: String,
        default: '',
    },
    bioformat: {
        type: String,
        default: '',
    },
    size: {
        type: Number,
        default: 0
    },
    attributes: {
        type: Schema.Types.Mixed,
        default: {}
    },
    files: [{
        type: Schema.Types.ObjectId,
        ref: 'File'
    }],
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    job: {
        type: Schema.Types.ObjectId,
        ref: 'Job'
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: 'File'
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

FileSchema.pre('save', function (next) {
    if (this.type == 'FILE') {
        var fsFilePath = path.join(config.steviaDir, config.usersPath, this.path);

        var stats = fs.statSync(fsFilePath);
        console.log('File ' + fsFilePath + ' saved. Final size: ' + stats.size);

        this.format = mime.lookup(this.name);
        this.size = stats.size;
    }
    this.updatedAt = new Date();
    next();
});

FileSchema.post('save', function (doc, next) {
    mongoose.models["User"].findById(this.user, function (err, user) {
        user.updateDiskUsage(function () {
            next();
        });
    });
});

FileSchema.post('remove', function (doc, next) {
    mongoose.models["User"].findById(this.user, function (err, user) {
        user.updateDiskUsage(function () {
            next();
        });
    });
});
/**
 * Methods
 */

FileSchema.methods = {
    fsDelete: function () {
        if (this.path == null || this.path == '') {
            console.log("File fsDelete: file path is null or ''.")
        } else {
            var userspath = path.join(config.steviaDir, config.usersPath);
            var realPath = path.join(userspath, this.path);
            //check exists
            try {
                shell.rm('-rf', realPath);
            } catch (e) {
                console.log("File fsDelete: file not exists on file system")
            }
        }
    }
};

/**
 * Statics
 */

FileSchema.statics = {
    getFile: function (fileId, callback) {
        var fid = new ObjectId(fileId);
        return this.findOne({
            "_id": fid
        }).exec(callback);
    },
    getDuplicatedFileName: function (dbParentPath, name) {
        var fsParentPath = path.join(config.steviaDir, config.usersPath, dbParentPath);
        var suffix = 0;
        var nameToCheck = name;
        while (shell.test('-e', path.join(fsParentPath, nameToCheck))) {
            suffix++;
            nameToCheck = name + '-' + suffix;
        }
        return nameToCheck;
    },
    createFolder: function (name, parent, user, callback) {
        var fsUsersPath = path.join(config.steviaDir, config.usersPath);
        try {
            var stats = fs.statSync(fsUsersPath);
        } catch (e) {
            shell.mkdir('-p', fsUsersPath);
        }

        var dbParentPath;
        if (parent != undefined) {
            dbParentPath = parent.path;
        } else {
            dbParentPath = user.name;
        }

        var finalName = this.getDuplicatedFileName(dbParentPath, name);
        fsFinalPath = path.join(config.steviaDir, config.usersPath, dbParentPath, finalName);
        dbFinalPath = path.join(dbParentPath, finalName);

        try {
            shell.mkdir(fsFinalPath);
        } catch (e) {
            console.log("File CreateFolder: file already exists on file system");
        }

        var folder = new this({
            name: finalName,
            user: user._id,
            parent: parent._id,
            type: "FOLDER",
            path: dbFinalPath
        });

        parent.files.push(folder);

        async.each([folder, parent, user], function (dbItem, savecb) {
            dbItem.save(function (err) {
                savecb(err);
            });
        }, function (err) {
            if (err) {
                console.log(err);
            }
            callback(folder);
        });
    },
    createFile: function (name, parent, user, callback) {
        var dbFilePath = path.join(parent.path, name);

        var file = new this({
            name: name,
            user: user._id,
            parent: parent._id,
            type: "FILE",
            path: dbFilePath

        });
        parent.files.push(file);

        async.each([file, parent, user], function (dbItem, savecb) {
            dbItem.save(function (err) {
                savecb(err);
            });
        }, function (err) {
            if (err) {
                console.log(err);
            }
            callback(file);
        });
    },
    delete: function (fileId, callback) {
        async.waterfall([
            function (cb) {
                mongoose.models["File"].findOne({
                    '_id': fileId
                }, function (err, file) {
                    cb(null, file);
                }).populate({
                    path: 'job'
                }).populate({
                    path: 'parent'
                }).populate('user');
            },
            function (file, cb) {
                if (file.job != null && file.job.status == "RUNNING") {
                    cb("File.delete: this folder can not be deleted because the job associated is RUNNING.");
                } else cb(null, file);
            },
            function (file, cb) {
                if (file.job != null && file.job.status != "RUNNING" && file.job.status != "DONE") {
                    exec('qdel ' + file.job.qId, function (error, stdout, stderr) {
                        console.log('delete: check RUNNING and qdel 2');
                        console.log('qdel: Trying to remove the job from queue...');
                        console.log('qdel: ' + stdout);
                        console.log('qdel: end.');
                    });
                    cb(null, file);
                } else cb(null, file);
            },
            function (file, cb) {
                var jobsToRemove = [];
                mongoose.models["File"].find({
                    'type': 'FOLDER',
                    'job': {
                        $ne: null
                    },
                    'path': {
                        $regex: new RegExp('^' + file.path + '/')
                    }
                }, {
                    job: 1
                }, function (err, files) {
                    for (var i = 0; i < files.length; i++) {
                        var f = files[i];
                        jobsToRemove.push(f.job);
                    }
                    if (file.job != null) {
                        jobsToRemove.push(file.job._id);
                    }
                    cb(null, file, jobsToRemove);
                });
            },
            function (file, jobsToRemove, cb) {
                // console.log(jobsToRemove);
                mongoose.models["Job"].remove({
                    '_id': {
                        $in: jobsToRemove
                    },
                }, function (err) {
                    cb(null, file);
                });
            },
            function (file, cb) {
                mongoose.models["File"].remove({
                    'path': {
                        $regex: new RegExp('^' + file.path + '/')
                    }
                }, function (err) {
                    cb(null, file);
                });
            },
            function (file, cb) {
                file.remove(function (err) {
                    cb(null, file);
                });
            },
            function (file, cb) {
                if (file.parent != null) {
                    //Update parent file ARRAY
                    mongoose.models["File"].find({
                        'parent': file.parent
                    }, function (err, filesFound) {
                        file.parent.files = filesFound;
                        file.parent.save(function () {
                            cb(null, file);
                        });
                    });
                } else {
                    cb(null, file);
                }
            },
            function (file, cb) {
                file.fsDelete();
                file.user.save();
                cb();
            },
        ], function (err, result) {
            if (err != null) {
                console.log(err);
            }
            callback();
        });
    },
    move: function (file, newParent, callback) {
        var err = null;

        if (file == null) {
            err = "File not exists";
            callback(err);
            return;
        }
        var oldParent = file.parent;
        if (oldParent == null) {
            err = "Old parent not exists";
            callback(err);
            return;
        }
        if (newParent == null) {
            err = "New parent not exists";
            callback(err);
            return;
        }

        if (newParent.path === file.path) {
            err = "New parent and file are the same";
            callback(err);
            return;
        }

        if (oldParent.path === newParent.path) {
            err = "Old parent and New parent are the same";
            callback(err);
            return;
        }

        if (newParent.files.indexOf(file._id) != -1) {
            err = "Destination file already exists";
            callback(err);
            return;
        } else {

            var fileName = this.getDuplicatedFileName(newParent.path, file.name);
            file.name = fileName;
        }

        var oldPath = path.join(config.steviaDir, config.usersPath, file.path);
        var newPath = path.join(config.steviaDir, config.usersPath, newParent.path, file.name);
        try {
            fs.renameSync(oldPath, newPath);
        } catch (e) {
            console.log("RenameSync Error");
            console.log("old " + oldPath)
            console.log("new " + newPath)
            callback(e.message);
            console.log("Move operation canceled.");
            return;
        }

        var oldFilePath = file.path;
        async.waterfall([
            function (cb) {
                var index = oldParent.files.indexOf(file._id);
                if (index != -1) {
                    oldParent.files.splice(index, 1);
                    oldParent.save(function (err) {
                        cb(null)
                    });
                } else {
                    cb(null);
                }
            },
            function (cb) {
                newParent.files.push(file);
                newParent.save(function (err) {
                    cb(null);
                });
            },
            function (cb) {
                file.parent = newParent;
                file.path = path.join(newParent.path, file.name);
                file.save(function (err) {
                    cb(null);
                });
            },
            function (cb) {
                if (file.type == 'FOLDER') {
                    mongoose.models["File"].find({
                        'user': file.user,
                        'path': {
                            $regex: new RegExp('^' + oldFilePath + '/')
                        }
                    }, function (error, files) {
                        if (error) {
                            cb(error)
                        } else {
                            async.mapLimit(files, 10, function (f, next) {
                                f.path = f.path.replace(new RegExp('^' + oldFilePath), file.path);
                                f.save(next);
                            }, function (error) {
                                cb(error);
                            });
                        }
                    });
                } else {
                    cb(null);
                }
            },
        ], function (error) {
            var err = error;
            callback(err)
        });
    },
    rename: function (file, newname, callback) {
        var err = null;

        if (file == null) {
            err = "File not exists";
            callback(err);
            return;
        }
        if (file.user.name == null) {
            err = "User file must be populated";
            callback(err);
            return;
        }
        if (file.user.name == file.path) {
            err = "User's home folder can not be renamed";
            callback(err);
            return;
        }
        if (file.parent.path == null) {
            err = "File parent must be populated";
            callback(err);
            return;
        }
        if (newname == null || newname == '') {
            err = "New name is empty";
            callback(err);
            return;
        }

        var oldPath = path.join(config.steviaDir, config.usersPath, file.path);
        var newPath = path.join(config.steviaDir, config.usersPath, file.parent.path, newname);

        if (shell.test('-e', newPath)) {
            err = "Already exists a file with that name on the file system";
            callback(err);
            return;
        }

        try {
            fs.renameSync(oldPath, newPath);
        } catch (e) {
            console.log("RenameSync Error");
            console.log("old " + oldPath)
            console.log("new " + newPath)
            callback(e.message);
            console.log("Rename operation canceled.");
            return;
        }

        var oldFilePath = file.path;
        async.waterfall([
            function (cb) {
                mongoose.models["File"].findOne({
                    'path': path.join(file.parent.path, newname),
                    'user': file.user
                }, function (err, checkFile) {
                    if (!checkFile) {
                        cb(null);
                    } else {
                        cb('File already exists with that name on the database');
                    }
                });
            },
            function (cb) {
                file.name = newname;
                file.path = path.join(file.parent.path, newname);
                file.save(function (err) {
                    cb(null);
                });
            },
            function (cb) {
                if (file.type == 'FOLDER') {
                    mongoose.models["File"].find({
                        'user': file.user,
                        'path': {
                            $regex: new RegExp('^' + oldFilePath + '/')
                        }
                    }, function (error, files) {
                        if (error) {
                            cb(error)
                        } else {
                            async.mapLimit(files, 10, function (f, next) {
                                f.path = f.path.replace(new RegExp('^' + oldFilePath), file.path);
                                f.save(next);
                            }, function (error) {
                                cb(error);
                            });
                        }
                    });
                } else {
                    cb(null);
                }
            },
        ], function (error) {
            var err = error;
            callback(err)
        });
    },
    tree: function (folder, userId, cb) {
        var t1 = Date.now();
        var filePathMap = {};
        filePathMap[folder.path] = folder;
        this.find({
            'user': userId,
            'type': 'FOLDER',
            'path': {
                $regex: new RegExp('^' + folder.path + '/')
            }
        }, {
            path: 1,
            job: 1
        }, function (err, files) {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                filePathMap[file.path] = file;
            }
            var final = [];
            var aux = final;
            var index = {};
            index[folder.path] = {
                _id: folder._id,
                n: folder.name,
                f: [],
                j: folder.job != undefined
            };
            final.push(index[folder.path]);
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var split = file.path.split('/');
                for (var j = 0; j < split.length; j++) {
                    var p = split.slice(0, j + 1).join('/');
                    var foundFile = filePathMap[p];
                    if (foundFile != null) {
                        if (index[p] == null) {
                            var part = split[j];
                            var n = {
                                _id: foundFile._id,
                                n: part,
                                f: [],
                                j: file.job != undefined
                            };
                            aux.push(n);
                            index[p] = n;
                        }
                        aux = index[p].f;
                    }
                }
                aux = final;
            }
            // console.log(util.inspect(final, false, null));
            console.log("Tree time:" + (Date.now() - t1));
            cb(final);
            // console.log('----i---');
            // console.log(util.inspect(index, false, null));
            // console.log('-------');
        });
    }
};

mongoose.model('File', FileSchema);
