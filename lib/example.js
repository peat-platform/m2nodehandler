/*
 * dao
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var m2n = require('./m2nodehandler');

var mongrel2PubQ = m2n.bindToMong2PubQ({ spec:'tcp://127.0.0.1:49996', id:'test' })

m2n.bindToMong2PullQ( { spec:'tcp://127.0.0.1:49997', id:'test' }, function( msg ) {

   var response = m2n.Response( m2n.status.OK_200, m2n.header_json, '{"message":"Hello, World!"}' )

   //console.log(response);
   console.log(msg.body);
   console.log(msg.json);

   mongrel2PubQ.publish(msg.uuid, msg.connId, response);

});
