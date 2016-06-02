'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
require('./file.js');

const File = mongoose.model('File');

const crypto = require('crypto');

const Schema = mongoose.Schema;

/**
 * User Schema
 */

const UserSchema = new Schema({
    email: {
        type: String,
        default: '',
        index: {
            unique: true
        }
    },
    password: {
        type: String,
        default: '',
        select: false
    },
    resetPasswordToken: {
        type: String,
        default: ''
    },
    resetPasswordExpires: {
        type: Date
    },
    diskQuota: {
        type: Number,
        default: 1000000
    },
    diskUsage: {
        type: Number,
        default: 0
    },
    sessions: [{
        id: String,
        date: Date
    }],
    attributes: {
        type: Schema.Types.Mixed,
        default: {}
    },
    home: {
        type: Schema.Types.ObjectId,
        ref: 'File'
    }

}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

UserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

/**
 * Methods
 */

UserSchema.methods = {
    createHomeFolder: function (callback) {
        var user = this;
        var homeFolder = new File({
            name: user.email,
            user: user._id,
            path: user.email,
            type: 'FOLDER'
        });
        homeFolder.save(function (err) {
            user.home = homeFolder;
            user.save(function (err) {
                homeFolder.fsCreateFolder();
                callback();
            });
        });
    },
    removeSessionId: function (sessionId, logoutOther, callback) {
        if (logoutOther === true) {
            this.sessions = [];
            this.save(function (err) {
                callback();
            });
        } else {
            var index = -1;
            for (var i = 0; i < this.sessions.length; i++) {
                var session = this.sessions[i];
                if (session.id === sessionId) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                this.sessions.splice(index, 1);
            }
            this.save(function (err) {
                callback();
            });
        }
    },
    checkSessionId: function (sessionId) {
        for (var i = 0; i < this.sessions.length; i++) {
            var session = this.sessions[i];
            if (session.id === sessionId) {
                return true;
            }
        }
        return false;
    },
    login: function (callback) {
        var user = this;
        crypto.randomBytes(20, function (err, buf) {
            var sessionId = buf.toString('hex');
            var session = {
                id: sessionId,
                date: Date.now()
            };

            user.sessions.push(session);
            user.save(function () {
                callback(session);
            });
        });
    }
};

/**
 * Statics
 */

UserSchema.statics = {};

mongoose.model('User', UserSchema);
