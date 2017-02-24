// Internal require
const config = require('./config.json');
const checkconfig = require('./lib/checkconfig.js');
const status = require('./lib/status.js');
const StvResult = require('./lib/StvResult.js');
const StvResponse = require('./lib/StvResponse.js');

require('./models/user.js');
require('./models/file.js');
require('./models/job.js');

// Package require
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const cluster = require('cluster');

if (cluster.isMaster) {
    // Code to run if we're in the master process
    checkconfig(function (err) {
        if (err == null) {

            // Count the machine's CPUs
            var cpuCount = Math.min(require('os').cpus().length, 10);

            // Create a worker for each CPU
            console.log('');
            console.log('Starting server workers...');
            console.log('===================');
            for (var i = 0; i < cpuCount; i += 1) {
                cluster.fork();
            }

            // Listen for dying workers
            cluster.on('exit', function (worker) {
                // Replace the dead worker, we're not sentimental
                console.log('Worker %d died :(', worker.id);
                cluster.fork();
            });

        }
    });

} else {
    //  Code to run if we're in a worker process
    /******************************/
    /****** Server instance *******/
    /******************************/
    var urlPathPrefix = config.urlPathPrefix || "";

    // Includes
    var compression = require('compression');
    var express = require('express');
    var morgan = require('morgan');
    var fs = require('fs');
    var path = require('path');
    var swagger = require('swagger-express');
    var cors = require('cors');
    var bodyParser = require('body-parser');

    var logDirectory = path.join(__dirname, 'logs');

    // custom morgan tokens

    morgan.token('app', function getApp(req) {
        var app = req.get('x-stv-app');
        if (app == undefined) {
            app = "-";
        }
        return app;
    });

    morgan.token('user', function getUser(req) {
        var user = req.get('x-stv-user');
        if (user == undefined) {
            user = "-";
        }
        return user;
    });

    morgan.token('api', function getApi(req) {
        var api = req.get('x-stv-api');
        if (api == undefined) {
            api = "-";
        }
        return api;
    });

    morgan.token('action', function getAction(req) {
        var action = req.get('x-stv-action');
        if (action == undefined) {
            action = "-";
        }
        return action;
    });

    morgan.token('query', function getQuery(req) {
        return JSON.stringify(req.query);
    });

    // ensure log directory exists
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)

    accessLogStream = fs.createWriteStream(path.join(logDirectory, 'access.log'), {
        flags: 'a'
    })

    // Create a new Express application
    var app = express();
    app.use(morgan(':remote-addr\t:date[iso]\t:method\t:url\t:status\t:referrer\t:app\t:user\t:api\t:action\t:query\t:response-time', {
        stream: accessLogStream
    }))
    app.use(compression());
    app.use(cors({
        origin: true,
        credentials: true
    }));

    app.use(bodyParser.text());
    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies
    app.use(bodyParser.json()); // support json encoded bodies

    app.use(swagger.init(app, {
        apiVersion: '1.0',
        swaggerVersion: '1.0',
        swaggerURL: urlPathPrefix + '/swagger',
        // swaggerJSON: '/api-docs.json',
        swaggerUI: './public/swagger/',
        basePath: 'http://localhost:5555',
        info: {
            title: 'TITLE',
            description: 'DESC'
        },
        apis: ['./routes/user.js'],
        middleware: function (req, res) {}
    }));

    // Preprocess all requests.
    app.use(function (req, res, next) {
        res._stvres = new StvResponse({
            queryOptions: req.query
        });
        var authorization = req.get('Authorization');
        if (authorization != null) {
            req._sid = authorization.split('sid ')[1];
        } else if (req.query.sid != null) {
            req._sid = req.query.sid;
        }
        next();
    });

    // Routes includes
    var userRoute = require('./routes/user');
    var fileRoute = require('./routes/file');
    var jobRoute = require('./routes/job');

    // Routes use
    app.use(urlPathPrefix + '/users', userRoute);
    app.use(urlPathPrefix + '/files', fileRoute);
    app.use(urlPathPrefix + '/jobs', jobRoute);

    // Views set
    app.set('views', './views');
    app.set('view engine', 'jade');

    app.get(urlPathPrefix + '/', function (req, res) {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        res.send('I am alive!');
    });

    /* ************** */
    /* Cluster status */
    /* ************** */
    app.get(urlPathPrefix + '/status', function (req, res) {
        status(function (statusObj) {
            res.json(statusObj); // Send results
        });
    });

    // Postprocess all requests.
    app.use(function (req, res, next) {
        res.json(res._stvres);
    });

    RETRY = false;
    connect()
        .on('error', function (error) {
            console.log(error.toString());
            mongoose.connection.close(function () {
                retry();
            });
        })
        .on('disconnected', function (a) {
            console.log('Mongo disconnected!');
            mongoose.connection.close(function () {
                retry();
            });
        })
        .once('open', listen);

    function retry() {
        if (RETRY == false) {
            RETRY = true;
            setTimeout(function () {
                RETRY = false;
                connect();
            }, 5000)
        }
    }

    function listen() {
        //   if (app.get('env') === 'test') return;
        // Bind to a port
        var server = app.listen(config.httpPort);
        server.timeout = 360000;
        console.log('Worker %d running!', cluster.worker.id);
    }

    function connect() {
        var options = {
            server: {
                socketOptions: {
                    keepAlive: 120
                }
            },
            config: {
                autoIndex: false
            }
        };
        return mongoose.connect(config.mongodb, options).connection;
    }
}
