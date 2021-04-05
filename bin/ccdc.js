#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

yargs(hideBin(process.argv))
    .command({
        command: 'object-ids <url>',
        desc: 'scrape object ids from the given listing url',
        builder: yargs => {
            yargs
                .positional('url', {
                    describe: 'listing url to fetch object ids from',
                    type: 'string',
                })
                .option('output', {
                    alias: 'o',
                    describe: 'target file path',
                    type: 'string',
                    default: 'object-ids.txt',
                })
        },
        handler: require('../src/scrape-object-ids'),
    })
    .command({
        command: 'objects <baseUrl>',
        desc: 'scrape object data',
        builder: yargs => {
            yargs
                .positional('baseUrl', {
                    describe: 'base url that will be used to generate the objects full url',
                    type: 'string',
                })
                .option('input', {
                    alias: 'i',
                    describe: 'object id source path',
                    type: 'string',
                    default: 'object-ids.txt',
                })
        },
        handler: require('../src/scrape-objects'),
    })
    .demandCommand()
    .help()
    .argv
