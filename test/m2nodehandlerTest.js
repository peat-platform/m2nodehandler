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

describe('Testing buildZmqResponse',function(){
   //There must be a better way to test this.
   var resp = m2n.buildZmqResponse(0,0,500, {'content-type':'text/plain'}, "Rodger").toString();
   var dataBuffer = new Buffer("George", 'utf8' );
   var bufferResp = m2n.buildZmqResponse(1,1,201, {'content-type':'text/plain'}, dataBuffer).toString();
   var undefDataResp = m2n.buildZmqResponse(2,2,404, {'content-type':'text/plain'}, undefined).toString();

   it('should validate ZMQ responce Object', function(){
      assert(resp.indexOf('500') !== -1 ,'Status should be 500');
      assert(resp.indexOf('content-type: text/plain') !== -1,'Header should be an object');
      assert(resp.indexOf('Rodger') !== -1,'Data should be an "Rodger');
   });
   it('should build with Buffer object as data', function(){
      assert(bufferResp.indexOf('201') !== -1 ,'Status should be 201');
      assert(bufferResp.indexOf('content-type: text/plain') !== -1,'Header should be an object');
      assert(bufferResp.indexOf('George') !== -1,'Data should be an "George');
   });
   it('should build with null data', function(){
      assert(undefDataResp.indexOf('404') !== -1 ,'Status should be 404');
      assert(undefDataResp.indexOf('content-type: text/plain') !== -1,'Header should be an object');
   });
});

describe('Testing parse',function(){
   var mongrelString = "12 4 /test 9:{\"c\":\"d\"},9:{\"a\":\"b\"},";
   var result        = m2n.parse(mongrelString);

   var mongrelStringEmptyJSON = "12 4 /test 9:{\"c\":\"d\"},2:,";
   var emptyValidJSON = m2n.parse(mongrelStringEmptyJSON);

   var mongrelStringinvalidJSON = "12 4 /test 9:{\"c\":\"d\"},9:{\"a\":b},";
   var invalidJSON = m2n.parse(mongrelStringinvalidJSON);

   it('should check result values', function(){
      assert.equal(12, result.uuid,'uuid should be 12');
      assert.equal(4, result.connId,'connid should be 4');
      assert.equal("/test", result.path,'Path should be "/test');
      assert.equal("d", result.headers.c,'Header "c" should be equal "d');
      assert.equal("b", result.json.a,'JSON key "a" should be equal "b');
   });

   it('should return true for empty json string', function(){
      assert( emptyValidJSON.valid_json,'valid_json should be true for empty string');
   });

   it('should return false for invalid json string', function(){
      assert.isFalse(invalidJSON.valid_json,'valid_json should be false for invalid string');
   })
});

describe('Testing netString parse',function(){
   var validNetstring = "9:'{Hello}',7:{Hello},";
   var result = m2n.parseNetstring(validNetstring);
   var incorrectPayload = "30:'{Hello}',6:{Hello},";
   var payloadResult = m2n.parseNetstring(incorrectPayload);
   var invalidNetstring = "3:'{Hello}',2:{Hello}";

   it('should not be Null', function(){
      assert.isNotNull(result,'The object should exist');
      assert.isNotNull(payloadResult,'The object should exist');
   });
   it('should check invalid netString', function(){
      try{
         m2n.parseNetstring(invalidNetstring)
      }catch(e){
         assert.equal('Netstring did not end in ","',e.message,"Error should be: 'Netstring did not end in ","'")
      }
   });
   it('should check valid netString', function(){
      assert.equal("\'{Hello}\',7:{Hello},", result.toString(),'Result String incorrect');
   });
});


describe('Testing getJSON',function(){
   var jsonObj = {"a":"b" };
   var validJSON = JSON.stringify(jsonObj);
   it('should return json object', function(){
      assert(jsonObj, m2n.getJSON(validJSON),"JSON object should be returned")
   });
   it('should return null', function(){
      assert.isNull(m2n.getJSON(""),"JSON object should be returned")
   });
});

describe('Testing Sender',function(){
   var config = { spec:'tcp://127.0.0.1:60000', bind:false, type:'pub', id:'a' };
   var sender = m2n.sender(config);

   var JOSNconfig = { spec:'tcp://127.0.0.1:60001', bind:false, type:'pub', id:'a', asJson:true };
   var JSONSender = m2n.sender(JOSNconfig);

   var m2nConfig = { spec:'tcp://127.0.0.1:60002', bind:true, type:'pub', id:'a', isMongrel2:true };
   var m2nSender = m2n.sender(m2nConfig);

   it('should create Sender', function(){
      assert.isNotNull(sender,"sender should not be null")
   });
   it('should call Sender.send()', function(){
      var sent = sender.send("msg");
      assert.isNotNull(sent,"sender should not be null");
   });

   it('should create Sender as JSON', function(){
      assert.isNotNull(JSONSender,"sender should not be null");
      assert.isNotNull(JSONSender.send, "send function should be present");
   });
   it('should call JSONSender.send()', function(){
      var sent = JSONSender.send(0,0,400,m2n.standard_headers.json,"Body");
      assert.notEqual(undefined,sent,"sender should not be null");
      assert.isNotNull(sent,"sender should not be null");
   });
   it('should add Process filters then JSONSender.send()', function(){
      m2n.addPostProcessFilter(function(){});
      m2n.addPreProcessFilter(function(){});
      var jsent = JSONSender.send(0,0,400,m2n.standard_headers.json,"Body");
      assert.notEqual(undefined,jsent,"sender should not be null");
      assert.isNotNull(jsent,"sender should not be null");
   });

   it('should create Mongrel2 Sender', function(){
      assert.isNotNull(m2nSender,"sender should not be null")
   });
   it('should call Mongrel2 Sender.send()', function(){
      var m2sent = m2nSender.send(0,0,400,m2n.standard_headers.json,"Body");
      assert.notEqual(undefined,m2sent,"sender should not be null");
      assert.isNotNull(m2sent,"sender should not be null")
   });

});

describe('Testing Receiver',function(){

   var errConfig = { spec:'tcp://127.0.0.1:60666', bind:true, type:'sub', id:'a', subscribe:"", isMongrel2:true };

   var sConfig = { spec:'tcp://127.0.0.1:60000', bind:true, type:'pub', id:'a' };
   var sender = m2n.sender(sConfig);

   var config = { spec:'tcp://127.0.0.1:60000', bind:false, type:'sub', id:'a', subscribe:"" };
   var receiver = m2n.receiver(config,errConfig,null);

   var m2nConfig = { spec:'tcp://127.0.0.1:60001', bind:true, type:'pull', id:'a', isMongrel2:true };
   var m2nReceiver = m2n.receiver(m2nConfig,errConfig,null);

   var m2nSConfig = { spec:'tcp://127.0.0.1:60001', bind:false, type:'push', id:'a' };
   var m2nSender = m2n.sender(m2nSConfig);

   it('should create Receiver', function(){
      assert.isNotNull(receiver,"sender should not be null")
   });
   it('should send message to Receiver', function(){
      var sent = sender.send("message");
      //assert.notEqual(undefined,sent,"sent message should not be undefined");
      assert.isNotNull(sent,"sent message should not be null")
   });

   it('should create Mongrel2 Receiver', function(){
      assert.isNotNull(m2nReceiver,"sender should not be null")
   });
   });