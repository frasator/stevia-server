const fs = require('fs');
const path = require('path');

const shell = require('shelljs');
const async = require('async');
const util = require('util');

const xml2js = require('xml2js');
var parser = new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true
});
const xmlbuilder = require('xmlbuilder');
var report = xmlbuilder.create('report',
    null, null, {
        allowSurrogateChars: false,
        skipNullAttributes: false,
        headless: true,
        ignoreDecorators: false,
        separateArrayItems: true,
        noDoubleEncoding: false,
        stringify: {}
    });

var args = process.argv.slice(2);
var resultFilePath = args[0];
var outFolderPath = path.dirname(resultFilePath);
console.log(resultFilePath);
console.log(outFolderPath);

var resultContent = shell.cat(resultFilePath.toString());

function log(x) {
    console.log(util.inspect(x, true, 5, true));
}

parser.parseString(resultContent, function (err, r) {
    if (r != null) {
        // log(r)

        var tool;
        for (var i = 0; i < r.result.metadata[0].item.length; i++) {
            var item = r.result.metadata[0].item[i];
            if (item.$.name == 'tool') {
                tool = item._;
            }
        }
        var groups = {};
        for (var i = 0; i < r.result.output[0].item.length; i++) {
            var item = r.result.output[0].item[i];
            if (groups[item.$.group] == null) {
                groups[item.$.group] = [];
            }
            groups[item.$.group].push(item);
        }

        log(r.result.output[0].item[0])

        for (var i = 0; i < groups.length; i++) {
            var item = r.result.output[0].item[i];
            if (groups[item.$.group] == null) {
                groups[item.$.group] = [];
            }
            groups[item.$.group].push(item);
        }
        // var report = {
        //     $: {
        //         tool: tool
        //     },
        //     'input-params': {
        //         _: ' '
        //     },
        //     'output-params': [
        //
        //     ]
        // };
        console.log(Object.keys(groups));
        report.att('tool', tool);
        report.ele('input-params', {}, ' ');
        var output = report.ele('output-params');
        for (var gname in groups) {
            var gsplit = gname.split('.');
            var level = gsplit.length - 1;
            output.ele('section', {
                level: level,
                title: gsplit[level]
            });
            for (var i = 0; i < groups[gname].length; i++) {
                var item = groups[gname][i];
                if (item.$.type == 'MESSAGE') {
                    output.ele('param', {
                        level: level + 1,
                        key: item.$.title,
                        title: item._
                    });
                } else if (item.$.type == 'FILE') {
                    if (item.$.tags.split(',').indexOf('TABLE') == -1) {
                        output.ele('download', {
                            level: level + 1,
                            title: item.$.title,
                            file: item._
                        });
                    } else {
                        output.ele('table', {
                            level: level + 1,
                            title: item.$.title,
                            file: item._,
                            'page-size': 10
                        });
                    }
                }
                // log(item);
            }
        }

        // log(groups)
        // log(reportBuilder.builder)
        // var report = reportBuilder.buildObject(report);
        var reportXML = report.end({
            'pretty': true,
            'indent': ' ',
            'newline': '\n'
        })+'\n';
        console.log(reportXML);
        fs.writeFileSync(path.join(outFolderPath,'report.xml'), reportXML);


        // var items = [];
        // var l1 = result.job_info.queue_info[0].job_list;
        // var l2 = result.job_info.job_info[0].job_list;
        // if (l1 != null) {
        //     items = items.concat(l1);
        // }
        // if (l2 != null) {
        //     items = items.concat(l2);
        // }
        // for (var i = 0; i < items.length; i++) {
        //     var item = items[i];
        //     var jobName = item.JB_name[0];
        //     var state = item.state[0];
        //     jobs[jobName] = {
        //         qId: jobName,
        //         state: state
        //     };
        // }
    }
});
