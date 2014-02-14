'use strict';

var zmq = require('zmq')
var dbc = require('dbc')

var __hasProp = Object.prototype.hasOwnProperty

var status = {
   OK_200                     : 200,
   BAD_REQUEST_400            : 400,
   UNAUTHORIZED_401           : 401,
   FORBIDDEN_402              : 402,
   NOT_FOUND_404              : 404,
   INTERNAL_SERVER_ERROR_500  : 500
}


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
}


function split(str, chr, limit) {
   var parts = str.split  (chr)
   var ret   = parts.slice(0, limit - 1)

   ret.push(parts.slice(limit - 1).join(chr))
   return ret
}


function parseNetstring(ns) {

   var nsSplit = split(ns, ':', 2)
   var length  = parseInt  (nsSplit[0], 10)
   var payload = nsSplit[1]

   if (payload[length] !== ',') {
      throw 'Netstring did not end in ","'
   }

   return [ payload.slice(0, length), payload.slice(length + 1) ]
}


function getJSON(str){
   try{
      return JSON.parse(str)
   }
   catch(e) {
      return null
   }
}


function parse(mongrelString) {
   var mongrelStringSplit = split(mongrelString, ' ', 4)

   var uuid    = mongrelStringSplit[0]
   var connId  = mongrelStringSplit[1]
   var path    = mongrelStringSplit[2]
   var payload = mongrelStringSplit[3]

   var paySplit = parseNetstring(payload)
   var headers  = getJSON       (paySplit[0])
   var body     = parseNetstring(paySplit[1])[0]

   var json     = getJSON(body)

   return {
      headers: headers,
      body   : body,
      uuid   : uuid,
      connId : connId,
      path   : path,
      json   : json
   };

}


function Response( status, headers, body ){

   var setBody = function(arg){
      this.body = arg
   }

   var setStatus = function(arg){
      this.status = arg
   }

   var setHeaders = function(arg){
      this.headers = arg
   }

   var addHeader = function(property, value){
      this.headers[property] = value;
   }

   return {
      'status'     : status,
      'headers'    : headers,
      'body'       : (Object.prototype.toString.call(body) === '[object String]') ? body : JSON.stringify(body),
      'setBody'    : setBody,
      'setHeaders' : setHeaders,
      'setStatus'  : setStatus,
      'addHeader'  : addHeader
   }

}


function buildZmqResponse(uuid, connId, responseObj){
   return ''
      + uuid
      + ' '
      + String(connId).length
      + ':'
      + connId
      + ', '
      + buildHttpResponse(responseObj)
}


function buildHttpResponse(responseObj) {

   var status  = responseObj.status
   var headers = responseObj.headers
   var body    = responseObj.body

   var header_arr = []

   header_arr.push('Content-Length: ' + body.length)

   for (var header in headers) {
      if (__hasProp.call(headers, header)) {
         header_arr.push('' + header + ': ' + headers[header])
      }
   }

   return 'HTTP/1.1 '
      + status
      + ' '
      + statusMessages[status]
      + '\r\n'
      + header_arr.join('\r\n')
      + '\r\n\r\n'
      + body
}



function sender(config){

   dbc.hasMember(config, "spec")
   dbc.hasMemberIn(config, "type", ["pub", "push"])

   var sender      = zmq.socket(config.type);
   sender.identity = config.id

   process.on('exit', function(){
      if (sender){
         sender.close()
         process.exit()
      }
   })

   if (config.bind){
      sender.bindSync(config.spec);
   }
   else{
      sender.connect(config.spec);
   }

   if (config.isMongrel2){
      return {
         'send' : function (uuid, connId, responseObj){
            var message = buildZmqResponse(uuid, connId, responseObj)
            console.log()
            return sender.send(message)
         }
      }
   }
   else {
      return {
         'send' : function (message){
            sender.send(JSON.stringify(message))
         }
      }
   }
}


function receiver(config, callback) {

   dbc.hasMember           (config, "spec")
   dbc.hasMemberIn         (config, "type", ["sub", "pull"])
   dbc.conditionalHasMember(config, "subscribe", config.type === "sub")

   var receiver      = zmq.socket(config.type)
   receiver.identity = config.id

   process.on('exit', function(){
      if (receiver){
         receiver.close()
         process.exit()
      }
   })


   if (config.isMongrel2){
      receiver.on('message', function (envelope) {
         var zmqMsg = parse(envelope.toString('utf8'))
         return callback(zmqMsg)
      })
   }
   else{
      receiver.on('message', function (envelope) {
         var zmqMsg = envelope.toString('utf8')
         return callback(JSON.parse(zmqMsg))
      })
   }


   if (config.bind){
      receiver.bindSync(config.spec);
   }
   else{
      receiver.connect(config.spec);
   }

   if ("sub" === config.type){
      receiver.subscribe(config.subscribe);
   }
   
   return receiver
}


function bindToMong2Sender(params){

   var pub      = zmq.socket('pub');
   pub.identity = params.id
   pub.connect    (params.spec, function(err) {
      if (err){
         throw err
      }
   });

   process.on('exit', function(){
      if (pub){
         pub.close()
      }
   })

   return { 'publish' : function (uuid, connId, responseObj){
         var message = buildZmqResponse(uuid, connId, responseObj)
         return pub.send(message)
      }
   }
}


function bindToMong2PullQ(params, callback) {

   var pull      = zmq.createSocket('pull')
   pull.identity = params.id
   pull.connect    (params.spec)

   return pull.on('message', function (envelope) {
      var zmqMsg = parse(envelope.toString('utf8'))
      return callback(zmqMsg)
   })


   var receiveEvent = receiver.on('message', function (envelope) {
      var zmqMsg = envelope.toString('utf8')
      return callback(JSON.parse(zmqMsg))
   })
}


var header_plain = { 'Content-Type': 'text/plain; charset=utf-8'       }
var header_json  = { 'Content-Type': 'application/json; charset=utf-8' }
var header_html  = { 'Content-Type': 'text/html; charset=utf-8'        }


module.exports.Response           = Response
module.exports.status             = status
module.exports.header_plain       = header_plain
module.exports.header_json        = header_json
module.exports.header_html        = header_html
module.exports.getJSON            = getJSON
module.exports.parse              = parse
module.exports.parseNetstring     = parseNetstring
module.exports.receiver           = receiver
module.exports.sender             = sender
module.exports.buildHttpResponse  = buildHttpResponse
module.exports.buildZmqResponse   = buildZmqResponse