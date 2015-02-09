var Promise = require('es6-promise').Promise;
var findup = require('findup-sync');
var browserSync = require('browser-sync');
var nodemon = require('nodemon');
var fs = require('./utils/fs');
var log = require('./utils/log');
var build = require('./build');
var componentConfigPath = findup('component.config.js') || log.onError('You must have a component.config.js in the root of your project.');
var component = require(componentConfigPath);
var helper = require('./utils/config-helper');
var paths = helper.parsePaths(component.paths);

function loadBrowser(args){
    args = Array.isArray(args) ? args[0] : args;
    var baseDir = args || component.serve || paths.site.root;
    startServer(args).then(function(proxy){
        var config = {
            port: 3456,
            server: {
                baseDir: baseDir
            }
        }
        if (proxy){
            config = { proxy: proxy.host, port:proxy.port }
        }
        browserSync(config);
    })
}

function startServer(args){
    var serve = args || component.serve;
    if (Array.isArray(serve) || typeof serve==='string') return Promise.resolve();
    return new Promise(function(resolve, reject){
        nodemon({
            script: serve.script,
            env: serve.env
        }).on('start', function(ee){
            log.info('Server Started')
            resolve(serve);
        });
    });
}

var buildAndReload = {
    html: function() {    return build.html().then(browserSync.reload)  },
    scripts: function() { return build.scripts().then(browserSync.reload)  },
    styles: function() {  return build.styles().then(browserSync.reload)   }
};

function watch(){
    var htmlPaths = [ ];
    var stylesPaths = [paths.source.styles + '/**/*' ];
    var scriptsPaths =   [paths.source.scripts + '/**/*' ];
    if (paths.demo){
        htmlPaths.push(paths.demo.root + '/**/*.html')
        stylesPaths.push(paths.demo.styles + '/**/*');
        scriptsPaths.push(paths.demo.styles + '/**/*');
    }
    fs.watch(htmlPaths, [buildAndReload.html]);
    fs.watch(stylesPaths, [buildAndReload.styles]);
    fs.watch(scriptsPaths,   [buildAndReload.scripts]);
}


function quick(args){
    return new Promise(function(resolve, reject){
        loadBrowser(args);
        watch();
        resolve()
    });
}


module.exports = {
    quick: quick,
    all: function(args){
        return build.all().then(function(){
            return quick(args);
        })
    }
}