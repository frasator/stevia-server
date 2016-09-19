const exec = require('child_process').exec;
const config = require('../config.json');
const xml2js = require('xml2js');

var currentStatusObj = {};

// ----------- Utility functions ----------------
function strTableToArray(startPoint, tableString) {
    var significantRows = tableString
        .split("\n")
        .splice(startPoint) // Eliminte header rows
        .filter(function emptyRows(row) {
            return row.length > 0;

        }).map(function (el) {
            return el.trim().split(/\s+/);
        });
    return significantRows;
}

function countJobs(state, qstatRows) {
    return qstatRows.reduce(function (preVal, currentVal) {
        if (currentVal[4] === state) {
            return preVal + 1;
        } else {
            return preVal;
        }
    }, 0);
}

function processHosts(result) {
    var hostList = [];
    var hosts = result.qhost.host;
    for (var i = 0; i < hosts.length; i++) {
        var h = hosts[i];
        if (isQueueHost(h)) {
            hostList.push(getHostObj(h));
        }
    }
    return hostList;
}

function isQueueHost(h) {
    var matchQueue = false;
    if(h.queue != null){
        for (var j = 0; j < h.queue.length; j++) {
            var q = h.queue[j];
            if (q.$.name === config.queue) {
                matchQueue = true;
                break;
            }
        }
    }
    return matchQueue;
}

function getHostObj(h) {
    var host = {};
    host.name = h.$.name;
    // console.log(h);
    for (var i = 0; i < h.hostvalue.length; i++) {
        var hv = h.hostvalue[i];
        if(hv.$.name != 'arch_string'){
            var value = hv._;
            var units = value.slice(value.length - 1);
            var mult = 1;
            if(units == 'K'){
                mult = 1024;
            }
            if(units == 'M'){
                mult = 1024*1024;
            }
            if(units == 'G'){
                mult = 1024*1024*1024;
            }
            if(units == 'T'){
                mult = 1024*1024*1024*1024;
            }
            if(value == '-'){
                value = 0;
            }
            host[hv.$.name] = parseFloat(value)*mult;
        }
    }
    return host;
}

// --------------------------------------------

function check() {
    var reqStart = new Date();
    var qstat = "qstat";
    var qhost = "qhost -q -xml";

    exec(qstat, function (error, stdout, stderr) {
        var qstatRows = strTableToArray(2, stdout);
        var numberRunningJobs = countJobs("r", qstatRows);
        var numberWaitingJobs = countJobs("qw", qstatRows);
        exec(qhost, function (error, stdout, stderr) {

            xml2js.parseString(stdout, function (err, result) {
                if (result != null) {
                    var hosts = processHosts(result);

                    var sum_mem = 0;
                    var sum_cpu = 0;
                    for (var i = 0; i < hosts.length; i++) {
                        var h = hosts[i];
                        sum_mem += h.mem_used / h.mem_total;
                        sum_cpu += h.load_avg / h.num_proc;
                    }

                    var resultObj = {};
                    resultObj.cpuUsage = sum_cpu / hosts.length;
                    resultObj.memUsage = sum_mem / hosts.length;
                    resultObj.jobsRunning = numberRunningJobs; // add the number of jobs to the object
                    resultObj.jobsWaiting = numberWaitingJobs; // add the number of jobs to the object
                    resultObj.latency = new Date() - reqStart;
                    currentStatusObj = resultObj;
                }
            });
        })
    });
};

check();
setInterval(check, 3000);

module.exports = function (callback) {
    // console.log(currentStatusObj);
    callback(currentStatusObj);
};
