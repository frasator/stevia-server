function StvResult(args) {
    this.id = "";
    this.time = -1;
    this.numResults = -1;
    this.numTotalResults = -1;
    this.warning;
    this.error;
    this.resultType = "";
    this.results = [];

    this._initialize(args);
    this.start();
}

StvResult.prototype = {
    _initialize: function(args) {
        for (var arg in args) {
            this[arg] = args[arg];
        }
    },
    _start: null,
    start: function() {
        this._start = Date.now();
    },
    end: function() {
        this.time = Date.now() - this._start;
        delete this._start;
        this.numResults = this.results.length;
        if (this.numTotalResults == -1) {
            this.numTotalResults = this.numResults;
        }
    }
};

module.exports = StvResult;
