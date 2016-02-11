'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
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
        default: ''
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    diskQuota: {
        type: Number,
        default: 1000000
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
    }
});

/**
 * Methods
 */

UserSchema.methods = {

};

/**
 * Statics
 */

UserSchema.statics = {};

mongoose.model('User', UserSchema);
