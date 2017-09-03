# bArb
Crypto API handling and automated trading bot

### Important Info
bArb was created using the official node API wrappers for each of the following exchanges:
1. [Poloniex](https://github.com/dutu/poloniex-api-node)
2. [Kraken](https://github.com/nothingisdead/npm-kraken-api)
3. [Coinbase](https://github.com/coinbase/coinbase-node)
4. [GDAX](https://www.npmjs.com/package/gdax)
5. [Bittrex](https://github.com/n0mad01/node.bittrex.api)
6. [Bitfinex](https://github.com/bitfinexcom/bitfinex-api-node)

Coinbase is not technically an exchange, so I would suggest not using that if you're planning on making a trading bot, because they may freeze your account for frequent withdrawals to other exchanges. Bitfinex recently announced they will no longer be supporting US customers, so I have commented out its API handling and functions. If you're outside the US, feel free to add those back in.

You need to add your API keys and secrets to the file `secrets.js` for private methods like buying and selling.

### Methods
As of now, you can call bArb (object) and use functions like this:

- Get prices from Poloniex for ETH/BTC

    `bArb.Poloniex.getPrice(["ETH","BTC], callback);`
    
    or, more generally,
    
    `bArb[<exchange>][<function>](...<arguments>, <callback>);`

And you can use the preloaded functions that organize and manipulate data returned by the APIs

- Print the value of all your balances to the console

    `allValue();`

### Other Notes
- bArb handles converting any currencies to the correct ticker designations using the check( ) function (ex. Kraken uses "XBT" instead of "BTC")

- Also, for most functions, if no callback is passed, it will default to just printing values to the console

- I had to customize some of the API wrappers. I think it may be because I was trying to use multiple inside of custom functions, which confused the `this` designation that most of them seem to like to use for whatever reason. I'll try to add the edits I made, but this is a bit of an inconvenience to update since it will make automatic npm updates from those official wrappers useless. If anyone has any insight on how to fix that, I would very much appreciate some help.

### Licenses
I wasn't really sure what kind of license to assign to this. Basically, anyone can use it at their own risk. Good luck

### Crypto
Lastly, just wanted to express how awesome getting involved with crypto has been. If anyone reading this isn't familiar with crypto, please look into Bitcoin and Ether and the whole crypto space. Reddit is a good place to get started, but there's also a lot of information available through blogs and news organizations as crypto starts to gain more adoption. I believe it will become integrated in everything we do one day, so if that hasn't already happened by the time you're reading this, you're still in time to learn and get involved. 

For those of you that came here looking for help with their own project, I hope this helps with whatever it is that you're trying to do.

Bitcoin address|Ether address|Litecoin address
---------------|---------------|---------------
`13TQ25goTgskCsKWGGTkB15rfG4J37PjMe`|`0xa90a92f3f9bcb2764c90b06ebf80a0bd8c924e0d`|`LYYkueBJDFaVMgBUCrHeHoGwF5SU4BcLco`
