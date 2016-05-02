var util = require('util');

/**
 * Module dependencies.
 */

var exec = require('child_process').exec;
var config = require('../config.json');
var remove = require('remove');
const mongoose = require('mongoose');
// require('./user.js');
// require('./job.js');

const crypto = require('crypto');

const Schema = mongoose.Schema;

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

/**
 * Methods
 */

FileSchema.methods = {
    addFile: function (file) {
        this.files.push(file);
    },
    hasFile: function (name) {
        try {
            var stats = fs.statSync(this.path + '/' + name);
            return null;
        } catch (e) {
            var foundFile = null;
            for (var i = 0; i < this.files.length; i++) {
                var file = this.files[i];
                if (file.name === name) {
                    foundFile = file;
                    break;
                }
            }
            return foundFile;
        }
    },
    getDuplicatedFileName: function (name) {
        var suffix = 0;
        var nameToCheck = name;
        while (this.hasFile(nameToCheck) != null) {
            suffix++;
            nameToCheck = name + '-' + suffix;
        }
        return nameToCheck;
    },
    removeChilds: function () {
        if (this.files.length == 0) {
            this.remove();
            if (this.job) {
                this.job.remove();
            }
        } else {
            for (var i = 0; i < this.files.length; i++) {
                var file = this.files[i];
                var fileObject = mongoose.models["File"].findOne({
                    _id: file
                }, function (err, fileChild) {
                    fileChild.removeChilds();
                    fileChild.remove();
                    if (fileChild.job) {
                        fileChild.job.remove();
                    }
                }).populate('job');
            }
        }
    },
    fsCreateFolder: function (parent) {
        var userspath = config.steviaDir + config.usersPath;
        try {
            var stats = fs.statSync(userspath);
        } catch (e) {
            fs.mkdirSync(userspath);
        }

        var realPath;
        if (parent != undefined) {
            var parentPath = parent.path + '/';
            realPath = userspath + parentPath + this.name;
        } else {
            realPath = userspath + this.name;
        }
        try {
            fs.mkdirSync(realPath);
        } catch (e) {
            console.log("File fsCreateFolder: file already exists on file system");
        }
    },
    fsDelete: function () {
        if (this.path == null || this.path == '') {
            console.log("File fsDelete: file path is null or ''.")
        } else {
            var userspath = config.steviaDir + config.usersPath;
            var realPath = userspath + this.path;
            //check exists
            try {
                remove.removeSync(realPath);
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
    createFolder: function (name, parent, user) {
        var folder = new this({
            name: name,
            user: user._id,
            parent: parent._id,
            type: "FOLDER",
            path: parent.path + '/' + name
        });

        parent.files.push(folder);
        folder.save();
        parent.save();
        user.save();

        folder.fsCreateFolder(parent);

        return folder;
    },
    createFile: function (name, parent, user) {
        var file = new this({
            name: name,
            user: user._id,
            parent: parent._id,
            type: "FILE",
            path: parent.path + '/' + name
        });

        parent.files.push(file);
        file.save();
        parent.save();
        user.save();

        return file;
    },
    delete: function (file, parent, job) {
        if (job != null) {
            if (job.status === "RUNING") {
                console.log("File.delete: this folder can not be deleted because the job associated is RUNING.");
                return;
            }
            exec('qdel -f ' + job.qId, function (error, stdout, stderr) {
                console.log('qdel: Trying to remove the job from queue...');
                console.log('qdel: ' + stdout);
                console.log('qdel: end.');
            });
            job.remove();
        }

        if (parent != null) {
            var index = parent.files.indexOf(file._id);
            if (index != -1) {
                parent.files.splice(index, 1);
                parent.save();
            }
        }

        file.job = null;

        file.removeChilds();
        file.remove();

        file.fsDelete();
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

            var fileName = newParent.getDuplicatedFileName(file.name);
            file.name = fileName;
        }

        var oldPath = config.steviaDir + config.usersPath + file.path;
        var newPath = config.steviaDir + config.usersPath + newParent.path + "/" + file.name;

        try {
            fs.renameSync(oldPath, newPath);
        } catch (e) {
            console.log("old " + oldPath)
            console.log("new " + newPath)
            callback(e);
            return;
        }

        var index = oldParent.files.indexOf(file._id);
        if (index != -1) {
            oldParent.files.splice(index, 1);
            oldParent.save();
        }

        newParent.files.push(file);
        newParent.save();
        var filePath = file.path;

        file.parent = newParent;
        file.path = newParent.path + "/" + file.name;
        file.save();

        if (file.type == 'FOLDER') {
            this.find({
                'user': file.user,
                'path': {
                    $regex: new RegExp('^' + filePath)
                }
            }, function (error, files) {
                if (error) {
                    err = error;
                    console.log(error);
                } else {
                    var regex = new RegExp('^' + filePath)
                    for (var i = 0; i < files.length; i++) {
                        var f = files[i];
                        f.path = f.path.replace(regex, file.path);
                        f.save();
                    }
                }
                callback(err);
            });
        } else {
            callback(err);
        }

    },
    tree: function (folder, userId, cb) {
        var t1 = Date.now();
        var filePathMap = {};
        filePathMap[folder.path] = folder;
        this.find({
            'user': userId,
            'type': 'FOLDER',
            'path': {
                $regex: new RegExp('^' + folder.path)
            }
        }, {
            path: 1
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
                f: []
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
                                f: []
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
