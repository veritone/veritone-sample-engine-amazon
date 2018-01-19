//
// Simple logging module
//

'use strict';

const winston = require('winston');
winston.emitErrs = true;

const logger = new winston.Logger({
	transports: [
		new winston.transports.Console({
			level: process.env.LOG_LEVEL || 'info',
			timestamp: true,
			humanReadableUnhandledException: true,
			handleExceptions: true,
		})
	],

	exitOnError: false
});

module.exports = logger;
