const exec = require('child_process').exec;
const config = require('../config.json');

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

function filterByCues(cues) {
    return function (el, index, array) {
        var nextIndex = index + 1;
        if (el.length > 3) {
            // Checks that is not the last item in the array and then checks if
            // the following element has de desired cue name
            while (nextIndex < array.length && array[nextIndex].length === 3) {
                if (cues.indexOf(array[nextIndex][0]) > -1) {
                    return true;
                }
                nextIndex++;
            }
        }

        return false;
    };
}

/**
 * Extracts the number of a string getting rid of the last n characters
 * @param string
 * @returns {Number}
 */
function mParseFloat(string, n) {
    var units = string.slice(string.length - n);
    var number = Number.parseFloat(string.slice(0, string.length - n));
    if (units === "G") {
        number *= 1016;
    }
    return number;
}

function extractMachinesArray(tableString, cues) {
    var headerRows = 2;

    return strTableToArray(headerRows, tableString)
        .filter(filterByCues(cues));
}

// --------------- qstats functions ----------------

function jsonStats(dataArray) {
    var dataArrayLength = dataArray.length;
    var totalCPUUsage = 0;
    var totalMemUsage = 0;
    dataArray.forEach(function sumCPU_MemUsageTotals(row) {
        // Parse the numbers from  strings
        var totalMem = mParseFloat(row[4], 1) || 0;
        var memUse = mParseFloat(row[5], 1) || 0;

        // Just add machine information if we have all the data
        if (!totalMem || !memUse) {
            dataArrayLength--;
        } else {
            totalMemUsage += memUse / totalMem;
            totalCPUUsage += Number.parseFloat(row[3]);
        }
    });

    return {
        cpuUsage: totalCPUUsage / dataArrayLength,
        memUsage: totalMemUsage / dataArrayLength
    };
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

setTimeout(function () {
    var reqStart = new Date();
    var qstat = "qstat";
    var qhost = "qhost -q";

    exec(qstat, function (stderr, stdout) {
        var qstatRows = strTableToArray(2, stdout);
        var numberRunningJobs = countJobs("r", qstatRows);
        var numberWaitingJobs = countJobs("qw", qstatRows);
        exec(qhost, function (stderr, stdout) {
            // Obtain array of machines with the selected cues
            var arrayMachines = extractMachinesArray(stdout, [config.queue]);

            var resultObj = jsonStats(arrayMachines); // Obtain object with info from qhost
            resultObj.jobsRunning = numberRunningJobs; // add the number of jobs to the object
            resultObj.jobsWaiting = numberWaitingJobs; // add the number of jobs to the object
            resultObj.latency = new Date() - reqStart;

            currentStatusObj = resultObj;
        })
    });
}, 3000);

module.exports = function (callback) {
    callback(currentStatusObj);
};
