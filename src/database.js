const config = require('config');
const sqlite3 = require('sqlite3');
const fs = require('fs').promises;

const log = require('./log');

async function openDatabase() {
    const filePath = config.get('db.path');

    // check if the sqlite database file already exists
    // if it doesn't create it and create tables
    const shouldCreateTables = !await fileExists(filePath);

    if (shouldCreateTables) {
        log.info('database file does not exist; creating', {filePath});
    }

    const db = await new Promise((resolve, reject) => {
        let innerResolve;
        let innerReject;
        const innerPromise = new Promise((resolve, reject) => {
            innerResolve = resolve;
            innerReject = reject;
        });

        const db = new sqlite3.Database(config.get('db.path'), error => {
            error !== null
                ? innerReject(error)
                : innerResolve()
        });

        innerPromise
            .then(() => resolve(db))
            .catch(e => reject(e));
    });

    if (shouldCreateTables) {
        await createTables(db);
    }

    return db;
}

function createTables(db) {
    const queries = [
        `
            create table objects
            (
                id           text primary key not null,
                url          text not null,
                name         text not null,
                contact_name text not null,
                region       text not null,
                latitude     number null,
                longitude    number null
            );
        `,
        `
            create table object_phone_numbers
            (
                object_id text not null,
                number text not null,
                foreign key(object_id) references objects(id) on delete cascade on update cascade
            );
        `,
    ];

    const execQuery = query => new Promise((resolve, reject) => {
        db.run(query, function (error) {
            error !== null
                ? reject(error)
                : resolve();
        });
    });

    return queries.reduce(
        (prev, curr) => prev.then(() => execQuery(curr)),
        Promise.resolve()
    );
}

async function fileExists(filePath) {
    try {
        const stat = await fs.stat(filePath);

        return stat.isFile();
    } catch (e) {
        if (e.code === 'ENOENT') {
            return false;
        }

        throw e;
    }
}

exports.openDatabase = openDatabase;
