var querystring = require('querystring');
var async = require('async');
var signRequest = require('../../lib/request_signer').signRequest;

var request = require('request');

var PublicClient = require('./public.js');


function AuthenticatedClient(key, b64secret, passphrase, apiURI) {
  var things = {
    key: key,
    secret: b64secret,
    passphrase: passphrase,
    uri: apiURI || 'https://api.gdax.com'
  };

  function addHeaders(obj,other) {
    obj.headers = obj.headers || {};
    obj.headers['User-Agent'] = 'gdax-node-client';
    for (var k in other) obj.headers[k] = other[k];
    return obj;
  }

  function makeRelativeURI(parts) {
    return '/' + parts.join('/');
  }

  function makeAbsoluteURI(relativeURI) {
    return things.uri + relativeURI;
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
    var relURI = makeRelativeURI(uriParts);
    opts.method = method.toUpperCase();
    opts.timeout = 15000;
    opts.uri = makeAbsoluteURI(relURI);
    addHeaders(opts,_getSignature(method, relURI, opts));
    request(opts, makeRequestCallback(callback));
  }

  function _getSignature(method, relativeURI, opts) {
    var auth = {
      key: things.key,
      secret: things.secret,
      passphrase: things.passphrase
    };
    var sig = signRequest(auth, method, relativeURI, opts);
    if (opts.body) {
      opts.body = JSON.stringify(opts.body);
    }
    return {
      'CB-ACCESS-KEY': sig.key,
      'CB-ACCESS-SIGN': sig.signature,
      'CB-ACCESS-TIMESTAMP': sig.timestamp,
      'CB-ACCESS-PASSPHRASE': sig.passphrase,
    };
  }

  var pub = new PublicClient();

  return {

    getProductTicker: pub.getProductTicker,
    getAccounts: function(callback) {
      _request('get', ['accounts'], {}, callback);
    },
    getAccount: function(accountID, callback) {
      _request('get', ['accounts', accountID], {}, callback);
    },
    getAccountHistory: function(accountID, args, callback) {
      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }
      var opts = { 'qs': args };
      _request('get', ['accounts', accountID, 'ledger'], opts, callback);
    },
    getAccountHolds: function(accountID, args, callback) {
      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }
      var opts = { 'qs': args };
      _request('get', ['accounts', accountID, 'holds'], opts, callback);
    },
    _placeOrder: function(params, callback) {
      var requiredParams = ['side', 'product_id'];
      params.size ? requiredParams.push('size') : requiredParams.push('funds');
      if (params.type !== 'market') {
        requiredParams.push('price');
      }
      requiredParams.forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['orders'], opts, callback);
    },
    buy: function(params, callback) {
      params.side = 'buy';
      var requiredParams = ['side', 'product_id'];
      params.size ? requiredParams.push('size') : requiredParams.push('funds');
      if (params.type !== 'market') {
        requiredParams.push('price');
      }
      requiredParams.forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['orders'], opts, callback);
    },
    sell: function(params, callback) {
      params.side = 'sell';
      var requiredParams = ['side', 'product_id'];
      params.size ? requiredParams.push('size') : requiredParams.push('funds');
      if (params.type !== 'market') {
        requiredParams.push('price');
      }
      requiredParams.forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['orders'], opts, callback);
    },
    getTrailingVolume: function(callback) {
      _request('get', ['users', 'self', 'trailing-volume'], {}, callback);
    },
    cancelOrder: function(orderID, callback) {
      if (!callback && (typeof orderID === 'function')) {
        callback = orderID;
        callback(new Error('must provide an orderID or consider cancelOrders'));
        return;
      }
      _request('delete', ['orders', orderID], {}, callback);
    },
    cancelOrders: function(callback) {
      _request('delete', ['orders'], {}, callback);
    },
    cancelAllOrders: function(args, callback) {
      var currentDeletedOrders = [];
      var totalDeletedOrders = [];
      var query = true;
      var response;

      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }

      var opts = { 'qs': args };

      async.doWhilst(
        deleteOrders,
        untilEmpty,
        completed
      );

      function deleteOrders(done) {
        _request('delete', ['orders'], opts, function(err, resp, data) {

          if (err) {
            done(err);
            return;
          }

          if ((resp && resp.statusCode != 200) || !data) {
            var err = new Error('Failed to cancel all orders');
            query = false;
            done(err);
            return;
          }

          currentDeletedOrders = data;
          totalDeletedOrders = totalDeletedOrders.concat(currentDeletedOrders);
          response = resp;

          done();
        });
      }

      function untilEmpty() {
        return (currentDeletedOrders.length > 0 && query)
      }

      function completed(err) {
        callback(err, response, totalDeletedOrders);
      }
    },
    getOrders: function(args, callback) {
      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }
      var opts = { 'qs': args };
      _request('get', ['orders'], opts, callback);
    },
    getOrder: function(orderID, callback) {
      if (!callback && (typeof orderID === 'function')) {
        callback = orderID;
        callback(new Error('must provide an orderID or consider getOrders'));
        return;
      }
      _request('get', ['orders', orderID], {}, callback);
    },
    getFills: function(args, callback) {
      args = args || {}
      if (!callback && (typeof args === 'function')) {
        callback = args;
        args = {};
      }
      var opts = { 'qs': args };
      _request('get', ['fills'], opts, callback);
    },
    getFundings: function(callback) {
      _request('get', ['funding'], {}, callback);
    },
    repay: function(params, callback) {
      ['amount','currency'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['funding/repay'], opts, callback);
    },
    marginTransfer: function(params, callback) {
      ['margin_profile_id', 'type', 'currency', 'amount'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['profiles/margin-transfer'], opts, callback);
    },
    closePosition: function(params, callback) {
      ['repay_only'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['position/close'], opts, callback);
    },
    deposit: function(params, callback) {
      params.type = 'deposit';
      ['type', 'amount', 'coinbase_account_id'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['transfers'], opts, callback);
    },
    withdraw: function(params, callback) {
      ['currency', 'amount', 'crypto_address'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['withdrawals/crypto'], opts, callback);
    },
    _transferFunds: function(params, callback) {
      ['type', 'amount', 'coinbase_account_id'].forEach(function(param) {
        if (params[param] === undefined) throw "`opts` must include param `" + param + "`";
      });
      var opts = { 'body': params };
      _request('post', ['transfers'], opts, callback);
    },
  };
}

module.exports = exports = AuthenticatedClient;
