const bunyan = require('bunyan');

const log = bunyan.createLogger({name: 'cdcc'});

module.exports = log;
