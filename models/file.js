'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
require('./user.js');
require('./job.js');


const crypto = require('crypto');
const ObjectId = require('mongoose').Types.ObjectId;

const Schema = mongoose.Schema;

/**
 * File Schema
 */

const FileSchema = new Schema({
    name: {
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
    createFolder: function(name) {

        var folder = new File({
            name: name,
            user: this.user._id,
            parent: this._id,
            type: "FOLDER"
        });

        this.files.push(folder);
        folder.save();

        this.save();
        user.save();
        return folder;
    },
    removeChilds: function() {
        if (this.files.length == 0) {
            this.remove();
        } else {
            for (var i = 0; i < this.files.length; i++) {
                var file = this.files[i];
                var fileObject = mongoose.models["File"].findOne({
                    _id: file
                }, function(err, fileChild) {
                    fileChild.removeChilds();
                    fileChild.remove();
                })
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
    }
};

mongoose.model('File', FileSchema);
