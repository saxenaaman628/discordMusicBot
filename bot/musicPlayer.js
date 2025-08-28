const https = require('https');
const { PassThrough } = require('stream');

function createStream(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode === 200) {
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            } else {
                reject(new Error(`Failed to fetch stream: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

module.exports = { createStream };
