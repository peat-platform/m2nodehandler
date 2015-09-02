/**
 * Created by dconway on 01/09/15.
 */
'use strict';

var m2n    = require('../lib/m2nodehandler.js');
var assert = require('chai').assert;

describe('Testing response status values',function(){
   it('should confirm status values', function(){
      assert.equal(200,m2n.status.OK_200,'Should be 200');
      assert.equal(400,m2n.status.BAD_REQUEST_400,'Should be 400');
      assert.equal(401,m2n.status.UNAUTHORIZED_401,'Should be 401');
      assert.equal(402,m2n.status.FORBIDDEN_402,'Should be 402');
      assert.equal(404,m2n.status.NOT_FOUND_404,'Should be 404');
      assert.equal(500,m2n.status.INTERNAL_SERVER_ERROR_500,'Should be 500');
   })
});

describe('Testing response objects',function(){
   //There must be a better way to test this.
   var resp = m2n.buildZmqResponse(0,0,500, {'content-type':'text/plain'}, "Rodger").toString();
   it('should validate ZMQ responce Object', function(){
      assert(resp.indexOf('500') !== -1 ,'Status should be 500');
      assert(resp.indexOf('content-type: text/plain') !== -1,'Header should be an object');
      assert(resp.indexOf('Rodger') !== -1,'Data should be an "Rodger');
   })
});

describe('Testing netstring parse',function(){
   var mongrelString = "12 4 /test 9:{\"c\":\"d\"},9:{\"a\":\"b\"},"
   var result        = m2n.parse(mongrelString)
   it('should confirm status values', function(){
      assert.equal(12, result.uuid,'uuid should be 12');
      assert.equal(4, result.connId,'connid should be 4');
      assert.equal("/test", result.path,'Path should be "/test');
      assert.equal("d", result.headers.c,'Header "c" should be equal "d');
      assert.equal("b", result.json.a,'JSON key "a" should be equal "b');
   })
});