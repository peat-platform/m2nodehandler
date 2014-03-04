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


var header_plain = { 'Content-Type': 'text/plain; charset=utf-8'       }
var header_json  = { 'Content-Type': 'application/json; charset=utf-8' }
var header_html  = { 'Content-Type': 'text/html; charset=utf-8'        }


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


function isValidJSON(str){
   try{
      JSON.parse(str)
      return true;
   }
   catch(e) {
      return false
   }
}


function parse(mongrelString) {
   var mongrelStringSplit = split(mongrelString, ' ', 4)

   var uuid       = mongrelStringSplit[0]
   var connId     = mongrelStringSplit[1]
   var path       = mongrelStringSplit[2]
   var payload    = mongrelStringSplit[3]

   var paySplit   = parseNetstring(payload)
   var headers    = getJSON       (paySplit[0])
   var body       = parseNetstring(paySplit[1])[0]

   var valid_json = isValidJSON(body)
   var json       = getJSON(body)

   return {
      headers    : headers,
      uuid       : uuid,
      connId     : connId,
      path       : path,
      json       : json,
      valid_json : valid_json
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

   dbc.hasMember(config, 'spec')
   dbc.hasMemberIn(config, 'type', ['pub', 'push'])

   var send      = zmq.socket(config.type);
   send.identity = config.id

   process.on('exit', function(){
      if (send){
         send.close()
         process.exit()
      }
   })

   if (config.bind){
      send.bindSync(config.spec);
   }
   else{
      send.connect(config.spec);
   }

   if (config.isMongrel2){
      return {
         'send' : function (uuid, connId, responseObj){
            var message = buildZmqResponse(uuid, connId, responseObj)
            return send.send(message)
         }
      }
   }
   else {
      return {
         'send' : function (message){
            send.send(JSON.stringify(message))
         }
      }
   }
}


function receiver(config, error_config, callback) {

   dbc.hasMember           (config, 'spec')
   dbc.hasMemberIn         (config, 'type', ['sub', 'pull'])
   dbc.conditionalHasMember(config, 'subscribe', config.type === 'sub')
   dbc.hasMember           (error_config, 'spec')
   dbc.assert              (error_config.isMongrel2 === true)

   var receive      = zmq.socket(config.type)
   receive.identity = config.id

   var error         = zmq.socket('pub')
   error.connect(error_config.spec)

   process.on('exit', function(){
      if (receive){
         receive.close()
      }
      if (error){
         error.close();
      }
      process.exit()
   })


   if (config.isMongrel2){
      receive.on('message', function (envelope) {

         var zmqMsg = parse(envelope.toString('utf8'))

         if (zmqMsg.valid_json){
            delete zmqMsg['valid_json']
            return callback(zmqMsg)
         }
         else{
            var responseObj = new Response(status.BAD_REQUEST_400, header_json, {'message':'Invalid JSON'})
            var message     = buildZmqResponse(zmqMsg.uuid, zmqMsg.connId, responseObj)
            error.send(message)
         }
      })
   }
   else{
      receive.on('message', function (envelope) {
         var zmqMsg = envelope.toString('utf8')
         return callback(JSON.parse(zmqMsg))
      })
   }


   if (config.bind){
      receive.bindSync(config.spec);
   }
   else{
      receive.connect(config.spec);
   }

   if ('sub' === config.type){
      receive.subscribe(config.subscribe);
   }

   return receive
}


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