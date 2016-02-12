'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const utils = require('../lib/utils.js');

const Schema = mongoose.Schema;

/**
 * User Schema
 */
// {

//            "id" : "CqDZHgX8hH1W3OwYVgBW",
//            "ip" : "172.24.78.100",
//            "login" : "20150120170059",
//            "logout" : ""
//        },

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

  removeSessionId: function(sessionId) {

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
    this.save()
  },
  updateLastActivity: function() {
    this.lastActivity = Date.now();
    this.save();
  },
  login: function() {

    var sessionId = utils.generateRandomString();
    var session = {
      id: sessionId,
      data: Date.now()
    };

    this.sessions.push(session);
      this.save();

    return session;

  }

};

/**
 * Statics
 */

UserSchema.statics = {};

mongoose.model('User', UserSchema);
