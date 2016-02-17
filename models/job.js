'use strict';

/**
 * Module dependencies.
 */

 const mongoose = require('mongoose');
 const Schema = mongoose.Schema;
 require('./file.js');
 const File = mongoose.model('File');

const crypto = require('crypto');


/**
 * File Schema
 */

const JobSchema = new Schema({
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
    args: {
        type: Schema.Types.Mixed,
        default: {}
    },
    attributes: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: {
        createdAt: 'created_at'
    }
});

/**
 * Methods
 */

JobSchema.methods = {
    createJobFolder: function(name, parent) {
        var jobFolder = new File({
            name: name,
            user: parent.user,
            parent: parent,
            job: me._id,
            type: "FOLDER"
        });
        parent.files.push(jobFolder);
        jobFolder.save();
        parent.save();

        this.folder = jobFolder;
        this.user = jobFolder.user
        this.save();
    }
};

/**
 * Statics
 */

JobSchema.statics = {

};

mongoose.model('Job', JobSchema);
