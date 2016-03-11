'use strict';

/**
 * Module dependencies.
 */

 const mongoose = require('mongoose');
 const Schema = mongoose.Schema;
 require('./file.js');
 const File = mongoose.model('File');


/**
 * File Schema
 */

const JobSchema = new Schema({
    qId:{
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

JobSchema.methods = {
    createJobFolder: function(name, parent, user) {
        var newName = parent.getDuplicatedFileName(name);
        var jobFolder = new File({
            name: newName,
            user: user,
            parent: parent,
            job: this._id,
            path: parent.path + '/' + newName,
            type: "FOLDER"
        });
        parent.files.push(jobFolder);
        jobFolder.save();
        parent.save();

        this.folder = jobFolder;
        this.user = user;
        this.save();
        jobFolder.fsCreateFolder(parent);
        user.save();
    }
};

/**
 * Statics
 */

JobSchema.statics = {

};

mongoose.model('Job', JobSchema);
