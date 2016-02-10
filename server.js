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
    var cors = require('cors');

    // Routes includes
    var testRoute = require('./routes/test');

    // Create a new Express application
    var app = express();
    app.use(cors());

    // Routes use
    app.use('/test', testRoute);

    app.get('/', function(req, res) {
        res.send('I am alive!');
    });

    // Bind to a port
    app.listen(5555);
    console.log('Worker %d running!', cluster.worker.id);
}
