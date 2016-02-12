var utils = {

  generateRandomString: function() {
    var length = 20;
    return Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1);

  }

}
module.exports = utils;
