# m2nodehandler 

m2nodehandler doubles as a node.js Mongrel2 handler and a lightweight abstraction of ZeroMQ messaging functions. It handles node-application-to-node-application communication and node-application-to-mongrel2 communication.

## Getting Started
Install the module with: `npm install git+ssh://git@gitlab.openi-ict.eu:m2nodehandler.git`

You will need to install the following through macports or aptitude.
```bash
sudo port install JsCoverage
sudo port install phantomjs
```
or
```bash 
sudo apt-get install JsCoverage
sudo apt-get install phantomjs
```

To build the project enter the following commands. Note: npm install is only required the first time the module is built or if a new dependency is added. There are a number of grunt tasks that can be executed including: test, cover, default and jenkins. The jenkins task is executed on the build server, if it doesn't pass then the build will fail.

```bash
cd m2nodehandler
npm install
grunt jenkins
```
