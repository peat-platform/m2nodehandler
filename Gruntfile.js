'use strict';

module.exports = function(grunt) {

   // Project configuration.
   grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      clean: ['build'],
      jshint: {
         all: ['lib/*.js'],
         options: grunt.file.readJSON('.jshintrc')
      },
      nodeunit: {
         files: ['test/**/*_test.js'],
      },
      plato: {
         options: {
            title: 'Awesome Project',
            jshint: grunt.file.readJSON('.jshintrc')
         },
         metrics: {
            files: {
               'build/metrics': [ 'lib/*.js' ]
            }
         }
      },
      // Grunt-Istanbul Config Section
      instrument : {
         files : 'lib/*.js',
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
               'lcov':{dir:'build/reports/'},
               'cobertura':{dir:'build/reports/'}
            },
            //dir : 'istanbul/reports/',
            print : 'detail'

         }
      }
      //*******************************

   });

   grunt.loadNpmTasks('grunt-contrib-clean');
   grunt.loadNpmTasks('grunt-contrib-jshint');
   grunt.loadNpmTasks('grunt-contrib-uglify');
   grunt.loadNpmTasks('grunt-contrib-nodeunit');
   grunt.loadNpmTasks('grunt-testem');
   grunt.loadNpmTasks('grunt-qunit-cov');
   grunt.loadNpmTasks('grunt-plato');
   grunt.loadNpmTasks('grunt-node-tap');
   grunt.loadNpmTasks('grunt-istanbul');
   grunt.loadNpmTasks('grunt-contrib-nodeunit');
   grunt.loadNpmTasks('grunt-contrib-watch');

   // Default task(s).
   grunt.registerTask('istanbul', ['instrument', 'reloadTasks','storeCoverage', 'makeReport']);
   grunt.registerTask('default',  ['jshint', 'clean', 'nodeunit', 'istanbul']);
   grunt.registerTask('jenkins',  ['jshint', 'clean', 'nodeunit', 'istanbul', 'plato']);

};