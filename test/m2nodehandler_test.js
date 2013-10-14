/**
 * Created by dmccarthy on 09/10/2013.
 */

var base_path = require('./basePath.js');
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
            "BAD_REQUEST_400": 400,
            "UNAUTHORIZED_401": 401,
            "FORBIDDEN_402": 402,
            "NOT_FOUND_404": 404 }, "")

        test.done()
    }
}

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
}

exports['testConnect'] = {

    setUp   : function(done) {
        done()
    },
    'test connection established': function(test) {
        test.passed
        test.done()
    }
}