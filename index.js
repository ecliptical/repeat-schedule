const _ = require('lodash');
const moment = require('moment');

function generateTimes(instant, times, test) {
    if (_.isEmpty(times)) {
        return test(instant) && [ instant ] || [ ];
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

        if (test(value)) {
            moments.push(value);
        }
    });

    return moments;
}

function generateDays(instant, period, days, times, test) {
    if (_.isEmpty(days)) {
        return generateTimes(instant, times, test);
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

                return generateTimes(date, times, test);
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
                        return generateTimes(date, times, test);
                    }

                    lastValidDate = moment(date);
                }

                date.add(1, 'day');
            }

            if (day.value === 0 && !_.isNull(lastValidDate)) {
                return generateTimes(lastValidDate, times, test);
            }
        }

        return [ ];
    });

    return moments;
}

function* generate(schedule, start, predicate) {
    const times = schedule.times || [ ];
    const days = schedule.days || [ ];
    const weeks = schedule.weeks || [ ];
    const months = schedule.months || [ ];
    const years = _.sortBy(schedule.years || [ ]);
    const test = instant => instant.isSameOrAfter(start) && (!_.isFunction(predicate) || predicate(instant));

    const period = schedule.period || 'day';
    let next = start;

    for (let i = 1; i <= 36525; i++) {
        let moments = [ ];

        if (period === 'day') {
            moments = generateTimes(next, times, test);
        } else if (_.isEmpty(months)) {
            if (_.isEmpty(weeks)) {
                moments = generateDays(next, period, days, times, test);
            } else {
                moments = _.flatMap(weeks, week => {
                    const instant = moment(next).week(week === 0 ? next.weeksInYear() : week);
                    return generateDays(instant, 'week', days, times, test);
                });
            }
        } else {
            moments = _.flatMap(months, month => {
                const value = month === 0 ? 12 : month;
                const instant = moment(next).month(_.isString(value) ? value : value - 1);
                return generateDays(instant, 'month', days, times, test);
            });
        }

        const results = _.sortBy(moments);
        for (let result of results) {
            if (_.isEmpty(years) || _.includes(years, result.year())) {
                yield result;
            }
        }

        next = moment(start).add(i * (schedule.frequency || 1), period);
    }
}

module.exports = { generate };
