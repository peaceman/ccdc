const config = require('config');
const cheerio = require('cheerio');
const { isEqual } = require('lodash');
const fs = require('fs').promises;

const log = require('./log');
const { request } = require('./http-client');

const OBJECT_ID_REGEX = /data-id\s*=\s*"(\d+)"/;

async function scrapeObjectIds({url, output}) {
    log.info('start scraping object ids', {url, output});

    // create the file if it does not exist or fail otherwise
    const outputFileHandle = await fs.open(output, 'wx')

    const storeObjectId = async objectId => {
        await outputFileHandle.appendFile(`${objectId.trim()}\n`);
    };

    let apiUrl = await fetchInitialApiUrl(url);

    while (true) {
        log.info('fetching data', {url: apiUrl});

        const data = await request(apiUrl, {responseType: 'json', resolveBodyOnly: true});
        if ((data.objects || []).length === 0 || !Boolean(data.next_page)) {
            log.info('reached the end');
            break;
        }

        const objectIds = data.objects
            .map(v => {
                const matches = v.match(OBJECT_ID_REGEX);

                return matches === null
                    ? undefined
                    : matches[1];
            })
            .filter(v => Boolean(v));

        log.info('found object ids', {amount: objectIds.length});

        for (const objectId of objectIds) {
            await storeObjectId(objectId);
        }

        apiUrl = data.next_page;
    }

    await outputFileHandle.close();
}

async function fetchInitialApiUrl(url) {
    log.info('fetch initial api url', {url});

    const response = await request(url);
    const $ = cheerio.load(response.body);

    const scriptElements = $('script[type="text/x-config"]');
    const scriptTexts = [];

    scriptElements.each(function () {
        scriptTexts.push($(this).html().trim());
    });

    const apiUrlData = scriptTexts
        .map(text => {
            try {
                return JSON.parse(text);
            } catch {
                return undefined;
            }
        })
        .filter(v => v !== undefined)
        .find(v => isEqual(Object.getOwnPropertyNames(v), ['apiUrl']));

    return (apiUrlData || {}).apiUrl;
}

module.exports = scrapeObjectIds;
