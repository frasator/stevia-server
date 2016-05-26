Stevia Server
=================

Stevia server is a backend for user, file and job management, using web services developed in node and express.

In order to get working you need the following dependencies installed and configured

* SGE
* Mongo
* Node

## Installing SGE
To install Sun Grid Engine check our [installation guide](https://github.com/babelomics/stevia-server/wiki/Installing-Sun-Grid-Engine).

## Installing Mongo
Please read mongodb installation tutorial:
https://docs.mongodb.com/manual/installation/

## Installing Node
To install node click [here.](https://nodejs.org/en/download/package-manager/)
Once installed, node and npm commands will be available

**What is `npm`?** npm stands for [node packaged modules](http://npmjs.org/) is the node dependency manager.

### Install forever
Forever is a simple CLI tool for ensuring that a given script runs continuously
More info [here.](https://github.com/foreverjs/forever)

```bash
sudo npm install -g forever
```

### Clone repository
git clone git@github.com:babelomics/stevia-server.git

### Install npm modules
Go to repository directory and run:

```bash
npm install
```
Now all node dependencies should be installed.

### Configuration
Rename or copy the file **config-example.json** to **config.json**
Rename or copy the file **mail-example.json** to **mail.json**

Configure according to your settings.
Note that **steviaDir** must exists.

### Run the server
```bash
node server.js
```
Or by using forever with the shorthand scripts from bin directory
```bash
bin/start.sh
```
To check if it is running use the following URL on a web browser
```bash
http://localhost:5555
```
