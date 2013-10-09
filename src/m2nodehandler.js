'use strict';

var M2nodeHandler = function() {

   var __hasProp = Object.prototype.hasOwnProperty

   var _self = this;
   var zmq   = require('zmq')
   var Sys   = require('sys')


   function M2nodeHandler(){
      _self = this;
   }


   M2nodeHandler.prototype.status = {
      OK_200           : 200,
      BAD_REQUEST_400  : 400,
      UNAUTHORIZED_401 : 401,
      FORBIDDEN_402    : 402,
      NOT_FOUND_404    : 404
   }


   M2nodeHandler.prototype.statusMessages = {
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


   M2nodeHandler.prototype.split = function (str, chr, limit) {
      var parts = str.split  (chr)
      var ret   = parts.slice(0, limit - 1)

      ret.push(parts.slice(limit - 1).join(chr))
      return ret
   }


   M2nodeHandler.prototype.parseNetstring = function (ns) {

      var nsSplit = _self.split(ns, ':', 2)
      var length  = parseInt  (nsSplit[0])
      var payload = nsSplit[1]

      if (payload[length] !== ',') {
         throw "Netstring did not end in ','"
      }

      return [ payload.slice(0, length), payload.slice(length + 1) ]
   }


   M2nodeHandler.prototype.getJSON = function(str){
      try{
         return JSON.parse(str)
      }
      catch(e) {
         return null
      }
   }


   M2nodeHandler.prototype.parse = function (mongrelString) {

      var mongrelStringSplit = _self.split(mongrelString, ' ', 4)

      var uuid    = mongrelStringSplit[0]
      var connId  = mongrelStringSplit[1]
      var path    = mongrelStringSplit[2]
      var payload = mongrelStringSplit[3]

      var paySplit = _self.parseNetstring(payload)
      var headers  = JSON.parse    (paySplit[0])
      var body     = _self.parseNetstring(paySplit[1])[0]

      var json     = _self.getJSON(body)

      return {
         headers: headers,
         body   : body,
         uuid   : uuid,
         connId : connId,
         path   : path,
         json   : json
      };

   };


   M2nodeHandler.prototype.Response = function Response( status, headers, body ){

      this.status  = status
      this.headers = headers
      this.body    = body

      var setBody = function(arg){
         this.body = arg
      }

      var setStatus = function(arg){
         this.status = arg
      }

      var setHeaders = function(arg){
         this.headers = arg
      }

      var addHeader = function(arg){
         this.headers.push(arg)
      }

      return {
         "status"     : status,
         "headers"    : headers,
         "body"       : body,
         "setBody"    : setBody,
         "setHeaders" : setHeaders,
         "setStatus"  : setStatus,
         "addHeader"  : addHeader
      }

   }


   M2nodeHandler.prototype.buildZmqResponse = function(zmqMsg, responseObj){
      return ""
         + zmqMsg.uuid
         + " "
         + String(zmqMsg.connId).length
         + ":"
         + zmqMsg.connId
         + ", "
         + _self.buildHttpResponse(responseObj)
   }


   M2nodeHandler.prototype.buildHttpResponse = function (responseObj) {

      var status  = responseObj.status
      var headers = responseObj.headers
      var body    = responseObj.body

      var header_arr = []

      headers['Content-Length'] = body.length

      for (var header in headers) {
         if (!__hasProp.call(headers, header)) {
            continue
         }
         var value = headers[header]
         header_arr.push("" + header + ": " + headers[header])
      }

      return "HTTP/1.1 "
         + status
         + " "
         + _self.statusMessages[status]
         + "\r\n"
         + header_arr.join("\r\n")
         + "\r\n\r\n"
         + body
   }


   M2nodeHandler.prototype.connect = function (params, callback) {


      var pub  = zmq.createSocket('pub')
      var pull = zmq.createSocket('pull')

      pull.connect(params.recv_spec)
      pub.connect (params.send_spec)

      pull.identity = params.ident
      pub.identity  = params.ident

      return pull.on('message', function (envelope, blank, data) {
         var zmqMsg = _self.parse(envelope.toString('utf8'))

         return callback(zmqMsg, function (responseObj) {
            return pub.send(_self.buildZmqResponse(zmqMsg, responseObj))
         })
      })
   }


   var m2n = new M2nodeHandler();

   return {
      status   : m2n.status,
      connect  : m2n.connect,
      Response : m2n.Response
   }

}


module.exports.M2nodeHandler = M2nodeHandler