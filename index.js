const _ = require('lodash');
const moment = require('moment-timezone');

function generateTimes(instant, times, start) {
    if (_.isEmpty(times)) {
        return instant.isSameOrAfter(start) && [ instant ] || [ ];
    }

    const moments = [ ];
    _.each(times, time => {
        const parts = _.split(time, ':', 3);
        const value = moment(instant).set({
            hour: _.toInteger(parts[0]),
            minute: _.toInteger(_.get(parts, '[1]', 0)),
            second: _.toInteger(_.get(parts, '[2]', 0)),
            millisecond: 0,
        });

        if (value.isSameOrAfter(start)) {
            moments.push(value);
        }
    });

    return moments;
}

function generateDays(instant, period, days, times, start) {
    if (_.isEmpty(days)) {
        return generateTimes(instant, times, start);
    }

    const end = moment(instant).startOf(period).add(1, period);
    const moments = _.flatMap(days, day => {
        if (_.isInteger(day)) {
            day = { type: 'number', value: day };
        }

        if (_.isObject(day)) {
            if (day.type === 'number') {
                const date = moment(instant);
                switch (period) {
                    case 'week':
                        const dayOfWeek = day.value === 0 ? 7 : day.value;
                        date.day(_.isString(dayOfWeek) ? dayOfWeek : dayOfWeek - 1);
                        break;
                    case 'month':
                        const dayOfMonth = day.value === 0 ? date.daysInMonth() : day.value;
                        date.date(dayOfMonth);
                        break;
                    default:
                        date.dayOfYear(day.value);
                }

                return generateTimes(date, times, start);
            }

            let count = 0;
            const date = moment(instant);
            switch (period) {
                case 'week':
                    date.day(0);
                    break;
                case 'month':
                    date.date(1);
                    break;
                default:
                    date.dayOfYear(1);
            }

            let lastValidDate = null;
            while (date.isBefore(end)) {
                let valid = false;
                if (day.type === 'weekday') {
                    valid = date.day() > 0 && date.day() < 6;
                } else if (day.type === 'weekendDay' || day.type === 'weekend_day') {
                    valid = date.day() <= 0 || date.day() >= 6;
                } else {
                    valid = day.type === date.day() + 1 || day.type === date.format('dddd');
                }

                if (valid) {
                    if (++count === day.value) {
                        return generateTimes(date, times, start);
                    }

                    lastValidDate = moment(date);
                }

                date.add(1, 'day');
            }

            if (day.value === 0 && !_.isNull(lastValidDate)) {
                return generateTimes(lastValidDate, times, start);
            }
        }

        return [ ];
    });

    return moments;
}

function* generate(schedule, predicate) {
    const start = moment.parseZone(schedule.start);
    if (schedule.tz) {
        start.tz(schedule.tz);
    }

    const end = schedule.end && moment(schedule.end) || moment.invalid();
    const maxCount = +schedule.count;

    const times = schedule.times || [ ];
    const days = schedule.days || [ ];
    const weeks = schedule.weeks || [ ];
    const months = schedule.months || [ ];
    const years = _.sortBy(schedule.years || [ ]);
    const test = _.isFunction(predicate) ? predicate : instant => true;

    const period = schedule.period || 'day';
    let next = start;
    let count = 0;

    for (let i = 1; i <= 36525; i++) {
        let moments = [ ];

        if (period === 'day') {
            moments = generateTimes(next, times, start);
        } else if (_.isEmpty(months)) {
            if (_.isEmpty(weeks)) {
                moments = generateDays(next, period, days, times, start);
            } else {
                moments = _.flatMap(weeks, week => {
                    const instant = moment(next).week(week === 0 ? next.weeksInYear() : week);
                    return generateDays(instant, 'week', days, times, start);
                });
            }
        } else {
            moments = _.flatMap(months, month => {
                const value = month === 0 ? 12 : month;
                const instant = moment(next).month(_.isString(value) ? value : value - 1);
                return generateDays(instant, 'month', days, times, start);
            });
        }

        const results = _.sortBy(moments);
        for (let result of results) {
            if (end.isValid() && result.isAfter(end)) {
                return;
            }

            if (_.isEmpty(years) || _.includes(years, result.year())) {
                if (test(result)) {
                    yield result;
                }

                if (maxCount > 0 && ++count >= maxCount) {
                    return;
                }
            }
        }

        next = moment(start).add(i * (schedule.frequency || 1), period);
    }
}

module.exports = { generate };
