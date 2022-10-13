const schedule = require("node-schedule")
// const nettruyen = require('../nettruyen');
const toptruyen = require('./toptruyen');

schedule.scheduleJob('0 */1 * * * *', async function () {
    await toptruyen();
});

