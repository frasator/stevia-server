var config = require('./config.json');
var mongoose = require("mongoose");
require('./models/user.js');
require('./models/file.js');
require('./models/job.js');
var StvResult = require('./lib/StvResult.js');
var StvResponse = require('./lib/StvResponse.js');
var fs = require('fs');

// Include the cluster module
var cluster = require('cluster');

if (cluster.isMaster) {
    // Code to run if we're in the master process

    // Check config directory
    var stats = fs.stat(config.steviaDir, function(err, stats) {
        if (err != null) {
            console.log(err);
        } else {
            try {
                fs.mkdirSync(config.steviaDir + config.toolPath);
                fs.mkdirSync(config.steviaDir + config.usersPath);
            } catch (e) {

            }

            // Count the machine's CPUs
            var cpuCount = require('os').cpus().length;

            // Create a worker for each CPU
            for (var i = 0; i < cpuCount; i += 1) {
                cluster.fork();
            }

            // Listen for dying workers
            cluster.on('exit', function(worker) {
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

    // Includes
    var express = require('express');
    var swagger = require('swagger-express');
    var cors = require('cors');
    var bodyParser = require('body-parser');

    // Create a new Express application
    var app = express();
    app.use(cors());

    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies
    app.use(bodyParser.json()); // support json encoded bodies

    app.use(swagger.init(app, {
        apiVersion: '1.0',
        swaggerVersion: '1.0',
        swaggerURL: '/swagger',
        // swaggerJSON: '/api-docs.json',
        swaggerUI: './public/swagger/',
        basePath: 'http://localhost:5555',
        info: {
            title: 'TITLE',
            description: 'DESC'
        },
        apis: ['./routes/user.js'],
        middleware: function(req, res) {}
    }));

    // Preprocess all requests.
    app.use(function(req, res, next) {
        res._stvres = new StvResponse({
            queryOptions: req.query
        });
        next();
    });

    // Routes includes
    var testRoute = require('./routes/test');
    var userRoute = require('./routes/user');
    var fileRoute = require('./routes/file');
    var jobRoute = require('./routes/job');

    // Routes use
    app.use('/test', testRoute);
    app.use('/users', userRoute);
    app.use('/files', fileRoute);
    app.use('/jobs', jobRoute);

    app.get('/', function(req, res) {
        console.log(req.params);
        res.send('I am alive!');
    });

    // Postprocess all requests.
    app.use(function(req, res, next) {
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
            }
        };
        return mongoose.connect(config.mongodb, options).connection;
    }
}
