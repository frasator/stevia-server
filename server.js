// Internal require
const config = require('./config.json');
const checkconfig = require('./lib/checkconfig.js');
const StvResult = require('./lib/StvResult.js');
const StvResponse = require('./lib/StvResponse.js');

require('./models/user.js');
require('./models/file.js');
require('./models/job.js');

// Package require
const mongoose = require("mongoose");
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
    var express = require('express');
    var swagger = require('swagger-express');
    var cors = require('cors');
    var bodyParser = require('body-parser');

    // Create a new Express application
    var app = express();
    app.use(cors({
        origin: true,
        credentials: true
    }));

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

    // Postprocess all requests.
    app.use(function (req, res, next) {
        res.json(res._stvres);
    });

    connect()
        .on('error', console.log)
        .on('disconnected', connect)
        .once('open', listen);

    function listen() {
        //   if (app.get('env') === 'test') return;
        // Bind to a port
        app.listen(config.httpPort);
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
