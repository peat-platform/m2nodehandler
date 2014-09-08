/*
 * Line By Line
 *
 * A NodeJS module that helps you reading large text files, line by line,
 * without buffering the files into memory.
 *
 * Copyright (c) 2012 Markus von der Wehd <mvdw@mwin.de>
 * MIT License, see LICENSE.txt, see http://www.opensource.org/licenses/mit-license.php
 */

var fs = require('fs');

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


var fileToStringArr = function (filePath, boundary, zmqMsg, callback) {

   fs.readFile(filePath, function (err, data) {

      if (err){
         throw err;
      }

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

      var post_data = arrayToObj(_lines, boundary)

      zmqMsg.json = post_data

      callback(zmqMsg)

   });

};


module.exports = fileToStringArr;
