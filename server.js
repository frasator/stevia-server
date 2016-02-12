var config = require('./config.json');
var mongoose = require("mongoose");
var userModel = require('./models/user.js');
var userModel = require('./models/file.js');
var userModel = require('./models/job.js');


// Include the cluster module
var cluster = require('cluster');

if (cluster.isMaster) {
  // Code to run if we're in the master process

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


    // Routes includes
    var testRoute = require('./routes/test');
    var userRoute = require('./routes/user');
    var fileRoute = require('./routes/file');
    var jobRoute = require('./routes/job');

    // Routes use
    app.use('/test', testRoute);
    app.use('/user', userRoute);
    app.use('/file', fileRoute);
    app.use('/job', jobRoute);

    app.get('/', function(req, res) {
        console.log(req.params);
        res.send('I am alive!');
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
