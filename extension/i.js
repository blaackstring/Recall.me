import fs from 'fs';

const file=fs.readFileSync("dist.pem");
console.log(file.toString('base64'));