(function(global) {
  'use strict';

  var Promise = global.Promise || require('es6-promise').Promise;

  var generatorFunctionToProducer = function(gen) {
    gen = gen();
    return function() {
      var res = gen.next();
      return res.done ? null : res.value;
    };
  };

  var toProducer = function(obj) {
    var type = typeof obj;
    if (type === 'function') {
      if (obj.constructor && obj.constructor.name === 'GeneratorFunction') {
        return generatorFunctionToProducer(obj);
      } else {
        return obj;
      }
    }
    if (type !== 'object' || typeof obj.then !== 'function') {
      obj = Promise.resolve(obj);
    }
    var called = false;
    return function() {
      if (called) {
        return null;
      }
      called = true;
      return obj;
    };
  };

  var pool = function(source, concurrency, options) {
    options = options || {};
    var onResolve = options.onresolve || function() {};
    var onReject = options.onreject || function() {};
    var producer = toProducer(source);
    var size = 0;
    var consumed = false;
    var poolPromise = new Promise(function(resolve, reject) {
      var failed = false;
      var proceed = function() {
        if (!consumed) {
          var promise;
          while (size < concurrency && !!(promise = producer())) {
            promise.then(function(result) {
              size--;
              if (!failed) {
                onResolve(poolPromise, promise, result);
                proceed();
              }
            }, function(err) {
              if (!failed) {
                failed = true;
                onReject(poolPromise, promise, err);
                reject(err);
              }
            });
            size++;
          }
          if (!promise) {
            consumed = true;
          }
        }
        if (consumed && size === 0) {
          resolve();
        }
      };
      proceed();
    });
    poolPromise.pool = {
      size: function() {
        return size;
      },
      concurrency: function(value) {
        if (typeof value !== 'undefined') {
          concurrency = value;
        }
        return concurrency;
      }
    };
    return poolPromise;
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = pool;
  } else {
    global.promisePool = pool;
  }
})(this);