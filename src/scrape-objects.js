const fs = require('fs');
const config = require('config');
const cheerio = require('cheerio');

const log = require('./log');
const { request } = require('./http-client');
const { lineStream, chunkAsyncIter } = require('./utils');
const scrapeObjectIds = require('./scrape-object-ids');
const { openDatabase } = require('./database');

async function handler(args) {
    const db = await openDatabase();

    const objectIdsFileStream = fs.createReadStream(args.input);
    const objectIdsStream = objectIdsFileStream.pipe(lineStream());
    const chunkedObjectIdsIter = chunkAsyncIter(objectIdsStream, config.get('objects.chunk_size'));

    for await (const objectIds of chunkedObjectIdsIter) {
        const promises = objectIds
            .map(objectId => [objectId, `${args.baseUrl}/${objectId}/`])
            .map(([objectId, objectUrl]) => objectIsStored(db, objectId)
                .then(checkResult => checkResult ? Promise.resolve() : scrapeObject(objectId, objectUrl)))
            .map(objectPromise => objectPromise.then(object => {
                if (object === undefined) return;

                storeObject(db, object);
            }));

        await Promise.all(promises);
    }
}

async function scrapeObject(objectId, objectUrl) {
    log.info('scraping object', {url: objectUrl});
    const response = await request(objectUrl);
    log.info('got response', {objectUrl, duration: response.timings.phases.total});

    const $ = cheerio.load(response.body);

    const object = {
        id: objectId,
        url: objectUrl,
        name: $('div.expose__headline').text(),
        region: extractRegion($),
        coords: extractCoords($),
        contact: {
            name: $('div.expose-section__content p.h3').text(),
            phoneNumbers: extractPhoneNumbers($),
        },
    };

    if (object.contact.phoneNumbers.length === 0) {
        log.info(`skip storing object; couldn't detect any phone numbers`);
        return undefined;
    } else {
        return object;
    }
}

function extractRegion($) {
    let breadcrumbs = [];
    $('.expose-breadcrumbs li > a > span').each(function () {
        breadcrumbs.push($(this).text());
    });

    return breadcrumbs.map(v => v.trim()).join(' / ');
}

function extractCoords($) {
    let json = $('div[data-module="exposeLocation"] script[type="text/x-config"]')
        ?.[0]
        ?.children
        ?.[0]
        ?.data
        ?? '';

    json = json.trim();

    if (json.length === 0) {
        return undefined;
    }

    try {
        const data = JSON.parse(json);

        const coords = {
            latitude: data?.listing?.lat,
            longitude: data?.listing?.lng,
        };

        return (coords.latitude === undefined || coords.longitude === undefined)
                ? undefined
                : coords;
    } catch (e) {
        log.error('failed to parse coords json', {e});
        return undefined;
    }
}

function extractPhoneNumbers($) {
    let phoneNumbers = [];
    $('div.phone-numbers li').each(function () {
        phoneNumbers.push($(this).text());
    });

    return phoneNumbers.map(n => n.trim());
}

function objectIsStored(db, objectId) {
    return new Promise((resolve, reject) => {
        db.get('select 1 from objects where id = ?', [objectId], function (err, row) {
            if (err !== null) {
                reject(err);
            } else {
                resolve(row !== undefined);
            }
        });
    });
}

function storeObject(db, object) {
    db.serialize(() => {
        db.run(
            `insert into objects (
                id,
                url,
                name,
                contact_name,
                region,
                latitude,
                longitude
            ) values (
                ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                object.id,
                object.url,
                object.name,
                object.contact.name,
                object.region,
                object.coords.latitude,
                object.coords.longitude,
            ]
        );

        for (const phoneNumber of object.contact.phoneNumbers) {
            db.run(
                'insert into object_phone_numbers (object_id, number) values (?, ?)',
                [object.id, phoneNumber]
            );
        }
    });
}

module.exports = handler;
