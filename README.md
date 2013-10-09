# m2nodehandler

Node implementation of Mongrel2 handler

## Getting Started
Install the module with: `npm install dao`

```javascript
var m2nodehandler = require('m2nodehandler');

```

## Documentation
_(Coming soon)_

## Examples
'use strict';

var m2n = new require('./m2nodehandler').M2nodeHandler();


var params = { recv_spec:"tcp://127.0.0.1:9997",
               send_spec:"tcp://127.0.0.1:9996",
               ident:"test" }


new m2n.connect( params, function( msg, responseCallback ) {

   var response = new m2n.Response( m2n.status.OK_200, { 'Content-Type': 'text/plain' }, "Hello, World!" )

   console.log(msg.body);
   console.log(msg.json);

   responseCallback( response );

});

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2013 dmccarthy  
Licensed under the MIT license.
