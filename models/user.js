const config = require('../config.json');

var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const Schema = mongoose.Schema;
require('./file.js');
const File = mongoose.model('File');

const crypto = require('crypto');
const path = require('path');
const async = require('async');
const shell = require('shelljs');

/**
 * User Schema
 */

const UserSchema = new Schema({
    name: {
        type: String,
        default: '',
        index: {
            unique: true
        }
    },
    email: {
        type: String
    },
    notifications: {
        type: Schema.Types.Mixed,
        default: {
            job: false
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
    // 1GB = 1073741824
    diskQuota: {
        type: Number,
        default: 1073741824
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
        var fsUserHomePath = path.join(config.steviaDir, config.usersPath, user.name);
        if (shell.test('-d', fsUserHomePath)) {
            console.log('User home folder already exists');
        }
        shell.mkdir('-p', fsUserHomePath);
        var homeFolder = new File({
            name: user.name,
            user: user._id,
            path: user.name,
            type: 'FOLDER'
        });
        homeFolder.save(function (err) {
            user.home = homeFolder;
            user.save(function (err) {
                callback();
            });
        });
    },
    updateDiskUsage: function (callback) {
        var user = this;
        var totalSize = 0;

        mongoose.models["File"].aggregate([{
                $match: {
                    "user": this._id

                }
            }, {
                $group: {
                    "_id": "user",
                    totalSize: {
                        $sum: "$size"
                    }
                }

            }],
            function (err, result) {
                if (err) {
                    callback();
                }

                var totalSize = 0;
                try {
                    totalSize = result[0].totalSize;
                } catch (e) {

                }

                user.diskUsage = totalSize;
                console.log("User total size (" + user.name + "): " + user.diskUsage);
                user.save(function () {
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
