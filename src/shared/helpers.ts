

import * as http from 'http';

const checkLiveness = (port: number) => {
    return new Promise<boolean>((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/settings`, (response: any) => {
            let data = '';
            // A chunk of data has been recieved.
            response.on('data', (chunk: any) => {
                data += chunk;
            });
            // The whole response has been received. Print out the result.
            response.on('end', () => {
                if (response.statusCode === 200) {
                    resolve(true);
                }
                return resolve(false);
            });
        }).on("error", (err: any) => {
            if(err.message.indexOf('ECONNREFUSED') === -1) {
                console.error("Error: " + err.message);
            }
            resolve(false);
        });
    });
};

const  killProcessByPort = async (port: number) => {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(`fuser -n tcp -k ${port}`, (error: any, stdout: any, stderr: any,) => {
            resolve(stdout ? stdout : stderr);
        });
    });
};

export { checkLiveness, killProcessByPort };