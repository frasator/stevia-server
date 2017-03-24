const config = require('../config.json');

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;
require('./file.js');
const File = mongoose.model('File');

const path = require('path');
const async = require('async');
const shell = require('shelljs');

/**
 * File Schema
 */

const JobSchema = new Schema({
    qId: {
        type: String,
        default: '',
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    name: {
        type: String,
        default: '',
    },
    description: {
        type: String,
        default: '',
    },
    tool: {
        type: String,
        default: '',
    },
    execution: {
        type: String,
        default: '',
    },
    executable: {
        type: String,
        default: '',
    },
    /*QUEUED RUNNING DONE ERROR EXEC_ERROR QUEUE_ERROR QUEUE_WAITING_ERROR*/
    status: {
        type: String,
        default: '',
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'File'
    },
    commandLine: {
        type: String,
        default: '',
    },
    options: {
        type: Schema.Types.Mixed,
        default: {}
    },
    attributes: {
        type: Schema.Types.Mixed,
        default: {}
    },
    olog: {
        type: Schema.Types.ObjectId,
        ref: 'File'
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'

    }
});

JobSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

/**
 * Methods
 */

JobSchema.methods = {
    createJobFolder: function (name, parent, user, callback) {
        var job = this;
        File.createFolder(name, parent, user, function (folder) {
            folder.job = job._id;
            job.folder = folder._id;
            job.user = user._id;


            async.each([folder, job], function(dbItem, savecb) {
                dbItem.save(function(err){
                    savecb(err);
                });
            }, function(err) {
                callback(err)
            });
        });
    }
};

/**
 * Statics
 */

JobSchema.statics = {

};

mongoose.model('Job', JobSchema);
