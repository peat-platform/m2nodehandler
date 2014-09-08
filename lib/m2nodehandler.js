'use strict';

var zmq            = require('zmq')
var dbc            = require('dbc')
var postFileReader = require('./postFileReader.js')

var __hasProp = Object.prototype.hasOwnProperty

var status = {
   OK_200                     : 200,
   NO_CONTENT_204             : 204,
   BAD_REQUEST_400            : 400,
   UNAUTHORIZED_401           : 401,
   FORBIDDEN_402              : 402,
   NOT_FOUND_404              : 404,
   INTERNAL_SERVER_ERROR_500  : 500
}


var header_plain = { "access-control-allow-origin" : '*', 'Content-Type': 'text/plain; charset=utf-8'        }
var header_json  = { "access-control-allow-origin" : '*', 'Content-Type': 'application/json; charset=utf-8'  }
var header_html  = { "access-control-allow-origin" : '*', 'Content-Type': 'text/html; charset=utf-8'         }
var header_sse   = { "access-control-allow-origin" : '*',
   'Content-Type'  : 'text/event-stream; charset=utf-8',
   'Cache-Control' : 'no-cache',
   'Connection'    : 'keep-alive' }


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
   if (0 === str.length){
      return true
   }
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


function Notification( body, id, event ){

   var idPrepend    = ( undefined === id || null === id || 0 === id.length ) ? '' : 'id: ' + id + '\n';
   var eventPrepend = ( undefined === event || null === event || 0 === event.length ) ? '' : 'event: ' + event + '\n';

   return {
      'status'          : status.OK_200,
      'headers'         : header_sse,
      'is_notification' : true,
      'body'            : (Object.prototype.toString.call(body) === '[object String]')
         ? idPrepend + eventPrepend + 'data: ' + body                 + '\n\n'
         : idPrepend + eventPrepend + 'data: ' + JSON.stringify(body) + '\n\n'
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


function buildZmqBufferResponse(uuid, connId, status, headers, dataBuffer){

   var header_arr = []

   header_arr.push('Content-Length: ' + dataBuffer.length)

   for (var header in headers) {
      if (__hasProp.call(headers, header)) {
         header_arr.push('' + header + ': ' + headers[header])
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
      + '\r\n\r\n'

   var strBuffer = new Buffer(str, 'utf8' )

   return Buffer.concat([strBuffer, dataBuffer])
}


function buildHttpResponse(responseObj) {

   var status  = responseObj.status
   var headers = responseObj.headers
   var body    = responseObj.body

   var header_arr = []

   if ( !responseObj.is_notification ){
      header_arr.push('Content-Length: ' + body.length)
   }

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
         },
         'sendBinary' : function (uuid, connId, status, header_arr, dataBuffer){
            var buffResp = buildZmqBufferResponse(uuid, connId, status, header_arr, dataBuffer)
            return send.send(buffResp)
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

var readFirstLine = function(data){

   for (var i = 0; i < data.length; i++){
      if (10 === data.readInt8(i) && 13 === data.readInt8(i-1)){
         return data.toString('utf8', 0, i)
      }
   }
   return data.toString('utf8')
}

var getHeadersAndMongrel2 = function(data){

   var mongrelString      = readFirstLine(data)
   var mongrelStringSplit = split(mongrelString, ' ', 4)
   var payload            = mongrelStringSplit[3]
   var paySplit           = parseNetstring(payload)

   return [mongrelStringSplit[0], mongrelStringSplit[1], mongrelStringSplit[2], getJSON(paySplit[0])]
}


var arrayToObj = function(lines, boundry){

   var post_data = {}

   var meta    = true
   var name    = ""
   var data    = ""

   for(var i = 0; i < lines.length; i++) {

      var line = lines[i]

      if (-1 != line.indexOf(boundry)){
         continue
      }
      else if (0 == line.length){
         post_data[name]["value"] = lines[i+1]
         i++
      }
      else if (0 === line.indexOf("Content-Disposition: form-data; ")){
         line        = line.replace("Content-Disposition: form-data; ", '')

         var nvp     = line.split("; ")

         for (var j = 0; j < nvp.length; j++){
            var nvpSplit = nvp[j].split("=")
            var nvpName  = nvpSplit[0]
            var nvpValue = nvpSplit[1].substring(1, nvpSplit[1].length -1)

            if ("name" === nvpName){
               name            = nvpValue
               post_data[name] = {}
            }
            else{
               post_data[name][nvpName] = nvpValue
            }
         }
      }
      else{
         var nvp      = line.split(": ")
         var nvpName  = nvp[0]
         var nvpValue = nvp[1]
         post_data[name][nvpName] = nvpValue
      }
   }

   return post_data
}

var parseBinaryMessage = function(data, boundary){

   var _lines       = []
   var start        = 0
   var payloadStart = 0
   var has_payload  = false;

   for (var i = 0; i < data.length; i++){

      if (10 === data.readInt8(i) && 13 === data.readInt8(i-1)){

         var end = i-1

         if (start >= end){
            _lines.push('')
         }
         else{
            var line = data.toString('utf8', start, end)

            if (-1 !== line.indexOf(boundary)){

               if (has_payload){
                  if ((payloadStart + 1000) < start){
                     _lines.push(data.toString('base64', payloadStart, start-2))
                  }
                  else{
                     _lines.push(data.toString('utf8', payloadStart, start-2))
                  }
                  has_payload = false;
               }
               _lines.push(line)
            }
            else{
               if (!has_payload){
                  //find if not a normal line
                  if (0 !== line.indexOf('Content-')){
                     has_payload  = true
                     payloadStart = start
                  }
                  else{
                     _lines.push(line)
                  }
               }
            }
         }
         start = i + 1
      }
   }

   var post_data         = arrayToObj(_lines, boundary)
   post_data.file.buffer = new Buffer(post_data.file.value, 'base64');

   return post_data
}

function receiver(config, error_config, callback) {

   dbc.hasMember           (config, 'spec')
   dbc.hasMemberIn         (config, 'type', ['sub', 'pull'])
   dbc.conditionalHasMember(config, 'subscribe', config.type === 'sub')

   var receive      = zmq.socket(config.type)
   receive.identity = config.id

   var error         = null

   if (config.isMongrel2){
      dbc.hasMember  (error_config, 'spec')
      dbc.assert     (error_config.isMongrel2 === true)
      error = zmq.socket('pub')
      error.connect(error_config.spec)
   }

   process.on('exit', function(){
      if (receive){
         receive.close()
      }
      if (config.isMongrel2 && error){
         error.close();
      }
      process.exit()
   })


   if (config.isMongrel2){
      receive.on('message', function (envelope) {
         var zmqMsg

         var headersAndMongrel2 = getHeadersAndMongrel2(envelope)
         var headers            = headersAndMongrel2[3]

         if ( undefined !== headers['content-type'] && 0 === headers['content-type'].indexOf("multipart/form-data")){

            var uploadStart   = headers['x-mongrel2-upload-start']
            var uploadDone    = headers['x-mongrel2-upload-done']
            var contentLength = headers['content-length'];

            if (contentLength >= 20000000){

               var resp = buildZmqResponse(417, header_json, {"error" : "File too large."})
               var message = senderToClient.send(headersAndMongrel2[0], headersAndMongrel2[1], resp);
               error.send(message)
               return;
            }
            else if (undefined === uploadStart && undefined === uploadDone){

               var boundry  = headers['content-type'].replace('multipart/form-data; boundary=', '' )
               var out      = parseBinaryMessage(envelope, boundry)
               //construct the same object but
               zmqMsg = {
                  headers    : headers,
                  json       : out,
                  uuid       : headersAndMongrel2[0],
                  connId     : headersAndMongrel2[1],
                  path       : headersAndMongrel2[2],
                  valid_json : true
               }
            }
            else if(undefined === uploadDone){
               return;
            }
            else if (undefined !== uploadDone && uploadStart !== uploadDone){

               var resp    = Response(status.INTERNAL_SERVER_ERROR_500, header_json, {"error" : "Got the wrong file:."})
               var message = buildZmqResponse(headersAndMongrel2[0], headersAndMongrel2[1], responseObj)
               error.send(message)

               return false;
            }
            else if(undefined !== uploadDone){
               var filePath = appRoot + "/../../mongrel2/" + headers['x-mongrel2-upload-done']

               var boundry  = headers['content-type'].replace('multipart/form-data; boundary=', '' )


               zmqMsg = {
                  headers    : headers,
                  uuid       : headersAndMongrel2[0],
                  connId     : headersAndMongrel2[1],
                  path       : headersAndMongrel2[2],
                  valid_json : true
               }

               postFileReader(filePath, boundry, zmqMsg, callback)

               return
            }
            else{
               zmqMsg = parse(envelope.toString('utf8'))
            }
         }
         else{
            zmqMsg = parse(envelope.toString('utf8'))
         }


         //actions on

         if (zmqMsg.headers.METHOD === 'OPTIONS'){
            var optHeaders = {
               "access-control-allow-origin" : "*",
               "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
               "access-control-allow-headers": "content-type, accept",
               "access-control-max-age"      : 10, // Seconds.
               "content-length"              : 0
            }
            var responseObj = new Response(status.NO_CONTENT_204, optHeaders, '')
            var message     = buildZmqResponse(zmqMsg.uuid, zmqMsg.connId, responseObj)
            error.send(message)
         }
         else if(zmqMsg.headers.METHOD === 'JSON' && 'disconnect' === zmqMsg.json.type){
            //do nothing
         }
         else if (zmqMsg.valid_json){
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

   return receiver
}


module.exports.Response           = Response
module.exports.Notification       = Notification
module.exports.status             = status
module.exports.header_plain       = header_plain
module.exports.header_json        = header_json
module.exports.header_html        = header_html
module.exports.header_sse         = header_sse
module.exports.getJSON            = getJSON
module.exports.parse              = parse
module.exports.parseNetstring     = parseNetstring
module.exports.receiver           = receiver
module.exports.sender             = sender
module.exports.buildHttpResponse  = buildHttpResponse
module.exports.buildZmqResponse   = buildZmqResponse