'use strict';
var gulp;
var pkg;
var browserSync = require('browser-sync');
var plugins = {
    autoprefixer: require('gulp-autoprefixer'),
    awsS3 : require('gulp-aws-s3'),
    bower : require('gulp-bower'),
    concat : require('gulp-concat'),
    ghPages : require('gulp-gh-pages'),
    replace : require('gulp-replace'),
    run : require('gulp-run'),
    sass : require('gulp-sass'),
    del : require('del'),
    minimist : require('minimist'),
    'if' : require('gulp-if'),
    bump : require('gulp-bump')
};
var paths = require('./paths');

var knownOptions = {
    string: 'version',
    default: { env: 'patch' }
};

var options = plugins.minimist(process.argv.slice(2), knownOptions);

function copyDir(location, fileType){
    var files = (fileType === 'css') ? '/main.css' : '/**/*';
    return gulp.src([paths[location][fileType] + files])
        .pipe(gulp.dest(paths.dist[fileType]));
}

function awsUpload(fileType, awsS3){
    var path = 'components/' + pkg.name.replace('bskyb-','') + '/' + pkg.version + '/' + fileType + '/';
    return gulp.src(paths.dist[fileType] + '/**/*')
        .pipe(awsS3.upload({ path: path } ));
}

function updateDocs(files){
    var now = Date().split(' ').splice(0,5).join(' ');
    return gulp.src(files, { base : './' })
        .pipe(plugins.replace(/[0-9]+\.[0-9]+\.[0-9]/g, pkg.version))
        .pipe(plugins.replace(/{{ site.version }}/g, pkg.version))
        .pipe(plugins.replace(/{{ site.time }}/g, now))
        .pipe(gulp.dest('./'));
}


function initBower(){
    //todo
}

function initGHPages(){
    //todo
}

function gulpTasks(globalGulp, globalPkg){
    gulp = globalGulp;
    pkg = globalPkg;
    var runSequence = require('run-sequence').use(gulp);


    gulp.task('pre-build', function(cb){
        return cb();
    });

    gulp.task('sass', function() {
        browserSync.notify('<span style="color: grey">Running:</span> Sass compiling');
        return gulp.src([
                paths.source['sass'] + '/**/*.scss',
                paths.demo['sass'] + '/**/*.scss',
                paths.site['sass'] + '/**/*.scss'])
            .pipe(plugins.sass({
                includePaths: ['bower_components'],
                outputStyle: 'nested'
            }))
            .pipe(plugins.autoprefixer())
            .pipe(gulp.dest(paths.site['css']))
            .pipe(browserSync.reload({stream:true}));
    });



    gulp.task('browserSync', function() {
        browserSync({
            port: 3456,
            server: {
                baseDir: paths.site['root']
            }
        });
    });

    gulp.task('watch', function() {
        gulp.watch([paths.site['root'], paths.demo['root']], ['create-site']);
        gulp.watch([paths.source['sass'] + '/**/*',paths.demo['sass']], ['sass']);
    });


//    create the _ste directories ready for demo
    gulp.task('create-site-html', function createSite() {
        return gulp.src([paths.demo['root'] + '/index.html',
                paths.demo['root'] +'/_includes/*.html'])
            .pipe(plugins.concat('index.html'))
            .pipe(gulp.dest(paths.site['root']));
    });

    gulp.task('create-site-images', function createSite() {
        return gulp.src(paths.demo['images'] + '/**/*')
            .pipe(gulp.dest(paths.site['images']));
    });

    gulp.task('create-site-fonts', function createSite() {
        return gulp.src(paths.source['fonts'] + '/**/*')
            .pipe(gulp.dest(paths.site['fonts']));
    });
    gulp.task('create-site', function createSite() {
        return runSequence(['create-site-html', 'create-site-images', 'create-site-fonts']);
    });


    gulp.task('build', function(cb) {
        return runSequence('clean', 'pre-build', ['create-site','bower'], ['update-docs-version', 'sass'],'create-bower-dist',
            cb
        );
    });

//remove temporary directors
    gulp.task('clean', function(cb) {
        return plugins.del([
            '.tmp',
            paths.site['root'],
            paths.dist['root']
        ], cb);
    });

//update the version number used within all documentation and html
    gulp.task('update-docs-version-within-md', function(){
        return updateDocs(['README.md']);
    });
    gulp.task('update-docs-version-within-site', function(){
        return updateDocs([paths.site['root'] + '/**/*.html']);
    });
    gulp.task('update-docs-version', function(cb){
        return runSequence(['update-docs-version-within-site', 'update-docs-version-within-md'],cb);
    });
    gulp.task('bump-version', function(cb){
        return gulp.src('./*.json')
            .pipe(plugins.bump({type: options.version}))
            .pipe(gulp.dest('./'));
    });


/*
 * RELEASING
 */

//  RELEASING:  Bower tasks
    gulp.task('create-bower-dist', function() {
        copyDir('site', 'css');
        copyDir('site','sass');
        copyDir('site','fonts');
        copyDir('source','fonts');
        return copyDir('source','sass');
    });

    gulp.task('run-release-bower', function(cb) {
        plugins.run('git tag -a v'+ pkg.version +' -m "release v' + pkg.version +' for bower"; git push origin master v'+ pkg.version).exec();
    });

    gulp.task('bower', function() {
        return plugins.bower()
    });

    gulp.task('release:bower', function(cb) {
        return runSequence(
            'build',
            'run-release-bower',
            cb
        );
    });

//  RELEASING:  GH Pages
    gulp.task('gh-pages', function () {
        gulp.src(paths.site['root'] + "/**/*")
            .pipe(plugins.ghPages({
                cacheDir: '.tmp'
            })).pipe(gulp.dest('/tmp/gh-pages'));
    });

    gulp.task('release:gh-pages', function(cb) {
        return runSequence(
            'build',
            'gh-pages',
            cb
        );
    });

//  RELEASING:  Amazon Web Services
    gulp.task('aws', function() {
        var awsS3 = plugins.awsS3.setup({bucket: process.env.AWS_SKYGLOBAL_BUCKET});
        awsUpload('css',awsS3);
        awsUpload('js', awsS3);
        awsUpload('fonts', awsS3);
        awsUpload('icons', awsS3);
    });
    gulp.task('release:cdn', function(cb) {
        return runSequence(
            'build',
            'aws',
            cb
        );
    });


    /*
     * Common/public Gulp tasks
     */
    gulp.task('init', function() {
        return gulp.src(__dirname + '/component-structure/**/*')
            .pipe(plugins.replace(/{{ component }}/g, pkg.name))
            .pipe(gulp.dest('./'));
    });

    gulp.task('serve', function(callback) {
        return runSequence(
            'build',
            ['browserSync', 'watch'],
            callback
        );
    });

    gulp.task('release', function(cb) {
        return runSequence(
            'bump-version',
            'build',
            ['run-release-bower',
                'gh-pages',
                'aws'],
            cb
        );
    });

    return {
        paths: paths
    }
}


module.exports = gulpTasks;