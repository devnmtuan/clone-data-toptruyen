const AWS = require('aws-sdk')
AWS.config.update({
    accessKeyId: `3OX1JRIWPU161SO7IW3P`,
    secretAccessKey: `QHh9ArtZrsKlhDQYORhXj6CxZey2k37MPnDu5gDr`,
    region: 'hn', 
    endpoint: 'https://hn.ss.bfcplatform.vn',
    apiVersions: {
      s3: '2006-03-01'
    },
    logger: process.stdout
})
const s3 = new AWS.S3()
module.exports = s3;