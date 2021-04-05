const { Transform } = require('stream');

function lineStream() {
    let remaining = '';

    return new Transform({
        writableObjectMode: false,
        readableObjectMode: true,
        transform(chunk, encoding, callback) {
            try {
                const lines = (remaining + chunk).split(/\r?\n/g);
                remaining = lines.pop();
                for (const line of lines) {
                    this.push(line);
                }
                callback();
            } catch (err) {
                callback(err);
            }
        },
        flush(callback) {
            if (remaining !== '') {
                this.push(remaining);
            }
            callback();
        }
    });
}

async function* chunkAsyncIter(source, chunkSize) {
    const chunk = [];

    for await (const item of source) {
        chunk.push(item);

        if (chunk.length === chunkSize) {
            yield chunk;

            // clear the chunk
            chunk.splice(0);
        }
    }
}

exports.lineStream = lineStream;
exports.chunkAsyncIter = chunkAsyncIter;
