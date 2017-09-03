#! /usr/bin/env node
"use strict";

var debug = true;

var threshhold = 3,
    exchanges = ["Kraken","Poloniex","Bittrex","GDAX","Coinbase"],
    currencies = ["XBT","BTC","ETH","LTC","USD","USDT"],
    depMethods = {
      "Kraken": {
        "BTC": "Bitcoin", 
        "XBT": "Bitcoin", 
        "ETH": "Ether (Hex)", 
        "LTC": "Litecoin", 
        "USD": "SynapsePay (US Wire)"
	    },
//      "Bitfinex": {
  //		  "BTC": "bitcoin", 
  //		  "LTC": "litecoin", 
  //		  "ETH": "ethereum", 
  //		  "USD": "mastercoin"
//	  },
    };

var info = require("./secrets.js");

var KrakenClient = require("./npm-kraken-api"),
    PoloniexClient = require("./poloniex-api-node"),
    bittrex = require("./node.bittrex.api"),
    GdaxClient = require("./gdax"),
    CbClient = require('./coinbase').Client;
    //BitfinexClient = require("./bitfinex-node-api.js");

var kraken = new KrakenClient(info.kraken.key,info.kraken.secret),
    poloniex = new PoloniexClient(info.poloniex.key,info.poloniex.secret),
    gdax = new GdaxClient.AuthenticatedClient(info.gdax.key,info.gdax.secret,info.gdax.pass),
    coinbase = new CbClient({'apiKey': info.coinbase.key, 'apiSecret': info.coinbase.secret});
    //bitfinex = new BitfinexClient(info.bitfinex.key,info.bitfinex.secret);
    bittrex.options({
      "apikey": info.bittrex.key, 
      "apisecret": info.bittrex.secret
    });

var bArb = {
  "Kraken": {
    getPrice: function(curr, cb) {
      cb = cb || genericCB;
      check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        kraken.api("Ticker", {"pair": ncurr[0]+ncurr[1]}, function(error, data) {
          if (error) throw error;
          var ret = data.result['X'+ncurr[0]+'Z'+ncurr[1]] || data.result['X'+ncurr[0]+'X'+ncurr[1]];
          ret = [ret["a"][0], ret["b"][0], ret["c"][0]];
          cb(ret);
        });
      });
    },
    getBalances: function(curr, cb) {
      cb = cb || genericCB;
      if (curr) check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        kraken.api("Balance", null, function(error, data) {
          if (error) throw error;
          var ret = data.result['X'+ncurr[0]] || data.result['Z'+ncurr[0]] || data.result;
          cb(ret);
        });
      });
      else kraken.api("Balance", null, function(error, data) {
        if (error) throw error;
        var ret ={};
        Object.keys(data.result).forEach(function(x) {
		  if (x == "BCH") ret[x] = data.result[x];
          else ret[x.substring(1)] = data.result[x];
        });
        cb(ret);
      });
    },
    getAddress: function(curr, cb, generate) {
      cb = cb || genericCB;
      check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        var options = {
          asset: ncurr[0],
          method: depMethods["Kraken"][ncurr[0]]
        };
        if (generate) options.new = true;
        kraken.api("DepositAddresses", options, function(error, data) {
          if (error) throw error;
          var ret = Array.isArray(data.result) ? data.result[0] : data.result;
		  ret = ret ? ret.address : ret;
          cb(ret);
        });
      });
    },
    buy: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        var options = {
          pair: 'X'+ncurr[0]+'Z'+ncurr[1],
          type: "buy",
          ordertype: "market",
          volume: amt
        }
        if (debug) options.validate = true;
        kraken.api("AddOrder", options, function(error,data) {
          if (error) throw error;
          var ret = data.result;
          if (debug) console.log('Kraken: buy transaction is in validation mode, order not submitted.');
          cb(ret);
        });
      });
    },
    sell: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        var options = {
          pair: 'X'+ncurr[0]+'Z'+ncurr[1],
          type: "sell",
          ordertype: "market",
          volume: amt
        };
        if (debug) options.validate = true;
        kraken.api("AddOrder", options, function(error,data) {
          if (error) throw error;
          var ret = data.result;
          if (debug) console.log('Kraken: sell transaction is in validation mode, order not submitted.');
          cb(ret);
        });
      });
    },
    cancel: function(id, cb) {
      cb = cb || genericCB;
      kraken.api('CancelOrder', {"txid": id}, function(error,data) {
        if (error && !debug) throw error;
        var ret = debug ? data : data.result.count;
        cb(ret);
      });
    },
    withdraw: function(curr, amt, id, cb) {
      cb = cb || genericCB;
      check(["Kraken"], curr, function(pair) {
        var ncurr = pair[0];
        kraken.api('Withdraw', {"asset": ncurr[0], "amount": amt, "key": id}, function(error,data) {
          if (error && !debug) throw error;
          var ret = debug ? data : data.result;
          cb(ret);
        });
      });
    }
  },
  "Poloniex": {
    getPrice: function(curr, cb) {
      cb = cb || genericCB;
      check(["Poloniex"], curr, function(pair) {
        var ncurr = pair[0];
        poloniex.returnTicker(function(error, data) {
          if (error) throw error;
          var ret = data[ncurr[1]+'_'+ncurr[0]];
          ret = [ret["lowestAsk"], ret["highestBid"], ret["last"]];
          cb(ret);
        });
      });
    },
    getBalances: function(curr, cb) {
      cb = cb || genericCB;
      if (curr) check(["Poloniex"], curr, function(pair) {
        var ncurr = pair[0];
        poloniex.returnBalances(function(error,data) {
          if (error) throw error;
          var ret = data[ncurr[0]]||data;
          cb(ret);
        });
      });
      else poloniex.returnBalances(function(error, data) {
        if (error) throw error;
        var ret = {};
        var currs = currencies;
        currs.forEach((x) => {if (data[x]) ret[x] = data[x]});
        cb(ret);
      });
    },
    getAddress: function(curr, cb, generate) {
      cb = cb || genericCB;
      curr = Array.isArray(curr) ? curr[0] : curr;
      if (generate) poloniex.generateNewAddress(curr, function(error,data) {
        if (error) throw error;
        var ret = data.response;
        cb(ret);
      });
      else poloniex.returnDepositAddresses(function(error,data) {
        if (error) throw error;
        var ret = data[curr];
        cb(ret);
      });
    },
    buy: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Poloniex"], curr, function(pair) {
        amt = debug ? 0 : amt;
        var ncurr = pair[0];
        poloniex.buy(ncurr[1]+"_"+ncurr[0], rate, amt, 1, 0, 0, function(error,data) {
          if (error && !debug && error.indexOf('enough') == -1) throw error;
          if (debug) {
            console.log('Poloniex: buy transaction in debug mode, order not submitted.');
            var ret = error;
          }
          else var ret = data;
          cb(ret);
        });
      });
    },
    sell: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Poloniex"], curr, function(pair) {
        amt = debug ? 0 : amt;
        var ncurr = pair[0];
        poloniex.sell(ncurr[1]+"_"+ncurr[0], rate, amt, 1, 0, 0, function(error,data) {
          if (error && !debug && error.indexOf('enough') == -1) throw error;
          if (debug) {
            console.log('Poloniex: sell transaction in debug mode, order not submitted.');
            var ret = error;
          }
          else var ret = data;
          cb(ret);
        });
      });
    },
    cancel: function(id, cb) {
      cb = cb || genericCB;
      poloniex.cancelOrder(id, function(error,data) {
        if (error && !debug) throw error;
        var ret = debug ? data : data.success;
        cb(ret);
      });
    },
    withdraw: function(curr, amt, id, cb) {
      cb = cb || genericCB;
      check(["Poloniex"], curr, function(pair) {
        var amt = debug ? 0 : amt;
        var ncurr = pair[0];
        poloniex.withdraw(ncurr[0], amt, id, function(error,data) {
          if (error && !debug) throw error;
          var ret = debug ? data : data.response;
          cb(ret);
        });
      });
    }
  },
  "Bittrex": {
    getPrice: function(curr, cb) {
      cb = cb || genericCB;
      check(["Bittrex"], curr, function(pair) {
        var ncurr = pair[0];
        bittrex.getticker({"market": ncurr[1]+'-'+ncurr[0]}, function(data) {
          if (data.message) throw new Error(data.message);
          var ret = [data.result["Ask"], data.result["Bid"], data.result["Last"]];
          cb(ret);
        });
      });
    },
    getBalances: function(curr, cb) {
      cb = cb || genericCB;
      if (curr) check(["Bittrex"], curr, function(pair) {
        var ncurr = pair[0];
        bittrex.getbalances(function(data) {
          if (data.message) throw new Error(data.message);
          var ret = data.result;
          data.result.forEach(function(x) {
            if (x.Currency == ncurr[0]) ret = x.Balance;
          });
          cb(ret);
        });
      });
      else bittrex.getbalances(function(data) {
        if (data.message) throw new Error(data.message);
        var ret = {};
        data.result.forEach(function(x) {ret[x.Currency] = x.Balance});
        cb(ret);
      });
    },
    getAddress: function(curr, cb, generate) {
      cb = cb || genericCB;
      check(["Bittrex"], curr, function(pair) {
        var ncurr = pair[0];
        bittrex.getdepositaddress({currency: ncurr[0]}, function(data) {
          if (data.message) throw new Error(data.message);
          var ret = data.result.Address;
          cb(ret);
        });
      });
    },
    buy: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Bittrex"], curr, function(pair) {
        var ncurr = pair[0];
        var options = {
          market: ncurr[1]+"-"+ncurr[0],
          rate: rate,
          quantity: debug ? 0 : amt
        };
        bittrex.buylimit(options, function(data) {
          if (data.message && !debug) throw new Error(data.message);
          if (debug) {
            console.log('Bittrex: buy transaction is in debug mode, order not submitted');
            var ret = data.message;
          }
          else var ret = data;
          cb(ret);
        });
      });
    },
    sell: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      check(["Bittrex"], curr, function(pair) {
        var ncurr = pair[0];
        var options = {
          market: ncurr[1]+"-"+ncurr[0],
          rate: rate,
          quantity: debug ? 0 : amt
        };
        bittrex.selllimit(options, function(data) {
          if (data.message && !debug) throw new Error(data.message);
          if (debug) {
            console.log('Bittrex: sell transaction is in debug mode, order not submitted');
            var ret = data.message;
          }
          else var ret = data;
          cb(ret);
        });
      });
    },
    cancel: function(id, cb) {
      cb = cb || genericCB;
      bittrex.cancel({uuid: id}, function(data) {
        if (data.message) throw new Error(data.message);
        var ret = data.success||false;
        cb(ret);
      });
    },
    withdraw: function(curr, amt, id, cb) {
      cb = cb || genericCB;
      check("Bittrex", curr, function(pair) {
        var ncurr = pair[0];
        options = {
          currency: ncurr[0],
          quantity: debug ? 0 : amt,
          address: id
        };
        bittrex.withdraw(options, function(data) {
          if (data.message && !debug) throw new Error(data.message);
          if (debug) console.log('Bittrex: withdraws are in debug mode, order not submitted');
          var ret = data;
          cb(ret);
        });
      });
    }
  },
  "GDAX": {
    getPrice: function(curr, cb) {
      cb = cb || genericCB;
      gdax.getProductTicker(curr[0]+'-'+curr[1], function(error, res, data) {
        if (error) throw error;
        var ret = [data.ask, data.bid, data.price];
        cb(ret);
      });
    },
    getBalances: function(curr, cb) {
      cb = cb || genericCB;
      gdax.getAccounts(function(error,res,data) {
        if (error) throw error;
        if (curr) data.forEach(function(x) {
          if (x.currency == curr[0]) var ret = x.balance;
        });
        else {
          var ret = {};
          data.forEach(function(x) {
            if (currencies.indexOf(x.currency) !== -1) ret[x.currency] = x.balance;
          });
        }
        cb(ret);
      });
    },
    getAddress: function(curr, cb) {
      cb = cb || genericCB;
      var ret = info.gdax.accounts;
      if (curr) {
        curr = Array.isArray(curr) ? curr[0] : curr;
        ret = ret[curr];
      }
      cb(ret);
    },
    buy: function(curr, rate, amt, cb) {
      cb = cb || genericCB;
      var options = {
        product_id: curr[0]+'-'+curr[1]
      };
      if (rate) {
        options.size = amt;
        options.price = rate;
      }
      else {
        options.type = "market";
        options.funds = amt;
      }
      gdax.buy(options, function(error,res,data) {
        if (error && !debug) throw error;
        if (debug) {
          console.log('GDAX: buy transaction is in debug mode, order not submitted');
          var ret = [error,data];
        }
        else var ret = data;
        cb(ret);
      });
    },
    sell: function(curr, amt, cb) {
      cb = cb || genericCB;
      var options = {
        product_id: curr[0]+'-'+curr[1]
      };
      if (rate) {
        options.size = amt;
        options.price = rate;
      }
      else {
        options.type = "market";
        options.funds = amt;
      }
      gdax.sell(options, function(error,res,data) {
        if (error && !debug) throw error;
        if (debug) {
          console.log('GDAX: sell transaction in debug mode, order not submitted.');
          var ret = [error,data];
        }
        else var ret = data;
        cb(ret);
      });
    },
    cancel: function(cb) {
      cb = cb || genericCB;
      gdax.cancelAllOrders(function(error,res,data) {
        if (error && !debug) throw error;
        var ret = data;
        cb(ret);
      });
    },
    withdraw: function(curr, amt, id, cb) {
      cb = cb || genericCB;
      var options = {
        currency: curr[0]||curr,
        amount: debug ? 0 : amt,
        crypto_address: id
      };
      gdax.withdraw(options, function(error,res,data) {
        if (error && !debug) throw error;
        if (debug) console.log('GDAX: withdraws are in debug mode, order not filed.');
        var ret = data;
        cb(ret);
      });
    }
  },
  "Coinbase": {
    getPrice: function(curr, cb) {
      cb = cb || genericCB;
      coinbase.getBuyPrice({currencyPair: curr[0]+'-USD'}, function(error,data) {
        if (error) throw error;
        coinbase.getSellPrice({currencyPair: curr[0]+'-USD'}, function(error1,data1) {
          if (error1) throw error1;
          coinbase.getSpotPrice({currencyPair: curr[0]+'-USD'}, function(error2,data2) {
            if (error2) throw error2;
            var ret = [data.data.amount,data1.data.amount,data2.data.amount];
            if (curr[1] !== "USD") {
              coinbase.getExchangeRates({}, function(error3,data3) {
                if (error3) throw error3;
                var div = data3.data.rates[curr[1]];
                ret = ret.map(function(x) {
                  return (x*div).toFixed(6);
                });
                cb(ret);
              });
            }
            else cb(ret);
          });
        });
      });
    },
    getBalances: function(curr, cb) {
      cb = cb || genericCB;
      coinbase.getAccounts({}, function(error,acct) {
        if (error) throw error;
        var ret = acct;
        if (curr) acct.forEach(function(x) {
          if (x.currency == curr[0]) ret = x.balance.amount;
        });
        else {
          ret = {};
          acct.forEach((x) => {ret[x.balance.currency] = x.balance.amount});
        }
        cb(ret);
      });
    },
    getAddress: function(curr, cb, generate) {
      cb = cb || genericCB;
      curr = Array.isArray(curr) ? curr[0] : curr;
      coinbase.getAccounts({}, function(error,acct) {
        if (error) throw error;
        if (curr) {
          acct.forEach(function(x) {
            if (x.currency == curr) {
              generate ? x.createAddress({}, function(error, data) {
                if (error) throw error;
                var ret = data.address || data;
                cb(ret);
              }) : x.getAddresses({}, function(error, data) {
                if (error) throw error;
                var ret = Array.isArray(data) ? data[0] : data;
				if (ret) ret = Array.isArray(ret) ? ret[0].address : ret.address;
                cb(ret);
              });
            }
          });
        }
        else {
          var ret = [];
          acct.forEach((x) => {ret.push({curr: x.balance.currency, account_id: x.id});});
          cb(ret);
        }
      });
    },
    buy: function(curr, amt, cb, commit) {
      cb = cb || genericCB;
      curr = Array.isArray(curr) ? curr[0] : curr;
      coinbase.getAccounts({}, function(error,acct) {
        if (error) throw error;
        var options = {
          amount: amt,
          currency: curr,
        };
        if (debug) options.quote = true;
        else options.commit = commit||false;
        acct.forEach(function(x) {
          if (x.type == "fiat") {
            x.buy(options, function(error,data) {
              if (error) throw error;
              var ret = data;
              cb(ret);
              return;
            });
          }
        });
      });
    },
    sell: function(curr, rate, amt, cb, commit) {
      cb = cb || genericCB;
      curr = Array.isArray(curr) ? curr[0] : curr;
      coinbase.getAccounts({}, function(error,acct) {
        if (error) throw error;
        var options = {
          amount: amt,
          currency: curr,
        };
        if (debug) options.quote = true;
        else options.commit = commit||false;
        acct.forEach(function(x) {
          if (x.currency == curr) {
            x.sell(options, function(error,data) {
              if (error) throw error;
              var ret = data;
              cb(ret);
              return;
            });
          }
        });
      });
    },
    cancel: function(id, cb) {
      console.log('This doesn\'t really exist :|');
    },
    withdraw: function(curr, amt, id, cb) {
      cb = cb || genericCB;
	  var ncurr = Array.isArray(curr) ? curr[0] : curr;
      coinbase.getAccounts({}, function(error,data) {
        if (error) throw error;
        data.forEach(function(x) {
          if (x.currency == ncurr) {
            var options = {
              to: id,
              amount: debug ? 0 : amt,
              currency: ncurr
            };
            x.sendMoney(options, function(error,data) {
              if (error && !debug) throw error;
              var ret = data || error;
              cb(ret);
              return;
            });
          }
        });
      });
    }
  },
//  "Bitfinex": {
//    getPrice: function(curr, cb) {
//      cb = cb || genericCB;
//      bitfinex.ticker(curr[0]+curr[1], function(error, data) {
//        if (error) throw error;
//        var ret = [data.ask, data.bid, data.last_price];
//        cb(ret);
//      });
//    },
//    getBalances: function(curr, cb) {
//      cb = cb || genericCB;
//      bitfinex.wallet_balances(function(error, data) {
//        if (error) throw error;
//        if (curr) data.forEach(function(x) {
//          if (x.currency == curr[0]) var ret = x;
//        });
//        else {
//          var ret = {};
//          data.forEach(function(x) {
//            if (currencies.indexOf(x.currency) !== -1) ret[x.currency] = x;
//          });
//        }
//        cb(ret);
//      });
//    },
//    getAddress: function(curr, cb, generate) {
//      cb = cb || genericCB;
//      generate = generate ? 1 : 0;
//      curr = Array.isArray(curr) ? curr[0] : curr
//      var options = [
//        curr,
//        depMethods["Bitfinex"][curr],
//        "deposit",
//        generate
//      ];
//      bitfinex.new_deposit(...options, function(error, data) {
////        if (error) throw error;
////        var ret = data.address;
//		  var ret = error ? null : data.address;
//        cb(ret);
//      });
//    },
//    buy: function(curr, rate, amt, cb) {
//      cb = cb || genericCB;
//      var options = [
//        curr[0]+curr[1],
//        debug ? 0 : amt,
//        1,
//        "bitfinex",
//        "buy",
//        "exchange market",
//        false,
//        false,
//      ];
//      bitfinex.new_order(...options, function(error, data) {
//        if (error && !debug) throw error;
//        if (debug) {
//          console.log('Bitfinex: buy transactions in debug mode, order not filled.');
//          var ret = error;
//        }
//        else var ret = data;
//        cb(ret);
//      });
//    },
//    sell: function(curr, rate, amt, cb) {
//      cb = cb || genericCB;
//      var options = [
//        curr[0]+curr[1],
//        debug ? 0 : amt,
//        1,
//        "bitfinex",
//        "sell",
//        "exchange market",
//        false,
//        false,
//      ];
//      bitfinex.new_order(...options, function(error, data) {
//        if (error && !debug) throw error;
//        if (debug) console.log('Bitfinex: sell transactions in debug mode, order not filled.');
//        var ret = data;
//        cb(ret);
//      });
//    },
//    cancel: function(cb) {
//      cb = cb || genericCB;
//      bitfinex.cancel_all_orders(function(error, data) {
//        if (error && !debug) throw error;
//        var ret = debug ? data : data.is_cancelled;
//        cb(ret);
//      });
//    },
//    withdraw: function(curr, amt, id, cb) {
//      cb = cb || genericCB;
//      var options = [
//        depMethods["Bitfinex"][curr[0]],
//        "trading",
//        debug ? 0 : amt,
//        id
//      ];
//      bitfinex(...options, function(error, data) {
//        if (error && !debug) throw error;
//        if (debug) console.log('Bitfinex: withdraws are in debug mode, order not filed.');
//        var ret = debug ? data : data.withdawal_id;
//        cb(ret);
//      });
//    }
//  },
};

function genericCB(thing) {console.log(thing);}

function comp(coins, verbose) {
  var amin, bmax, spread, s;
  if (verbose) console.log('\nPrice/Spread Comparison\n_______________________\n');
  for (var coin in coins) {
	s = s || coin;
    amin = exchanges[0];
    bmax = exchanges[0];
    var ab = coins[coin];
    for (var x in exchanges) {
      amin = ab[exchanges[x]][0] < ab[amin][0] ? exchanges[x] : amin;
      bmax = ab[exchanges[x]][1] > ab[bmax][1] ? exchanges[x] : bmax;
    }
    spread = 100*(ab[bmax][1]-ab[amin][0])/ab[amin][0];
    coins[coin]["spread"] = [spread.toFixed(2),amin,bmax];
	console.log(coin+':');
    if (verbose) console.log(coins[coin]);
    console.log(spread.toFixed(2)+'%\n');
    s = spread > coins[s]["spread"][0] ? coin : s;
  }
  spread = coins[s]["spread"];
  console.log('The best spread is '+s+' at '+spread[0]+'%');
  var base = coins["BTC"] ? "USD" : "BTC";
  if (spread[0] > threshhold) bArbItrage(spread[1],spread[2],[s,base],coins);
  else console.log('\nDo not pass go, do not collect $200.\n');
}

function check(xcs, curr, callback) {
  xcs = xcs||exchanges;
  if (Array.isArray(curr)) curr[1] = curr[1]||"USD";
  else curr = [curr,"USD"];
  var currs = {
    "Kraken": {"BTC": "XBT"},
    "Poloniex": {"USD": "USDT"},
    "Bittrex": {"USD": "USDT"},
    "GDAX": {},
    "Coinbase": {},
    "Bitfinex": {},
  };
  var currPairs = [];
  xcs.forEach(function(element) {
    var swap = currs[element];
    currPairs.push([swap[curr[0]]||curr[0],swap[curr[1]]||curr[1]]);
  });
  callback(currPairs);
}

function bArbItrage(xclow, xchigh, curr) {
  if (debug) {
    console.log('_______________________________________');
    console.log('Buy '+curr+' from '+xclow);
    console.log('Transfer '+curr+' from '+xclow+' to '+xchigh);
    console.log('Sell '+curr+' on '+xchigh);
    console.log('_______________________________________\n');
  }
  else {
  }
}

function onePrices(curr, callback) {
	callback = callback || genericCB;
	bArb.Coinbase.getPrice(curr, function(p4) {
		bArb.GDAX.getPrice(curr, function(p3) {
			bArb.Bittrex.getPrice(curr, function(p2) {
				bArb.Poloniex.getPrice(curr, function(p1) {
					bArb.Kraken.getPrice(curr, function(p) {
						callback({
							"Kraken": p,
							"Poloniex": p1,
							"Bittrex": p2,
							"GDAX": p3,
							"Coinbase": p4,
						});
					});
				});
			});
		});
	});
}

function BTCPrices(callback) {
	callback = callback || comp;
	onePrices(["LTC","BTC"], function(val2) {
		onePrices(["ETH","BTC"], function(val1) {
			var coins = {
				"ETH": val1,
				"LTC": val2
			};
			callback(coins, true);
		});
	});
}

function USDPrices(callback) {
	callback = callback || comp;
	onePrices(["LTC","BTC"], function(val2) {
		onePrices(["ETH", "USD"], function(val1) {
			onePrices(["BTC", "USD"], function(val) {
				for (var ex in val2) {
					val2[ex] = val2[ex].map(function(v) {
						return v*val[ex][2];
					});
				}
				var coins = {
					"BTC": val,
					"ETH": val1,
					"LTC": val2
				};
				callback(coins, true);
			});
		});
	});
}

function twoBalances(xcs, curr, callback) {
  bArb[xcs[0]].getBalances(curr, function(data) {
    bArb[xcs[1]].getBalances(curr, function(data1) {
      callback([data,data1]);
    });
  });
}

function allBalances(callback) {
  callback = callback || genericCB;
  bArb.Kraken.getBalances(null,function(thing) {
	  bArb.Poloniex.getBalances(null,function(thing1) {
		  bArb.Bittrex.getBalances(null,function(thing2) {
			  bArb.GDAX.getBalances(null,function(thing3) {
				  bArb.Coinbase.getBalances(null,function(thing4) {
					  callback({
						  "Kraken": thing,
						  "Poloniex": thing1,
						  "Bittrex": thing2,
						  "GDAX": thing3,
						  "Coinbase": thing4
					  });
				  });
			  });
		  });
	  });
  });
}

function oneAddresses(curr, callback) {
	callback = callback || function(obj) {console.log('\n' + curr + ' Addresses:\n' + obj);};
	bArb.Coinbase.getAddress(curr, function(p4) {
		bArb.GDAX.getAddress(curr, function(p3) {
			bArb.Bittrex.getAddress(curr, function(p2) {
				bArb.Poloniex.getAddress(curr, function(p1) {
					bArb.Kraken.getAddress(curr, function(p) {
						callback({
							"Kraken": p,
							"Poloniex": p1,
							"Bittrex": p2,
							"GDAX": p3,
							"Coinbase": p4
						});
					});
				});
			});
		});
	});
}

function transferCurr(curr, amt ,xcs) {
	if (!curr || !amt || !Array.isArray(xcs)) {
		console.log('not enough info');
		return;
	}
	bArb[xcs[1]].getAddress(curr, function(add) {
		console.log(add);
		bArb[xcs[0]].withdraw(curr,amt,add);
	});
}

function oneValue(ex, callback) {
  callback = callback || function(total) {};
  bArb[ex].getBalances(null, function(bal) {
	  var toCheck = [];
	  for (var coin in bal) {
		  if (parseFloat(bal[coin]) > 0.01) {
			  if (coin == "BTC" || coin == "XBT") var btc = true;
			  else if (!(coin == "BCH" || coin == "USD" || coin == "USDT")) toCheck.push(coin);
		  }
	  }
	  var len = toCheck.length;
	  if (len > 0 || btc) spotPrice(ex, bal, toCheck, len, null, callback);
	  else callback();
  });
}

function spotPrice(ex, bal, toCheck, iter, ob, cb) {
	if (!bal || !toCheck) {
		console.log('oh no');
		return;
	}
	if (!ob) {
		console.log('\n' + ex);
		ob = {};
	}
	if (iter > 0) {
		iter--;
		var cur = [toCheck[iter],"BTC"];
		bArb[ex].getPrice(cur, function(prices) {
			var nTotal = parseFloat(bal[cur[0]])*parseFloat(prices[2]);
			ob[cur[0]] = nTotal;
			spotPrice(ex, bal, toCheck, iter, ob, cb);
		});
	}
	else {
		bArb[ex].getPrice(["BTC","USD"], function(prices) {
			var total = 0;
			var btcprice = parseFloat(prices[2]);
			for (var curr in ob) {
				ob[curr] = ob[curr]*btcprice;
				total += ob[curr];
				console.log(curr + ': $' + ob[curr].toFixed(2));
			}
			if (bal["BTC"] || bal["XBT"]) { 
				var btcbal = parseFloat(bal["BTC"]) || parseFloat(bal["XBT"]);
				if (btcbal > 0) {
					ob["BTC"] = btcbal*btcprice;
					total += ob["BTC"]
					console.log('BTC: $' + ob["BTC"].toFixed(2));
				}
			}
			console.log('Total: $' + total.toFixed(2) + '\n');
			cb(total);
		});
	}
}

function allValue(callback) {
	callback = callback || genericCB;
	oneValue("Kraken", function(kTotal) {
		kTotal = kTotal || 0;
		oneValue("Poloniex", function(pTotal) {
			pTotal = pTotal || 0;
			oneValue("Bittrex", function(tTotal) {
				tTotal = tTotal || 0;
				oneValue("GDAX", function(gTotal) {
					gTotal = gTotal || 0;
					oneValue("Coinbase", function(cTotal) {
						cTotal = cTotal || 0;
						var all = kTotal + pTotal + tTotal + gTotal + cTotal;
						all = 'Total holdings: $' + all.toFixed(2);
						callback(all);
					});
				});
			});
		});
	});
}
