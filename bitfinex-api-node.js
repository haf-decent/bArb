#! /usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

"use strict";

const crypto = require('crypto');
const request = require('request');

function rest (key, secret, nonceGenerator) {
  var opts = {
    url: 'https://api.bitfinex.com',
    version: 'v1',
    key: key,
    secret: secret,
    nonce: new Date().getTime(),
    _nonce: typeof nonceGenerator === 'function' ? nonceGenerator : function () {
          // noinspection JSPotentiallyInvalidUsageOfThis
      return ++this.nonce;
    }
  };

  function make_request(path, params, cb) {
    var headers, key, nonce, payload, signature, url, value;
    if (!opts.key || !opts.secret) {
      return cb(new Error('missing api key or secret'));
    }
    url = `${opts.url}/${opts.version}/${path}`;
    nonce = JSON.stringify(opts._nonce());
    payload = {
      request: `/${opts.version}/${path}`,
      nonce
    };
    for (key in params) {
      value = params[key],
      payload[key] = value
    }
    payload = new Buffer(JSON.stringify(payload)).toString('base64');
    signature = crypto.createHmac('sha384', opts.secret).update(payload).digest('hex');
    headers = {
      'X-BFX-APIKEY': opts.key,
      'X-BFX-PAYLOAD': payload,
      'X-BFX-SIGNATURE': signature
    }
    return request({
      url,
      method: 'POST',
      headers,
      timeout: 15000
    }, (err, response, body) => {
      var error, result;
      if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
        return cb(new Error(err != null ? err : response.statusCode));
      }
      try {
        result = JSON.parse(body);
      } catch (error1) {
        error = error1;
        return cb(null, {
          message: body.toString()
        });
      }
      if (result.message != null) {
        return cb(new Error(result.message));
      }
      return cb(null, result);
    });
  }

  function make_public_request(path, cb) {
    const url = `${opts.url}/${opts.version}/${path}`;
    return request({
      url,
      method: 'GET',
      timeout: 15000
    }, (err, response, body) => {
      var error, result;
      if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
        return cb(new Error(err != null ? err : response.statusCode));
      }
      try {
        result = JSON.parse(body);
      } catch (error1) {
        error = error1;
        return cb(null, {
          message: body.toString()
        });
      }
      if (result.message != null) {
        return cb(new Error(result.message));
      }
      return cb(null, result);
    })
  }

  return {
    ticker: function (symbol, cb) {
      if (arguments.length == 0) {
        symbol = 'BTCUSD';
        cb = function (error, data) { console.log(data); };
      }
      return make_public_request('pubticker/' + symbol, cb);
    },
    today: function (symbol, cb) {
      return make_public_request('today/' + symbol, cb);
    },
    stats: function (symbol, cb) {
      return make_public_request('stats/' + symbol, cb);
    },
    fundingbook: function (currency, options, cb) {
      var err, index, option, query_string, uri, value;
      index = 0;
      uri = 'lendbook/' + currency;
      if (typeof options === 'function') {
        cb = options;
      } else {
        try {
          for (option in options) {
            value = options[option];
            if (index++ > 0) {
              query_string += '&' + option + '=' + value;
            } else {
              query_string = '/?' + option + '=' + value;
            }
          }
          if (index > 0) {
            uri += query_string;
          }
        } catch (error1) {
          err = error1;
          return cb(err);
        }
      }
      return make_public_request(uri, cb);
    },
    orderbook: function (symbol, options, cb) {
      var err, index, option, query_string, uri, value;
      index = 0;
      uri = 'book/' + symbol;
      if (typeof options === 'function') {
        cb = options;
      } else {
        try {
          for (option in options) {
            value = options[option];
            if (index++ > 0) {
              query_string += '&' + option + '=' + value;
            } else {
              query_string = '/?' + option + '=' + value;
            }
          }
          if (index > 0) {
            uri += query_string;
          }
        } catch (error1) {
          err = error1;
          return cb(err);
        }
      }
      return make_public_request(uri, cb);
    },
    trades: function(symbol, cb) {
      return make_public_request('trades/' + symbol, cb);
    },
    lends: function(currency, cb) {
      return make_public_request('lends/' + currency, cb);
    },
    get_symbols: function (cb) {
      return make_public_request('symbols', cb);
    },
    symbols_details: function (cb) {
      return make_public_request('symbols_details', cb);
    },
    new_order: function (symbol, amount, price, exchange, side, type, is_hidden, postOnly, cb) {
      if (typeof is_hidden === 'function') {
        cb = is_hidden;
        is_hidden = false;
      }

      if (typeof postOnly === 'function') {
        cb = postOnly;
        postOnly = false;
      }

      const params = {
        symbol,
        amount,
        price,
        exchange,
        side,
        type
      };

      if (postOnly) {
        params['post_only'] = true;
      }
      if (is_hidden) {
        params['is_hidden'] = true;
      }
      return make_request('order/new', params, cb);
    },
    multiple_new_orders: function (orders, cb) {
      const params = {
        orders
      };
      return make_request('order/new/multi', params, cb);
    },
    cancel_order: function (order_id, cb) {
      const params = {
        order_id: parseInt(order_id)
      };
      return make_request('order/cancel', params, cb);
    },
    cancel_all_orders: function (cb) {
      return make_request('order/cancel/all', {}, cb);
    },
    cancel_multiple_orders: function (order_ids, cb) {
      const params = {
        order_ids: order_ids.map((id) => parseInt(id))
      };
      return make_request('order/cancel/multi', params, cb);
    },
    replace_order: function (order_id, symbol, amount, price, exchange, side, type, cb) {
      const params = {
        order_id: parseInt(order_id),
        symbol,
        amount,
        price,
        exchange,
        side,
        type
      };
      return make_request('order/cancel/replace', params, cb);
    },
    order_status: function (order_id, cb) {
      const params = {
        order_id
      };
      return make_request('order/status', params, cb);
    },
    active_orders: function (cb) {
      return make_request('orders', {}, cb);
    },
    active_positions: function (cb) {
      return make_request('positions', {}, cb);
    },
    claim_position: function (position_id, cb) {
      const params = {
        position_id: parseInt(position_id)
      }
      return make_request('position/claim', params, cb);
    },
    balance_history: function (currency, options, cb) {
      var err, option, value;
      const params = {
        currency
      };
      if (typeof options === 'function') {
        cb = options;
      } else {
        try {
          for (option in options) {
            value = options[option];
            params[option] = value;
          }
        } catch (error1) {
          err = error1;
          return cb(err);
        }
      }
      return make_request('history', params, cb);
    },
    movements: function (currency, options, cb) {
      var err, option, value;
      const params = {
        currency
      };
      if (typeof options === 'function') {
        cb = options;
      } else {
        try {
          for (option in options) {
            value = options[option];
            params[option] = value;
          }
        } catch (error1) {
          err = error1;
          return cb(err);
        }
      }
      return make_request('history/movements', params, cb);
    },
    past_trades: function (symbol, options, cb) {
      var err, option, value;
      const params = {
        symbol
      };
      if (typeof options === 'function') {
        cb = options;
      } else {
        try {
          for (option in options) {
            value = options[option];
            params[option] = value;
          }
        } catch (error1) {
          err = error1;
          return cb(err);
        }
      }
      return make_request('mytrades', params, cb);
    },
    new_deposit: function (currency, method, wallet_name, renew, cb) {
      const params = {
        currency,
        method,
        wallet_name,
        renew,
      };
      return make_request('deposit/new', params, cb);
    },
    new_offer: function (currency, amount, rate, period, direction, cb) {
      const params = {
        currency,
        amount,
        rate,
        period,
        direction
      };
      return make_request('offer/new', params, cb);
    },
    cancel_offer: function (offer_id, cb) {
      const params = {
        offer_id
      };
      return make_request('offer/cancel', params, cb);
    },
    offer_status: function (offer_id, cb) {
      const params = {
        offer_id
      };
      return make_request('offer/status', params, cb);
    },
    active_offers: function (cb) {
      return make_request('offers', {}, cb);
    },
    active_credits: function (cb) {
      return make_request('credits', {}, cb);
    },
    wallet_balances: function (cb) {
      return make_request('balances', {}, cb);
    },
    taken_swaps: function (cb) {
      return make_request('taken_funds', {}, cb);
    },
    total_taken_swaps: function (cb) {
      return make_request('total_taken_funds', {}, cb);
    },
    close_swap: function (swap_id, cb) {
      return make_request('swap/close', {
        swap_id
      }, cb);
    },
    account_infos: function (cb) {
      return make_request('account_infos', {}, cb);
    },
    margin_infos: function (cb) {
      return make_request('margin_infos', {}, cb);
    },
    withdraw: function (withdraw_type, walletselected, amount, address, cb) {
      const params = {
        withdraw_type,
        walletselected,
        amount,
        address
      };
      return make_request('withdraw', params, cb);
    },
    transfer: function (amount, currency, walletfrom, walletto, cb) {
      const params = {
        amount,
        currency,
        walletfrom,
        walletto
      };
      return make_request('transfer', params, cb);
    },
  };
}

module.exports = rest;
