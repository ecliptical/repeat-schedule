const rs = require('.');

for (let instant of rs.generate(
    {
        times: ["17:30"],
        period: 'year',
        months: [11],
        days: [{ type: 'Thursday', value: 4 }],
        count: 10,
        tz: 'America/New_York',
    }
)) {
    console.log(instant.toISOString(true));
}
