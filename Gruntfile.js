'use strict';

module.exports = function(grunt) {

   var tests       = 'test/**/*_test.js'
   var build_tests = 'build/instrument/' + tests
   var lib         = 'lib/**/*.js'

   grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      clean: {
         build:['build'],
         cover:['build/instrument/test']
      },
      jshint: {
         all: ['lib/*.js'],
         options: grunt.file.readJSON('.jshintrc')
      },
      nodeunit: {
         test:  [tests],
         cover: [build_tests]
      },
      watch : {
         files : [ lib, tests ],
         tasks : 'default'
      },
      plato: {
         options: {
            title: 'Awesome Project',
            jshint: grunt.file.readJSON('.jshintrc')
         },
         metrics: {
            files: {
               'build/metrics': [ lib ]
            }
         }
      },
      instrument : {
         files : [lib, tests],
         options : {
            lazy : true,
            basePath : 'build/instrument/'
         }
      },
      reloadTasks : {
         rootPath : 'build/instrument/lib'
      },
      storeCoverage : {
         options : {
            dir : 'build/reports/'
         }
      },
      makeReport : {
         src : 'build/reports/**/*.json',
         options : {
            reporters : {
               'lcov'     :{dir:'build/reports/'},
               'cobertura':{dir:'build/reports/'}
            },
            print : 'detail'

         }
      },
      coverage: {
         options: {
            thresholds: {
               'statements': 90,
               'branches': 90,
               'lines': 90,
               'functions': 90
            },
            dir: 'reports',
            root: 'build/'
         }
      },
      required: {
         libs: {
            options: {
               install: true
            },
            src: [lib]
         }
      }

   });

   grunt.loadNpmTasks('grunt-contrib-clean');
   grunt.loadNpmTasks('grunt-contrib-jshint');
   grunt.loadNpmTasks('grunt-contrib-uglify');
   grunt.loadNpmTasks('grunt-contrib-nodeunit');
   grunt.loadNpmTasks('grunt-contrib-qunit');
   grunt.loadNpmTasks('grunt-required');
   grunt.loadNpmTasks('grunt-testem');
   grunt.loadNpmTasks('grunt-qunit-cov');
   grunt.loadNpmTasks('grunt-plato');
   grunt.loadNpmTasks('grunt-node-tap');
   grunt.loadNpmTasks('grunt-istanbul');
   grunt.loadNpmTasks('grunt-istanbul-coverage');
   grunt.loadNpmTasks('grunt-contrib-nodeunit');
   grunt.loadNpmTasks('grunt-contrib-watch');

   // Default task(s).

   grunt.registerTask('test',     ['nodeunit:test']);
   grunt.registerTask('cover',    ['clean:build', 'instrument', 'reloadTasks', "nodeunit:cover", 'clean:cover', 'storeCoverage', 'makeReport']);
   grunt.registerTask('default',  ['required', 'jshint', 'nodeunit:test']);
   grunt.registerTask('jenkins',  ['jshint', 'cover', 'coverage', 'plato']);

};