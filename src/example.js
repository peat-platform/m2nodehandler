/*
 * dao
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var m2n = new require('./m2nodehandler').M2nodeHandler();


var params = { recv_spec:'tcp://127.0.0.1:9997',
               send_spec:'tcp://127.0.0.1:9996',
               ident:'test' }


new m2n.connect( params, function( msg, responseCallback ) {

   var response = new m2n.Response( m2n.status.OK_200, { 'Content-Type': 'text/plain' }, 'Hello, World!' )

   console.log(msg.body);
   console.log(msg.json);

   responseCallback( response );

});