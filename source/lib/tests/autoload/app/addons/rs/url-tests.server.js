/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
YUI.add('mojito-addon-rs-url-tests', function(Y, NAME) {
    
    var suite = new YUITest.TestSuite(NAME),
        libfs = require('fs'),
        libpath = require('path'),
        mojitoRoot = libpath.join(__dirname, '../../../../../'),
        A = YUITest.Assert,
        OA = YUITest.ObjectAssert,
        AA = YUITest.ArrayAssert;


    function MockRS(config) {
        MockRS.superclass.constructor.apply(this, arguments);
    }
    MockRS.NAME = 'MockResourceStore';
    MockRS.ATTRS = {};
    Y.extend(MockRS, Y.Base, {

        initializer: function(cfg) {
            this._config = cfg || {};
            this._mojits = {};
            this._appRVs = [];
            this._mojitRVs = {};
        },

        getStaticAppConfig: function() {
            return Y.clone(this._config.appConfig);
        },

        listAllMojits: function() {
            return Object.keys(this._mojits);
        },

        getResourceVersions: function(filter) {
            var source,
                out = [],
                r,
                res,
                k,
                use;
            source = filter.mojit ? this._mojitRVs[filter.mojit] : this._appRVs;
            if (!source) {
                return [];
            }
            for (r = 0; r < source.length; r += 1) {
                res = source[r];
                use = true;
                for (k in filter) {
                    if (filter.hasOwnProperty(k)) {
                        if (res[k] !== filter[k]) {
                            use = false;
                            break;
                        }
                    }
                }
                if (use) {
                    out.push(res);
                }
            }
            return out;
        },

        preloadResourceVersions: function() {
            // no-op
            return true;
        },

        _makeResource: function(pkg, mojit, type, name, affinity, yuiName) {
            if (mojit && mojit !== 'shared') {
                this._mojits[mojit] = true;
            }
            var res = {
                source: {
                    fs: {
                        fullPath: 'path/for/' + type + '--' + name + '.' + affinity + '.ext',
                        rootDir: 'path/for'
                    },
                    pkg: {
                        name: pkg
                    }
                },
                mojit: mojit,
                type: type,
                name: name,
                id: type + '--' + name,
                affinity: { affinity: affinity }
            }
            if (yuiName) {
                res.yui = { name: yuiName };
            }
            if (mojit) {
                if (!this._mojitRVs[mojit]) {
                    this._mojitRVs[mojit] = [];
                }
                this._mojitRVs[mojit].push(res);
            } else {
                this._appRVs.push(res);
            }
        }

    });


    function cmp(x, y, msg, path) {
        if (Y.Lang.isArray(x)) {
            A.isArray(x, msg || 'first arg should be an array');
            A.isArray(y, msg || 'second arg should be an array');
            A.areSame(x.length, y.length, msg || 'arrays are different lengths');
            for (var i = 0; i < x.length; i += 1) {
                cmp(x[i], y[i], msg);
            }
            return;
        }
        if (Y.Lang.isObject(x)) {
            A.isObject(x, msg || 'first arg should be an object');
            A.isObject(y, msg || 'second arg should be an object');
            A.areSame(Object.keys(x).length, Object.keys(y).length, msg || 'object keys are different lengths');
            for (var i in x) {
                if (x.hasOwnProperty(i)) {
                    cmp(x[i], y[i], msg);
                }
            }
            return;
        }
        A.areSame(x, y, msg || 'args should be the same');
    }


    function makeSource(dir, dirType, subdir, file, isFile) {
        var source = {
            fs: {
                fullPath: libpath.join(dir, subdir, file),
                rootDir: dir,
                rootType: dirType,
                subDir: subdir,
                subDirArray: subdir.split('/'),
                isFile: isFile,
                ext: libpath.extname(file)
            },
            pkg: {
                name: 'unittest',
                version: '999.666.999',
                depth: 999
            }
        };
        source.fs.basename = libpath.basename(file, source.fs.ext);
        return source;
    }


    suite.add(new YUITest.TestCase({
        
        name: 'url rs addon tests',
        
        'skip mojito-provided server-only mojits': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {}
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('mojito', null, 'mojit', 'X', 'common');
            store._makeResource('mojito', 'X', 'controller', 'controller', 'server');
            store.preloadResourceVersions();
            A.isUndefined(store._mojitRVs.X[0].url);
        },


        'include mojito-provided non-server-only mojits': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {}
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('mojito', null, 'mojit', 'X', 'common');
            store._makeResource('mojito', 'X', 'controller', 'controller', 'common');
            store._makeResource('mojito', null, 'mojit', 'Y', 'common');
            store._makeResource('mojito', 'Y', 'controller', 'controller', 'client');
            store._makeResource('mojito', 'Y', 'controller', 'controller', 'server');
            store.preloadResourceVersions();
            A.areSame(1, store._mojitRVs.X.length);
            A.areSame('/static/X/controller--controller.common.ext', store._mojitRVs.X[0].url);
            A.areSame(2, store._mojitRVs.Y.length);
            A.areSame('/static/Y/controller--controller.client.ext', store._mojitRVs.Y[0].url);
            A.areSame('/static/Y/controller--controller.server.ext', store._mojitRVs.Y[1].url);
        },


        'resources in "shared" mojit': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {}
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('mojito', 'shared', 'x', 'y', 'common');
            store._makeResource('orange', 'shared', 'x', 'y', 'common');
            store.preloadResourceVersions();
            A.areSame('/static/mojito/x--y.common.ext', store._mojitRVs.shared[0].url);
            A.areSame('/static/store/x--y.common.ext', store._mojitRVs.shared[1].url);
        },


        'normal mojit resources': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {}
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('orange', null, 'mojit', 'X', 'common');
            store._makeResource('orange', 'X', 'x', 'y', 'common');
            store._makeResource('orange', null, 'mojit', 'Y', 'common');
            store._makeResource('orange', 'Y', 'x', 'y', 'common');
            store.preloadResourceVersions();
            A.areSame('/static/X/x--y.common.ext', store._mojitRVs.X[0].url);
            A.areSame('/static/Y/x--y.common.ext', store._mojitRVs.Y[0].url);
        },


        'configuration via appConfig': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {
                    staticHandling: {
                        prefix: '',
                        frameworkName: 'FFF',
                        appName: 'AAA'
                    }
                }
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('mojito', 'shared', 'x', 'y', 'common');
            store._makeResource('orange', 'shared', 'x', 'y', 'common');
            store.preloadResourceVersions();
            A.areSame('/FFF/x--y.common.ext', store._mojitRVs.shared[0].url);
            A.areSame('/AAA/x--y.common.ext', store._mojitRVs.shared[1].url);
        },


        'assume rollups': function() {
            var fixtures = libpath.join(__dirname, '../../../../fixtures/store');
            var store = new MockRS({
                root: fixtures,
                appConfig: {
                    staticHandling: { assumeRollups: true }
                }
            });
            store.plug(Y.mojito.addons.rs.url, { appRoot: fixtures, mojitoRoot: mojitoRoot } );

            store._makeResource('mojito', 'shared', 'x', 'y', 'common', 'red');
            store._makeResource('orange', 'shared', 'x', 'y', 'common', 'red');
            store._makeResource('orange', null, 'mojit', 'X', 'common');
            store._makeResource('orange', 'X', 'x', 'y', 'common', 'red');
            store._makeResource('orange', null, 'mojit', 'Y', 'common');
            store._makeResource('orange', 'Y', 'x', 'y', 'common', 'red');
            store._makeResource('orange', 'Y', 'not', 'yui', 'common');
            store.preloadResourceVersions();
            A.areSame('/static/store/rollup.client.js', store._mojitRVs.shared[0].url);
            A.areSame(libpath.join(fixtures, 'rollup.client.js'), store._mojitRVs.shared[0].source.fs.rollupPath);
            A.areSame('/static/store/rollup.client.js', store._mojitRVs.shared[1].url);
            A.areSame(libpath.join(fixtures, 'rollup.client.js'), store._mojitRVs.shared[1].source.fs.rollupPath);
            A.areSame('/static/X/rollup.client.js', store._mojitRVs.X[0].url);
            A.areSame('path/for/mojit--X.common.ext/rollup.client.js', store._mojitRVs.X[0].source.fs.rollupPath);
            A.areSame('/static/Y/rollup.client.js', store._mojitRVs.Y[0].url);
            A.areSame('path/for/mojit--Y.common.ext/rollup.client.js', store._mojitRVs.Y[0].source.fs.rollupPath);
            A.areSame('/static/Y/not--yui.common.ext', store._mojitRVs.Y[1].url);
            A.isUndefined(store._mojitRVs.Y[1].source.fs.rollupPath);
        }

        
    }));
    
    YUITest.TestRunner.add(suite);
    
}, '0.0.1', {requires: ['base', 'oop', 'addon-rs-url']});
