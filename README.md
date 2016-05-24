Stevia Server
=================

### Install Open Grid Scheduler
Please go to Open Grid Scheduler home page:
http://gridscheduler.sourceforge.net/

Binary(x64) http://dl.dropbox.com/u/47200624/respin/ge2011.11.tar.gz

...(TODO)

### Install mongodb
Please read mongodb installation tutorial:
https://docs.mongodb.com/manual/installation/

...(TODO)


### Install Node
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

### Run the server
```bash
node server.js
```
or by using forever with shorthand scripts from bin directory
```bash
bin/start.sh
```
Check web services are Running using the following URL on a web browser
```bash
http://localhost:5555
```
