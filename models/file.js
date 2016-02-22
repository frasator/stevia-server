'use strict';


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
        type: String,
        default: '',
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
        createdAt: 'created_at',
        updatedAt: 'updated_at'
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
        var foundFile = null;
        for (var i = 0; i < this.files.length; i++) {
            var file = this.files[i];
            if (file.name === name) {
                foundFile = file;
                break;
            }
        }
        return foundFile;
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
        fs.mkdirSync(realPath);
    },
    fsDelete: function() {
        var userspath = config.steviaDir + config.usersPath;
        var realPath = userspath + this.path;
        remove.removeSync(realPath);
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
    }
};

mongoose.model('File', FileSchema);
