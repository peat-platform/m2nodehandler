# m2nodehandler 

m2nodehandler doubles as a node.js Mongrel2 handler and a lightweight abstraction of ZeroMQ messaging functions. It handles node-application-to-node-application communication and node-application-to-mongrel2 communication.



### API
The following are a list of objects and functions exposed by this module.

###objects

**status** - object with a number of human readable HTTP status codes

**standard_headers** is an object with a number of preset headers.

    *plain*  - default headers for plain text.
    *json*  -  default headers for JSON formatted content.
    *html* -  default headers for HTML content.

   
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
    
Example of sender in action
```JSON
var sink = {spec:'tcp://127.0.0.1:49904', id:'f', bind:false, type:'pub',  isMongrel2:true }

var sender = zmq.sender(sink)

//uuid & connId are mongrel2 specific variables which can be extracted from the incoming message
sender.send(uuid, connId, 200, zmq.standard_headers.json, {"message" : "Hello World!"});

```

    
* __receiver(source, client, callback(msg))__
 This function sets up a *pull* or *subscription* ZeroMQ socket with the ip address and port supplied in the source parameter. The client parameter points to the Mongrel2 response queue, it is used to notify the client of errors that occur within the handler. It attaches the given callback function to the on message event of the queue. I.e. every time a message is received the callback function is executed with the existing msg.
    
Example of a reciever in action
```JSON
    
var source = { spec:'tcp://127.0.0.1:49901', bind:false, type: 'pull', isMongrel2:true, id:'a' }
var sink   = { spec:'tcp://127.0.0.1:49902', bind:false, type: 'pub',  isMongrel2:true, id:'b' }


var sender = zmq.sender(sink)



zmq.receiver(source, sink, function(msg) {
    console.log(msg)
    sender.send(msg.uuid, msg.connId, 200, zmq.standard_headers.json, {"message" : "Hello World!"});
}
```

* __setCors(headers)__: overrides the default CORS headers which accept request from any origin. The following is the default.

Sample headers object
```JSON
{
   "access-control-allow-origin" : "*",
   "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
   "access-control-allow-headers": "content-type, accept",
   "access-control-max-age"      : 10,
   "content-length"              : 0
}
```

* __addPreProcessFilter(function(msg, client){})__ adds a function to the list of pre-process filters. Pre-process filters are exectued after the ZeroMQ message has been parsed into the a JSON object and before the receiver on message event is evoked. The *msg* object is a JSON representation of a http request. The *response* function allows the filter to abort a request and send a message back to the client. Multiple filters can be added and are processed in series.


Example: interupts a DELETE request and sends them back to the requesting client.
```JavaScript
zmq.addPreProcessFilter(function(msg, response){
   if ('DELETE' === msg.headers.METHOD){
      response(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json, {'message':'DELETE method not allowed'})
   }
})

//msg object has the following members which can be altererd.
{
  "headers": {
    "PATH": ...,
    "x-forwarded-for": ...,
    "cache-control": ...,
    "accept-language": ...,
    "accept-encoding": ...,
    "connection": ...,
    "accept": ...,
    "user-agent": ...,
    "host": ...,
    "METHOD": ...,
    "VERSION": ...,
    "URI": ...,
    "PATTERN": ...",
    "URL_SCHEME": ...,
    "REMOTE_ADDR": ...
  },
  "uuid": ...,
  "connId": ...,
  "path": ...,
  "json": ...,
}

//response function takes the following parameters
'uuid', 'connId', 'status', 'headers', 'body'   

```

* __addPostProcessFilter(function(msg){})__ adds a filter that can alter the response after the application code has formed it and sent it back to the client. Multiple filters can be added and are processed in series.

Example: the following post filter overides the content type and body of the response message to Hello World.
```JavaScript
function(msg){
    msg.headers['Content-Type'] = 'text/plain; charset=utf-8'
    msg.body                    = "Hello World!"
}

//msg object has the following members which can be altered. 
{
    'uuid'    : ...,
    'connId'  : ...,
    'status'  : ...,
    'headers' : ...,
    'body'    : ...
}
```

* __setMongrel2UploadDir(dir)__ this function set the location of the Mongrel2 file upload dirctory. This should be set to the same value as *upload.temp_store* in your mongrel2 configuration file. This needs to be set to handle uploading large files, see section 5.1.8 Async Uploads of (http://mongrel2.org/manual/book-finalch6.html) for a full explanation. 

***

***


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

zmq.receiver( { spec:'tcp://127.0.0.1:49997', id:'test', bind:false, type:'pull' },
   { spec:'tcp://127.0.0.1:49996', id:'test', bind:false, type:'push' }
   function( msg ) {

   console.log("Headers");
   for (var i in msg.headers ){
      console.log("\t" + i + " :" + msg.headers[i]);
   }
   console.log("UUID   : " + msg.uuid);
   console.log("CONNID : " + msg.connId);
   console.log("Path   : " + msg.path);
   console.log("JSON   : " + msg.json);
   console.log();

   var response = zmq.Response( zmq.status.OK_200, zmq.header_json, '{"message":"Hello, World!"}' )

   mongrel2PubQ.send(msg.uuid, msg.connId, response);

});

```

Finally install this module, start the node application and browse to this URL (http://localhost/data/test).

```javascript
npm install git+ssh://git@github.com:peat-platform/m2nodehandler.git
node script.js
```


### Example 2: Node application to node application

Communications between two small node applications via ZeroMQ. The connection isn't request-reply queue but two separate push-pull queues.

Create a file named node1.js and paste the following code.

```javascript
var zmq   = require('m2nodehandler')

var pushQ = zmq.sender({spec:'tcp://127.0.0.1:49994', id:'nodetest1', bind:false, type:'push'});

zmq.receiver( {spec:'tcp://127.0.0.1:49995', id:'node1', bind:false, type:'pull'}, { spec:'tcp://127.0.0.1:49994', id:'test', bind:false, type:'push' }, function( msg ) {

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
npm install git+ssh://git@gitlab.peat-platform.eu:m2nodehandler.git
node node1.js
node node2.js
```

## Contributors

* Donal McCarthy (https://github.com/dmccarthy-tssg)
* Dylan Conway (https://github.com/Funi1234)

https://github.com/peat-platform/m2nodehandler


## Release History
**0.1.0** *(23/10/13 dmccarthy@tssg.org, dbenson@tssg.org, dconway@tssg.org)* Includes Mongrel2 handler and node-to-node ZMQ communication helpers.

**0.2.0** *(02/10/14 dmccarthy@tssg.org)* Added support for 1) serving binary data, 2) uploading multipart form data, and 3) pre and post filters.


## License
Copyright (c) 2014
Licensed under the MIT license.

