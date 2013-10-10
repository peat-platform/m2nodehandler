/*
 * dao
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var m2n = require('./m2nodehandler');

var params = { recv_spec:'tcp://127.0.0.1:9997',
               send_spec:'tcp://127.0.0.1:9996',
               ident:'test' }


m2n( params, function( msg, responseCallback ) {

   var response = m2n.Response( m2n.status.OK_200, m2n.header_json, '{"a":"Hello, World!"}' )

//   console.log(response);
//   console.log(msg.body);
//   console.log(msg.json);

   responseCallback( response );

});