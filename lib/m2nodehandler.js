'use strict';

var zmq         = require('zmq');
var dbc         = require('dbc');
var binaryutils = require('./binaryutils.js');

var __hasProp = Object.prototype.hasOwnProperty;

var pre_process_filters  = [];
var post_process_filters = [];

var status = {
   OK_200                     : 200,
   NO_CONTENT_204             : 204,
   BAD_REQUEST_400            : 400,
   UNAUTHORIZED_401           : 401,
   FORBIDDEN_402              : 402,
   NOT_FOUND_404              : 404,
   INTERNAL_SERVER_ERROR_500  : 500
};


var standard_headers = {
   plain : {
      "access-control-allow-origin" : '*',
      'Content-Type': 'text/plain; charset=utf-8'
   },
   json  : {
      "access-control-allow-origin" : '*',
      'Content-Type': 'application/json; charset=utf-8'
   },
   html  : {
      "access-control-allow-origin" : '*',
      'Content-Type': 'text/html; charset=utf-8'
   },
   stream: {
      "access-control-allow-origin" : '*',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control' : 'no-cache',
      'Connection'    : 'keep-alive'
   }
};


var header_cors = {
   "access-control-allow-origin" : "*",
   "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
   "access-control-allow-headers": "content-type, accept, authorization",
   "access-control-max-age"      : 10, // Seconds.
   "content-length"              : 0
};


var statusMessages = {
   '100': 'Continue',
   '101': 'Switching Protocols',
   '200': 'OK',
   '201': 'Created',
   '202': 'Accepted',
   '203': 'Non-Authoritative Information',
   '204': 'No Content',
   '205': 'Reset Content',
   '206': 'Partial Content',
   '300': 'Multiple Choices',
   '301': 'Moved Permanently',
   '302': 'Found',
   '303': 'See Other',
   '304': 'Not Modified',
   '305': 'Use Proxy',
   '307': 'Temporary Redirect',
   '400': 'Bad Request',
   '401': 'Unauthorized',
   '402': 'Payment Required',
   '403': 'Forbidden',
   '404': 'Not Found',
   '405': 'Method Not Allowed',
   '406': 'Not Acceptable',
   '407': 'Proxy Authentication Required',
   '408': 'Request Timeout',
   '409': 'Conflict',
   '410': 'Gone',
   '411': 'Length Required',
   '412': 'Precondition Failed',
   '413': 'Request Entity Too Large',
   '414': 'Request-URI Too Large',
   '415': 'Unsupported Media Type',
   '416': 'Request Range Not Satisfiable',
   '417': 'Expectation Failed',
   '500': 'Internal Server Error',
   '501': 'Not Implemented',
   '502': 'Bad Gateway',
   '503': 'Service Unavailable',
   '504': 'Gateway Timeout',
   '505': 'HTTP Version Not Supported'
};


var setCors = function(headers){
   header_cors = headers;
};


var addPreProcessFilter = function(fun){
   pre_process_filters.push(fun);
};


var addPostProcessFilter = function(fun){
   post_process_filters.push(fun);
};


var split = function(str, chr, limit) {
   var parts = str.split  (chr);
   var ret   = parts.slice(0, limit - 1);

   ret.push(parts.slice(limit - 1).join(chr));
   return ret;
};


var parseNetstring = function(ns) {

   var nsSplit = split(ns, ':', 2);
   var length  = parseInt  (nsSplit[0], 10);
   var payload = nsSplit[1];

   if (payload.length -1 < length){
      length = payload.length -1;
   }

   if (payload[length] !== ',') {
      throw 'Netstring did not end in ","';
   }

   return [ payload.slice(0, length), payload.slice(length + 1) ];
};


var getJSON = function(str){
   try {
      return JSON.parse(str);
   } catch(e) {
      return null;
   }
};


var isValidJSON = function(str){
   if (0 === str.length){
      return true;
   }
   try {
      JSON.parse(str);
      return true;
   } catch(e) {
      return false;
   }
};


var parse = function(mongrelString) {

   var mongrelStringSplit = split(mongrelString, ' ', 4);

   var uuid       = mongrelStringSplit[0];
   var connId     = parseInt(mongrelStringSplit[1]);
   var path       = mongrelStringSplit[2];
   var payload    = mongrelStringSplit[3];

   var paySplit   = parseNetstring(payload);
   var headers    = getJSON       (paySplit[0]);
   var body       = parseNetstring(paySplit[1])[0];

   var valid_json = isValidJSON(body);
   var json       = getJSON(body);

   return {
      headers    : headers,
      uuid       : uuid,
      connId     : connId,
      path       : path,
      json       : json,
      valid_json : valid_json
   };
};


var dataToBuffer = function(data){

   if (Buffer.isBuffer(data)){
      return data;
   }

   var body = (Object.prototype.toString.call(data) === '[object String]') ? data : JSON.stringify(data);

   if (undefined === body){
      body = '';
   }

   return new Buffer(body, 'utf8' );
};


var buildZmqResponse = function(uuid, connId, status, headers, data) {

   var header_arr = [];
   var dataBuffer = dataToBuffer(data);

   header_arr.push('Content-Length: ' + dataBuffer.length);

   for (var header in headers) {
      if (__hasProp.call(headers, header)) {
         header_arr.push('' + header + ': ' + headers[header]);
      }
   }

   var str = ''
      + uuid
      + ' '
      + String(connId).length
      + ':'
      + connId
      + ', '
      + 'HTTP/1.1 '
      + status
      + ' '
      + statusMessages[status]
      + '\r\n'
      + header_arr.join('\r\n')
      + '\r\n\r\n';

   var strBuffer = new Buffer(str, 'utf8' );

   return Buffer.concat([strBuffer, dataBuffer]);
};


var sender = function(config) {

   dbc.hasMember(config, 'spec');
   dbc.hasMemberIn(config, 'type', ['pub', 'push']);

   var send      = zmq.socket(config.type);
   send.identity = config.id;

   process.on('exit', function(){
      if (send){
         send.close();
         process.exit();
      }
   });

   if (config.bind) {
      send.bindSync(config.spec);
   } else {
      send.connect(config.spec);
   }

   if (config.isMongrel2) {
      return {
         'send' : function (uuid, connId, status, headers, body) {

            var msg = {
               'uuid'    : uuid,
               'connId'  : connId,
               'status'  : status,
               'headers' : headers,
               'body'    : body
            };

            for (var i in post_process_filters) {
               if(post_process_filters.hasOwnProperty(i)) {
                  post_process_filters[i](msg);
               }

            }

            var message = buildZmqResponse(msg.uuid, msg.connId, msg.status, msg.headers, msg.body);

            return send.send(message);
         }
      };
   } else {
      return {
         'send' : function (message) {
            send.send(JSON.stringify(message));
         }
      };
   }
};


var readFirstLine = function(data) {

   for (var i = 0; i < data.length; i++) {
      if (10 === data.readInt8(i) && 13 === data.readInt8(i-1)) {
         return data.toString('utf8', 0, i);
      }
   }
   return data.toString('utf8');
};


var getHeadersAndMongrel2 = function(data) {

   var mongrelString      = readFirstLine(data);
   var mongrelStringSplit = split(mongrelString, ' ', 4);
   var payload            = mongrelStringSplit[3];
   var paySplit           = parseNetstring(payload);

   return [mongrelStringSplit[0], mongrelStringSplit[1], mongrelStringSplit[2], getJSON(paySplit[0])];

};


var receiver = function(config, error_config, callback) {

   dbc.hasMember           (config, 'spec');
   dbc.hasMemberIn         (config, 'type', ['sub', 'pull']);
   dbc.conditionalHasMember(config, 'subscribe', config.type === 'sub');

   var receive      = zmq.socket(config.type);
   receive.identity = config.id;

   var client = null;

   if (config.isMongrel2) {
      dbc.hasMember  (error_config, 'spec');
      dbc.assert     (error_config.isMongrel2 === true);
      client = zmq.socket('pub');
      client.connect(error_config.spec);
   }

   process.on('exit', function() {
      if (receive) {
         receive.close();
      }
      if (config.isMongrel2 && client) {
         client.close();
      }
      process.exit();
   });

   if (config.isMongrel2) {
      receive.on('message', function (envelope) {


         var headersAndMongrel2 = getHeadersAndMongrel2(envelope);
         var headers            = headersAndMongrel2[3];

         var proceed = true;

         var filterResponse = function (uuid, connId, status, headers, body) {
            proceed = false;
            var message = buildZmqResponse(uuid, connId, status, headers, body);
            return client.send(message);
         };

         var callbackWithFilter = function(zmqMsg) {

            for (var i in pre_process_filters) {
               if(pre_process_filters.hasOwnProperty(i)) {
                  pre_process_filters[i](zmqMsg, filterResponse);
                  if (false === proceed) {
                     return;
                  }
               }
            }
            callback(zmqMsg);
         };


         if( binaryutils.isBinaryUpload(headers)) {
            binaryutils.processBinaryUpload(headersAndMongrel2, client, envelope, callbackWithFilter);
         } else {
            var zmqMsg = parse(envelope.toString('utf8'));

            if(zmqMsg.headers.METHOD === 'JSON' && 'disconnect' === zmqMsg.json.type) {
               //do nothing
            } else if (zmqMsg.headers.METHOD === 'OPTIONS') {
               client.send(buildZmqResponse(zmqMsg.uuid, zmqMsg.connId, status.NO_CONTENT_204, header_cors, ''));
            } else if (!zmqMsg.valid_json) {
               client.send(buildZmqResponse(zmqMsg.uuid, zmqMsg.connId, status.BAD_REQUEST_400, standard_headers.json, {'message':'Invalid JSON'}));
            } else {
               delete zmqMsg['valid_json'];
               return callbackWithFilter(zmqMsg);
            }
         }
      });
   } else {
      receive.on('message', function (envelope) {
         var zmqMsg = envelope.toString('utf8');
         var j;
         try
         {
            j = JSON.parse(zmqMsg);
         }
         catch(_)
         {
            try
            {
               j = parse(zmqMsg);
               j = JSON.parse(j);
            }
            catch(_)
            {
               j = zmqMsg;
            }
         }

         return callback(j);
      });
   }


   if (config.bind) {
      receive.bindSync(config.spec);
   } else {
      receive.connect(config.spec);
   }

   if ('sub' === config.type){
      receive.subscribe(config.subscribe);
   }
};


var setMongrel2UploadDir = function(dir) {
   binaryutils.setMongrel2UploadDir(dir);
};


module.exports.status               = status;
module.exports.getJSON              = getJSON;
module.exports.parse                = parse;
module.exports.parseNetstring       = parseNetstring;
module.exports.receiver             = receiver;
module.exports.sender               = sender;
module.exports.buildZmqResponse     = buildZmqResponse;
module.exports.setCors              = setCors;
module.exports.addPreProcessFilter  = addPreProcessFilter;
module.exports.addPostProcessFilter = addPostProcessFilter;
module.exports.setMongrel2UploadDir = setMongrel2UploadDir;
module.exports.standard_headers     = standard_headers;
