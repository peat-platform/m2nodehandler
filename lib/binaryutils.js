// TODO: make variables camelCase, add corresponding rule to .jshintrc
'use strict';
var fs = require('fs');
var loglet      = require('loglet');
loglet = loglet.child({component: 'm2nodehandler'});

var mongrel2_upload_dir = '';

var arrayToObj = function(lines, boundry) {

   var post_data = {};

   var meta    = true;
   var name    = "";
   var data    = "";
   var nvp;
   var nvpName;
   var nvpSplit;
   var nvpValue;

   for(var i = 0, len = lines.length; i < len; i++) {

      var line = lines[i];

      if (-1 !== line.indexOf(boundry)) {
         continue;
      } else if (0 === line.length) {
         post_data[name]["value"] = lines[i+1];
         i++;
      } else if (0 === line.indexOf("Content-Disposition: form-data; ")) {
         line = line.replace("Content-Disposition: form-data; ", '');
         nvp = line.split("; ");

         for (var j = 0, k = nvp.length; j < k; j++){
            nvpSplit = nvp[j].split("=");
            nvpName  = nvpSplit[0];
            nvpValue = nvpSplit[1].substring(1, nvpSplit[1].length -1);

            if ("name" === nvpName) {
               name = nvpValue;
               post_data[name] = {};
            } else {
               post_data[name][nvpName] = nvpValue;
            }
         }
      } else {
         nvp = line.split(": ");
         nvpName  = nvp[0];
         nvpValue = nvp[1];
         post_data[name][nvpName] = nvpValue;
      }
   }

   return post_data;
};


var parseBinaryBody = function(data, boundary) {

   var _lines       = [];
   var start        = 0;
   var payloadStart = 0;
   var has_payload  = false;

   for (var i = 0, len = data.length; i < len; i++) {

      if (10 === data.readInt8(i) && 13 === data.readInt8(i-1)) {

         var end = i-1;

         if (start >= end) {
            _lines.push('');
         } else {
            var line = data.toString('utf8', start, end);

            if (-1 !== line.indexOf(boundary)) {

               if (has_payload) {
                  if ((payloadStart + 1000) < start) {
                     _lines.push(data.toString('base64', payloadStart, start-2));
                  } else {
                     _lines.push(data.toString('utf8', payloadStart, start-2));
                  }
                  has_payload = false;
               }
               _lines.push(line);
            } else {
               if (!has_payload) {
                  //find if not a normal line
                  if (0 !== line.indexOf('Content-')) {
                     has_payload  = true;
                     payloadStart = start;
                  } else {
                     _lines.push(line);
                  }
               }
            }
         }
         start = i + 1;
      }
   }

   var post_data = arrayToObj(_lines, boundary);
   //post_data.file.buffer = new Buffer(post_data.file.value, 'base64');

   return post_data;
};


var fileToStringArr = function (filePath, boundary, zmqMsg, callback) {

   fs.readFile(filePath, function (err, data) {

      if (err) {
         throw err;
         loglet.error(err);
      }

      zmqMsg.json = parseBinaryBody(data, boundary);

      callback(zmqMsg);

   });
};


var processBinaryUpload = function(headersAndMongrel2, client, envelope, callback) {

   var headers       = headersAndMongrel2[3];

   var uploadStart   = headers['x-mongrel2-upload-start'];
   var uploadDone    = headers['x-mongrel2-upload-done'];
   var contentLength = headers['content-length'];
   var boundry;
   var zmqMsg;

   if (contentLength >= 20000000) {
      client.send(headersAndMongrel2[0], headersAndMongrel2[1], resp, 417, header_json, {"error" : "File too large."});
      loglet.error("File too large");
   } else if (undefined === uploadStart && undefined === uploadDone) {

      boundry  = headers['content-type'].replace('multipart/form-data; boundary=', '' );
      var out      = parseBinaryBody(envelope, boundry);
      //construct the same object but
      zmqMsg = {
         headers    : headers,
         json       : out,
         uuid       : headersAndMongrel2[0],
         connId     : headersAndMongrel2[1],
         path       : headersAndMongrel2[2],
         valid_json : true
      };
      callback(zmqMsg);
   } else if(undefined === uploadDone) {
      //do nothing, wait for upload complete message
   } else if (undefined !== uploadDone && uploadStart !== uploadDone) {

      client.send(headersAndMongrel2[0], headersAndMongrel2[1], responseObj, status.INTERNAL_SERVER_ERROR_500, header_json, {"error" : "Got the wrong file:"});
      loglet.error("Got the wrong file");
   } else if(undefined !== uploadDone) {
      var filePath = mongrel2_upload_dir + headers['x-mongrel2-upload-done'];

      boundry  = headers['content-type'].replace('multipart/form-data; boundary=', '' );

      zmqMsg = {
         headers    : headers,
         uuid       : headersAndMongrel2[0],
         connId     : headersAndMongrel2[1],
         path       : headersAndMongrel2[2],
         valid_json : true
      };

      fileToStringArr(filePath, boundry, zmqMsg, callback);
   } else {
      callback(parse(envelope.toString('utf8')));
   }
};


var isBinaryUpload = function(headers) {
   return (undefined !== headers['content-type'] && 0 === headers['content-type'].indexOf("multipart/form-data"));
};


var setMongrel2UploadDir = function(dir) {
   mongrel2_upload_dir = dir;
};

module.exports.processBinaryUpload  = processBinaryUpload;
module.exports.isBinaryUpload       = isBinaryUpload;
module.exports.setMongrel2UploadDir = setMongrel2UploadDir;