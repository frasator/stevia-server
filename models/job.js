'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
require('./file.js');

const crypto = require('crypto');

const Schema = mongoose.Schema;

/**
 * File Schema
 */

const JobSchema = new Schema({

});

/**
 * Methods
 */

JobSchema.methods = {

};

/**
 * Statics
 */

JobSchema.statics = {};

mongoose.model('Job', JobSchema);
