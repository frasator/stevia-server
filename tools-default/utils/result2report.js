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
// console.log(resultFilePath);
// console.log(outFolderPath);

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
                break;
            }
        }

        var groups = {};
        for (var i = 0; i < r.result.output[0].item.length; i++) {
            var item = r.result.output[0].item[i];
            var gsplit = item.$.group.split('.');
            for (var j = 0; j < gsplit.length; j++) {
                var group = gsplit.slice(0, j + 1).join('.');
                if (groups[group] == null) {
                    groups[group] = [];
                }
            }
            groups[item.$.group].push(item);
        }
        var groupNames = Object.keys(groups);
        var aux = [];
        var map = {};
        for (var i = 0; i < groupNames.length; i++) {
            var n = groupNames[i];
            var arr = n.split('.');
            var parentGroupName = arr.slice(0, arr.length - 1).join('.');
            var x = {
                n: n,
                groups: []
            }
            if (parentGroupName == "") {
                aux.push(x);
                map[n] = x;
            } else {
                if (map[n] == null) {
                    map[n] = x;
                }
                map[parentGroupName].groups.push(x);
            }
        }
        var orderedNames = [];
        var read = function (el) {
            orderedNames.push(el.n);
            if (el.groups.length > 0) {
                for (var i = 0; i < el.groups.length; i++) {
                    read(el.groups[i]);
                }
            }
        };
        for (var i = 0; i < aux.length; i++) {
            read(aux[i]);
        }
        var orderedGroups = {}
        for (var i = 0; i < orderedNames.length; i++) {
            var name = orderedNames[i];
            orderedGroups[name] = groups[name];
        }

        // log(aux);
        // log(orderedGroups);
        // log(groups)

        // for (var i = 0; i < groups.length; i++) {
        //     var item = r.result.output[0].item[i];
        //     if (groups[item.$.group] == null) {
        //         groups[item.$.group] = [];
        //     }
        //     groups[item.$.group].push(item);
        // }
        // console.log(Object.keys(groups));
        report.att('tool', tool);
        report.ele('input-params', {}, '');
        var output = report.ele('output-params');

        /*PRE*/
        var PVALUE_FATIGO = "";
        for (var gname in orderedGroups) {
            for (var i = 0; i < orderedGroups[gname].length; i++) {
                var item = orderedGroups[gname][i];
                if (item.$.tags == 'GO_NETWORKVIEWER') {
                    var files = item._.split(',');
                    PVALUE_FATIGO = item.$.pvalue;
                }
            }
        }

        for (var gname in orderedGroups) {
            var gsplit = gname.split('.');
            var level = gsplit.length - 1;
            output.ele('section', {
                level: level,
                title: gsplit[level]
            });
            for (var i = 0; i < orderedGroups[gname].length; i++) {
                var item = orderedGroups[gname][i];

                if (item.$.tags.indexOf('GO_NETWORKVIEWER') != -1) {
                    var files = item._.split(',');
                    var pvalue
                    output.ele('goViewer', {
                        level: level,
                        title: item.$.title,
                        "sub-network": files[0],
                        "sub-attributes": files[1],
                        "all-attributes": files[2],
                    });
                } else if (item.$.tags.indexOf('INTERACTOME_VIEWER') != -1) {
                    var tags = item.$.tags.split(",");
                    var intermediates = "";
                    var seeds = "";
                    if (tags[3] != null)
                        intermediates = tags[3];
                    if (tags[4] != null)
                        seeds = tags[4];
                    output.ele('download', {
                        level: level + 1,
                        title: item.$.title,
                        file: item._
                    });
                    output.ele('interactomeViewer', {
                        level: level,
                        title: item.$.title,
                        "network": item._,
                        "intermediates": intermediates,
                        "seeds": seeds
                    });
                } else if (item.$.tags.indexOf('NETWORKMINER_JSON') != -1) {
                    output.ele('networkMinerPlot', {
                        level: level,
                        title: item.$.title,
                        file: item._
                    });
                } else if (item.$.type == 'MESSAGE') {
                    output.ele('param', {
                        level: level + 1,
                        key: item.$.title,
                        value: item._
                    });
                } else if (item.$.type == 'FILE') {
                    if (item.$.tags.split(',').indexOf('REDIRECT_TOOL_SNOW') != -1) {
                        var splits = item.$.tags.split(',');
                        output.ele('redirection', {
                            tool: 'snow',
                            level: level + 1,
                            interactome: splits[1],
                            type: splits[2],
                            group: splits[3],
                            intermediate: splits[5],
                            inputFile: item._
                        })
                    } else if (item.$.tags.split(',').indexOf('REDIRECT_TOOL_FATIGO') != -1) {
                        var splits = item.$.tags.split(',');

                        output.ele('redirection', {
                            tool: 'fatigo',
                            level: level + 1,
                            species: splits[1],
                            inputFile: item._,
                            inputFile2: splits[4]

                        })

                    } else if (item.$.tags.split(',').indexOf('STV_BOXPLOT') != -1) {
                      var splits = item.$.tags.split(',');

                      output.ele('boxplot',{
                        level: level + 1,
                        title: item.$.title,
                        file: splits[1],
                        outliers:splits[2]
                      });

                    } else if (item.$.tags.split(',').indexOf('TABLE') == -1) {

                        output.ele('download', {
                            level: level + 1,
                            title: item.$.title,
                            file: item._
                        });
                    } else {
                        var print = true;
                        if (PVALUE_FATIGO != "" && item.$.context != "" && item.$.context.indexOf(PVALUE_FATIGO) == -1) {
                            print = false;
                        }
                        if (print) {
                            output.ele('table', {
                                level: level + 1,
                                title: item.$.title,
                                file: item._,
                                'page-size': 10
                            });
                        }
                    }
                } else if (item.$.type == 'IMAGE') {
                    output.ele('image', {
                        level: level + 1,
                        title: item.$.title,
                        file: item._
                    });
                }
                // console.log(item);
            }
        }

        // console.log(outFolderPath)

        var reportXML = report.end({
            'pretty': true,
            'indent': ' ',
            'newline': '\n'
        }) + '\n';
        console.log(reportXML);
        fs.writeFileSync(path.join(outFolderPath, 'report.xml'), reportXML);
    }
});
