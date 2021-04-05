const got = require('got');
const config = require('config');
const { RateLimiter, TokenBucket } = require('limiter');

const client = got.extend({
    headers: {
        'user-agent': config.get('http.user_agent'),
    },
});

const rateLimit = (() => {
    const limit = config.get('http.request_limit_per_min');
    const limiter = new TokenBucket(limit, limit, 'minute');

    return fn => {
        return new Promise(resolve => limiter.removeTokens(1, resolve))
            .then(fn);
    };
})();

exports.client = client;
exports.request = (...args) => rateLimit(() => client(...args));
