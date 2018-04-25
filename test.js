const moment = require('moment');
const rs = require('.');

const now = moment();

let count = 0;
for (let instant of rs.generate(
    {
        times: ["17:30"],
        period: 'year',
        months: [11],
        days: [{ type: 'Thursday', value: 4 }],
    },
    now
)) {
    console.log(instant.toISOString(true));
    if (++count >= 10) {
        break;
    }
}
