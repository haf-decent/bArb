var request = require('request');

var Readable = require('stream').Readable;

function PublicClient() {
  var apiURI = 'https://api.gdax.com';

  function addHeaders(obj) {
    obj.headers = obj.headers || {};
    obj.headers['User-Agent'] = 'gdax-node-client';
    return obj;
  }

  function makeRelativeURI(parts) {
    return '/' + parts.join('/');
  }

  function makeAbsoluteURI(relativeURI) {
    return apiURI + relativeURI;
  }

  function makeRequestCallback(callback) {
    return function(err, response, data) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.log('problem parsing response');
        data = null;
      }
      callback(err, response, data);
    };
  }

  function _request(method, uriParts, opts, callback) {
    opts = opts || {};
    if (!callback && (typeof opts === 'function')) {
      callback = opts;
      opts = {};
    }
    if (!callback) {
      throw "Must supply a callback."
    }
    opts.method = method.toUpperCase();
    opts.timeout = 15000;
    opts.uri = makeAbsoluteURI(makeRelativeURI(uriParts));
    addHeaders(opts);
    request(opts, makeRequestCallback(callback));
  }

  return {
    getProducts: function(callback) {
      return _request('get',[],{},callback);
    },
    getProductOrderBook: function(curr, args, callback) {
      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }

      var opts = { 'qs': args };
      return _request('get',['product',curr,'book'],opts,callback);
    },
    getProductTicker: function(curr, callback) {

      _request('get', ['products', curr, 'ticker'], {}, callback);
    },
    // prototype.getProductTrades = function(curr, args, callback) {
    //
    //
    //   args = args || {}
    //   if (!callback && (typeof args === 'function')) {
    //     callback = args;
    //     args = {};
    //   }
    //
    //   var opts = {'qs': args};
    //   return prototype.get.call(self, ['products', curr, 'trades'], opts, callback);
    // };
    // prototype.getProductHistoricRates = function(curr, args, callback) {
    //
    //
    //   args = args || {}
    //   if (!callback && (typeof args === 'function')) {
    //     callback = args;
    //     args = {};
    //   }
    //
    //   var opts = {'qs': args};
    //   return prototype.get.call(self, ['products', curr, 'candles'], opts, callback);
    // };
    //
    // prototype.getProduct24HrStats = function(curr, callback) {
    //
    //   return prototype.get.call(self, ['products', curr, 'stats'], callback);
    // };
    //
    // prototype.getCurrencies = function(callback) {
    //
    //   return prototype.get.call(self, ['currencies'], callback);
    // };
    getTime: function(callback) {
      return _request('getTime', ['time'], null, callback);
    },
  };
}

module.exports = exports = PublicClient;
