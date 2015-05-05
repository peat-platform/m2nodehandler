/**
 * Created by dmccarthy on 09/10/2013.
 */
var sys       = require('sys')
var zmq       = require('zmq')
var sinon     = require('sinon')
var base_path = require('./basePath.js')
var m2n       = require(base_path + '../lib/m2nodehandler.js')


/*
 ======== A Handy Little Nodeunit Reference ========
 https://github.com/caolan/nodeunit

 Test methods:
 test.expect(numAssertions)
 test.done()
 Test assertions:
 test.ok(value, [message])
 test.equal(actual, expected, [message])
 test.notEqual(actual, expected, [message])
 test.deepEqual(actual, expected, [message])
 test.notDeepEqual(actual, expected, [message])
 test.strictEqual(actual, expected, [message])
 test.notStrictEqual(actual, expected, [message])
 test.throws(block, [error], [message])
 test.doesNotThrow(block, [error], [message])
 test.ifError(value)
 */

exports['statuses'] = {

    'Testing response status values': function (test) {

        test.equal(m2n.status.OK_200,           200, "Should be 200")
        test.equal(m2n.status.BAD_REQUEST_400,  400, "Should be 400")
        test.equal(m2n.status.UNAUTHORIZED_401, 401, "Should be 401")
        test.equal(m2n.status.FORBIDDEN_402,    402, "Should be 402")
        test.equal(m2n.status.NOT_FOUND_404,    404, "Should be 404")

        test.done()
    }
}


exports['testResponseObject'] = {

    setUp    : function (done) {
        this.resp = new m2n.Response(500, {'content-type':'text/plain'}, "Rodger")
        done()
    },
    'Testing response status values': function (test) {

        test.equal(    this.resp.status,  500,                            "Should be 500"      )
        test.deepEqual(this.resp.headers, {"content-type": "text/plain"}, "Should be an object")
        test.equal(    this.resp.body,    "Rodger",                       "Should be Rodger"   )

        this.resp.setStatus(600)
        this.resp.setBody("Dodger")
        this.resp.setHeaders({"content-type":"application/json"})

        test.equal(    this.resp.status,  600,                                  "Should be 600"      )
        test.deepEqual(this.resp.headers, {"content-type": "application/json"}, "Should be an object")
        test.equal(    this.resp.body,    "Dodger",                             "Should be Dodger"   )

        this.resp.addHeader('length', '56')

        test.deepEqual(this.resp.headers, {"content-type": "application/json", "length":"56"}, "Should have length 56")
        test.deepEqual(m2n.status, { "OK_200": 200,
            "NO_CONTENT_204": 204,
            "BAD_REQUEST_400": 400,
            "UNAUTHORIZED_401": 401,
            "FORBIDDEN_402": 402,
            "NOT_FOUND_404": 404,
            "INTERNAL_SERVER_ERROR_500": 500 }, "")

        test.done()
    }
}

exports['testParse']          = {
    setUp                     : function (done) {
        done()
    },
    'test values as expected' : function (test) {

        var mongrelString = "12 4 /test 9:{\"c\":\"d\"},9:{\"a\":\"b\"},"
        var result        = m2n.parse(mongrelString)

        // The result should not be null.
        test.notEqual(result, null)
        // Test the values are as expected.
        test.equal(   result.uuid,      12              )
        test.equal(   result.connId,    4               )
        test.equal(   result.path,      "/test"         )
        test.equal(   result.headers.c, "d"             )
        test.equal(   result.json.a,    "b"             )
        test.done()
    }
};

exports['testParseNetString'] = {

    setUp            : function (done) {
        done()
    },
    'valid format'   : function (test) {
        var validNetstring = "9:'{Hello}',7:{Hello},"
        var result

        test.doesNotThrow ( function() {
            result         = m2n.parseNetstring(validNetstring)
        })
        test.notEqual(result, null, "The object should exist"    )
        test.equal(   result.toString(), "\'{Hello}\',7:{Hello},")
        test.done()
    },
    'invalid format' : function (test) {

        var invalidNetstring = "0:0:,"

        test.throws ( function() {
           m2n.parseNetstring(invalidNetstring)
        })

        test.done()
    }
};

exports['testGetJSON'] = {

    setUp    : function (done) {
        done()
    },
    'To JSON': function (test) {
        test.deepEqual(m2n.getJSON("a:'b', c:'d', [1,2,3]}"),  null, "Should be null")
        test.deepEqual(m2n.getJSON('{"a":"b", "c":"d", "e":[1,2,3]}'), { a: 'b', c: 'd', e: [ 1, 2, 3 ] },
            "String should be converted to object")
        test.done()
    }
};

exports['testBuildResponse'] = {

    setUp               : function (done) {
        done()
    },
    'Builds correctly'  : function (test) {
        var zmqResponse
        zmqResponse = m2n.buildZmqResponse(455, 192, "200 OK", "{test:test}", "{test:test}")

        test.deepEqual(zmqResponse.substring(0, 26), "455 3:192, HTTP/1.1 200 OK");
        test.done()
    }
};

//exports['testbindToPushQ'] = {
//
//    setUp          : function (done) {
//        this.params = { spec:"tcp://127.0.0.1:9996"}
//        done()
//    },
//    tearDown: function (done) {
//        done()
//    },
//    'create socket'     : function (test) {
//        var tempQueue = m2n.bindToPushQ(this.params)
//        tempQueue.push({})
//
//        // Exception will be thrown if socket already exists.
//        test.throws(function() { m2n.bindToPushQ(this.params) })
//        test.done()
//    }
//};

