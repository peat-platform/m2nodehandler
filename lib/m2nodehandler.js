'use strict';

var zmq = require('zmq')

var __hasProp = Object.prototype.hasOwnProperty

var status = {
   OK_200           : 200,
   BAD_REQUEST_400  : 400,
   UNAUTHORIZED_401 : 401,
   FORBIDDEN_402    : 402,
   NOT_FOUND_404    : 404
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
      'body'       : body,
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

function bindToPushQ(params){
   var pub = zmq.socket('push');
   pub.bindSync(params.spec);
   return {'push' : function (message){pub.send(JSON.stringify(message))}}
}


function bindToPullQ(params, callback) {

   var pull      = zmq.socket('pull')
   pull.identity = params.id
   pull.connect(params.spec)


   return pull.on('message', function (envelope) {
      var zmqMsg = envelope.toString('utf8')
      return callback(JSON.parse(zmqMsg))
   })
}


function bindToMong2PubQ(params){
   var pub      = zmq.createSocket('pub');
   pub.identity = params.ident
   pub.connect(params.send_spec);
   return { 'publish' : function (uuid, connId, responseObj){
      return pub.send(buildZmqResponse(uuid, connId, responseObj))
   }
   }
}


function connect(params, callback) {

   var pull      = zmq.createSocket('pull')
   pull.identity = params.ident
   pull.connect    (params.recv_spec)

   return pull.on('message', function (envelope) {
      var zmqMsg = parse(envelope.toString('utf8'))
      return callback(zmqMsg)
   })
}


var header_plain = { 'Content-Type': 'text/plain'       }
var header_json  = { 'Content-Type': 'application/json' }
var header_html  = { 'Content-Type': 'text/html'        }


module.exports.connect         = connect
module.exports.Response        = Response
module.exports.status          = status
module.exports.header_plain    = header_plain
module.exports.header_json     = header_json
module.exports.header_html     = header_html
module.exports.getJSON         = getJSON
module.exports.bindToMong2PubQ = bindToMong2PubQ
module.exports.bindToPullQ     = bindToPullQ
module.exports.bindToPushQ     = bindToPushQ