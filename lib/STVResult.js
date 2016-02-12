function STVResult(args) {
  this.id = "";
  this.time = -1;
  this.dbTime = -1;
  this.numResults = -1;
  this.numTotalResults = -1;
  this.warningMsg = "";
  this.errorMsg = "";
  this.resultType = "";
  this.results = [];

  this._initialize(args);

}

STVResult.prototype = {
  _initialize: function(args) {
    for (var arg in args) {
      this[arg] = args[arg];
    }
  }

};

module.exports = STVResult;
