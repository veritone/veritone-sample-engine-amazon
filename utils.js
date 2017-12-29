'use strict';

const util = require('util');
const logger = require('./logger');

var fs = require('fs');

exports.logObject = function logObject(msg, object) {
    logger.info(msg + " - " + JSON.stringify(object));
    // util.inspect(object, { depth: null }));
}
exports.logVerboseObject = function logVerboseObject(msg, object) {
    logger.verbose(msg, +JSON.stringify(object));
}
exports.cleanupData = function cleanupData(dataPath) {
    logger.verbose("... removing file " + dataPath);
    if (dataPath.indexOf('http') !== 0) {
        fs.unlink(dataPath, (err) => {
            if (err) {
                // just log error since files that are not local cannot be deleted
                console.log(err);
            }
        });
    }
}

exports.versionCheck = function versionCheck() {
    console.log(".. Version Info ");
    console.log("COMMIT_HASH=%s", process.env.COMMIT_HASH || "Unknown");
    console.log("BUILD_DATE=%s", process.env.BUILD_DATE || "Unknown");
}