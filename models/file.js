var util = require('util');

/**
 * Module dependencies.
 */

var fs = require('fs');
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
    addFile: function(file) {
        this.files.push(file);
    },
    hasFile: function(name) {
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
    getDuplicatedFileName: function(name) {
        var suffix = 0;
        var nameToCheck = name;
        while (this.hasFile(nameToCheck) != null) {
            suffix++;
            nameToCheck = name + '-' + suffix;
        }
        return nameToCheck;
    },
    removeChilds: function() {
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
                }, function(err, fileChild) {
                    fileChild.removeChilds();
                    fileChild.remove();
                    if (fileChild.job) {
                        fileChild.job.remove();
                    }
                }).populate('job');
            }
        }
    },
    fsCreateFolder: function(parent) {
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
    fsDelete: function() {
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
    getFile: function(fileId, callback) {
        var fid = new ObjectId(fileId);
        return this.findOne({
            "_id": fid
        }).exec(callback);
    },
    createFolder: function(name, parent, user) {
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
    createFile: function(name, parent, user) {
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
    delete: function(file, parent, job) {
        if(parent != null){
            var index = parent.files.indexOf(file._id);
            if (index != -1) {
                parent.files.splice(index, 1);
                parent.save();
            }
        }

        if (job != null) {
            job.remove();
        }
        file.job = null;

        file.removeChilds();
        file.remove();

        file.fsDelete();
    },
    tree: function(folder, userId, cb) {
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
        }, function(err, files) {
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
            cb(final);
            // console.log('----i---');
            // console.log(util.inspect(index, false, null));
            // console.log('-------');
        });
    }
};

mongoose.model('File', FileSchema);
