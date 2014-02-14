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

## Documentation

### Objects
**status** - Contains object with human readable text to HTTP status code e.g. status.OK_200 = 200, FORBIDDEN_402 = 402, etc.
**header_plain**  - Response objects default headers for plain text.
**header_json**  -  Response objects default headers for JSON formatted content.
**header_html** -   Response objects default headers for HTML content.

   
### Functions

* __sender(config)__
   This function sets up a *publish* or *push* ZeroMQ socket with the ip address and port supplied in the config parameter.
    * **parameters**  
    *config* - JavaScript object containing the field **spec** whose value is the ip address and port that the function should bind to and the **id** of the connection. *e.g. { spec:'tcp://127.0.0.1:49906', bind:false, id:'c', type:'pub',  isMongrel2:true }*
    ```bash
    {
        spec       : 'Socket IP and Port ',
        bind       : 'Boolean flag for port binding',
        id         : 'Connection ID',
        type       : 'Socket Type: pull, push, pub,. sub',
        isMongrel2 : 'Boolean flag for socket connection to mongrel2',
        subscribe  : 'subscription filter for sub sockets'
    }
    ```
    * **returns**  null


    
* __receiver(config, callback)__
 This function sets up a *pull* or *subscription* ZeroMQ socket with the ip address and port supplied in the config parameter. It attaches the given callback function to the on message event of the queue. I.e. every time a message is received the callback function is executed.
    * **parameters**  
    *config* - JavaScript object containing the field **spec** whose value is the ip address and port that the function should bind to. *e.g. { spec:'tcp://127.0.0.1:49906', bind:false, id:'c', type:'sub',  subscribe:'' }*
    *function* (msg) this callback function is attached to the on message event of the incoming queue. Each time a message is recieved from the queue this function is executed. The message is converted to JavaScript object before it is passed to this function e.g. function(msg){console.log(msg)}*
    * **returns**  null


## Examples

### Example 1: Connect to Mongrel2

This example connects to Mongrel2 instance running on port 49996 and 49997. To configure the Mongrel2 load the configuration file with the following values.

```python

node_handler = Handler(
  send_spec  = 'tcp://127.0.0.1:49997',
  send_ident = '81b7114c-534c-4107-9f17-b317cfd59f62',
  recv_spec  = 'tcp://127.0.0.1:49996',
  recv_ident = ''
)


my_host = Host(name = 'localhost', routes = {
  '/data': node_handler
})


main = Server(
  name         = "my_server",
  port         = 80,
  uuid         = '5dc1fbe7-d9db-4602-8d19-80c7ef2b1b11',
  access_log   = "/logs/access.log",
  error_log    = "/logs/error.log",
  chroot       = ".",
  default_host = "localhost",
  pid_file     = "/run/mongrel2.pid",
  hosts        = [my_host]
)


servers = [main]
```

Next start the Mongrel2 server.

```bash
m2sh load -config my_config_file.conf -db my_mongrel2_conf.db
sudo m2sh start -db my_mongrel2_conf.db -every
```

Create a file named script.js file and paste the following JavaScript.

```javascript
'use strict';

var zmq = require('m2nodehandler');

var mongrel2PubQ = zmq.sender({ spec:'tcp://127.0.0.1:49996', id:'test', bind:false, type:'push' })

zmq.receiver( { spec:'tcp://127.0.0.1:49997', id:'test', bind:false, type:'pull' }, function( msg ) {

   console.log("Headers");
   for (var i in msg.headers ){
      console.log("\t" + i + " :" + msg.headers[i]);
   }
   console.log("UUID   : " + msg.uuid);
   console.log("CONNID : " + msg.connId);
   console.log("Path   : " + msg.path);
   console.log("Body   : " + msg.body);
   console.log("JSON   : " + msg.json);
   console.log();

   var response = zmq.Response( zmq.status.OK_200, zmq.header_json, '{"message":"Hello, World!"}' )

   mongrel2PubQ.send(msg.uuid, msg.connId, response);

});

```

Finally install this module, start the node application and browse to this URL (http://localhost/data/test).

```javascript
npm install git+ssh://git@gitlab.openi-ict.eu:m2nodehandler.git
node script.js
```


### Example 2: Node application to node application

Communications between two small node applications via ZeroMQ. The connection isn't request-reply queue but two separate push-pull queues.

Create a file named node1.js and paste the following code.

```javascript
var zmq   = require('m2nodehandler')

var pushQ = zmq.sender({spec:'tcp://127.0.0.1:49994', id:'nodetest1', bind:false, type:'push'});

zmq.receiver( {spec:'tcp://127.0.0.1:49995', id:'node1', bind:false, type:'pull'}, function( msg ) {

   msg.count = msg.count + 1;

   pushQ.push(msg)

});
```

Create another file called node2.js and paste the following JavaScript.

```javascript
var zmq  = require('m2nodehandler')

var pushQ = zmq.sender({spec:'tcp://127.0.0.1:49995', id:'nodetest2', bind:false, type:'push'});

zmq.receiver( {spec:'tcp://127.0.0.1:49994', id:'node2', bind:false, type:'pull'}, function( msg ) {

   console.log("Count = " + msg.count);

   pushQ.push(msg)

});

pushQ.push({count:0})
```

Finally install this module, start the two node applications in separate consoles. You should see the counter increase on the second console.

```javascript
npm install git+ssh://git@gitlab.openi-ict.eu:m2nodehandler.git
node node1.js
node node2.js
```

## Contributors

* Donal McCarthy (dmccarthy@tssg.org)
* David Benson   (dbenson@tssg.org)
* Dylan Conway (dconway@tssg.org)


## Release History
**0.1.0** *(23/10/14 dmccarthy@tssg.org, dbenson@tssg.org, dconway@tssg.org)* Includes Mongrel2 handler and node-to-node ZMQ communication helpers.


## License
Copyright (c) 2013
Licensed under the MIT license.

