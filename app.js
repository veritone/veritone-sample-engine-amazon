'use strict';

const utils = require('./utils');
const logger = require('./logger');

var util = require('util'),
    VeritoneApi = require('veritone-api'),
    RecognitionHelper = require('./recognition-helper'),
    fs = require('fs');

var payload_file = null,
    config_file = null;

process.argv.forEach(function(val, index, array) {
    if (val === "-payload") {
        payload_file = process.argv[index + 1];
    }
    if (val === "-config") {
        config_file = process.argv[index + 1];
    }
});

if (process.env.PAYLOAD_FILE) {
    payload_file = process.env.PAYLOAD_FILE;
}
if (process.env.CONFIG_FILE) {
    config_file = process.env.CONFIG_FILE;
}

var payload, config;

if (payload_file != null) {
    var params, parsed;
    params = fs.readFileSync(payload_file, 'utf8');
    try {
        payload = JSON.parse(params);
    } catch (_error) {
        e = _error;
        try {
            parsed = querystring.parse(params);
            if (!(Object.keys(parsed).length === 1 && parsed[Object.keys(parsed)[0]] === '')) {
                payload = parsed;
            }
        } catch (_error) {
            e = _error;
        }
    }
}

if (config_file != null) {
    config = fs.readFileSync(config_file, 'utf8');
    try {
        config = JSON.parse(config);
    } catch (_error) {
        e = _error;
    }
}

if (typeof config !== 'object') {
    throw new Error('Missing config!');
}
if (typeof config['veritone-api'] !== 'object') {
    throw new Error('Missing veritone-api config!');
}
if (typeof payload !== 'object') {
    throw new Error('Missing payload!');
}
if (typeof payload.applicationId !== 'string') {
    throw new Error('Missing from payload applicationId!');
}
if (typeof payload.jobId !== 'string') {
    throw new Error('Missing from payload jobId!');
}
if (typeof payload.taskId !== 'string') {
    throw new Error('Missing from payload taskId!');
}

if (typeof payload.recordingId !== 'string') {
    throw new Error('Missing from payload recordingId!');
}

var awsConfig = config['aws'];
if (typeof awsConfig !== 'object') {
    throw new Error('Missing AWS config!');
}

if (!isNaN(payload.threshold)) {
    awsConfig.threshold = payload.threshold;
}
if (!isNaN(payload.maxNumResults)) {
    awsConfig.maxNumResults = payload.maxNumResults;
}
if (!isNaN(payload.clumpThreshold)) {
    config.clumpThreshold = payload.clumpThreshold;
}
if (!isNaN(payload.framesPerSecond)) {
    config.framesPerSecond = payload.framesPerSecond;
}
if (!isNaN(payload.minConfidence)) {
 config.minConfidence = payload.minConfidence;
}
if (!isNaN(payload.maxParallelImages)) {
    config.maxParallelImages = payload.maxParallelImages;
}

if (!config.minConfidence) config.minConfidence = 98;

// used only to tune engine. does not affect results.
// limits concurrent async processing of images as a sanity check so
// that we don't attempt to load too much into memory at once.
if (!config.maxParallelImages) config.maxParallelImages = 50;

config["veritone-api"]["token"] = payload.token;
var inDevelopment = process.env.NODE_ENV != "production";

const assetApi = require('./asset.js')(config);

var veritoneClient = new VeritoneApi(config['veritone-api']),
    recognitionHelper = new RecognitionHelper(config);

function startTask(callback) {
    const task = { taskStatus: 'running' };
    veritoneClient.updateTask(payload.jobId, payload.taskId, task, function startTaskCompleteCallback(err) {
        if (err) {
            if (!inDevelopment) {
                console.log('jobId=' + payload.jobId + ', taskId=' + payload.taskId);
                console.log('update task failed: ' + util.inspect(err));
                return failTask('updateTaskToRunning.error ' + util.inspect(err));
            }
        }

        console.log('updateTaskToRunning.success');
        return callback();
    });
}

function completeTask(caller, taskOutput) {
    const task = { taskStatus: 'complete', taskOutput: taskOutput };
    veritoneClient.updateTask(payload.jobId, payload.taskId, task, function updateTaskCompleteCallback(err) {
        if (err) {
            return failTask('updateTaskToComplete.error ' + util.inspect(err));
        }
        console.log(caller + ' -- updateTaskToComplete.success');
    });
}

function failTask(errMessage) {
    const task = { taskStatus: 'failed', taskOutput: errMessage };
    veritoneClient.updateTask(payload.jobId, payload.taskId, task, function failTaskCallback(err) {
        if (err) {
            console.error('updateTaskToFailed.error:', util.inspect(err));
        } else {
            console.log('updateTaskToFailed.success');
        }
        process.exit(1);
    });
}

function detect() {
    logger.info("[DETECT] starting task..");

    return startTask(function updateTaskRunningCallback(err, body) {
        if (err) {
            console.log('failed to update task to running');
            return failTask(util.inspect(err) + '\n' + body);
        }

        logger.info('[DETECT] task is now running');
        let videoId = payload.recordingId;

        const req = {
            tdoId: videoId,
            jobId: payload.jobId,
            taskId: payload.taskId
        };
        assetApi.getData(req,
            function(err, data) {
                if (err) {
                    console.error('[DETECT]: Fatal', err);
                    return failTask(err);
                }

                recognitionHelper.recognizeData(data, payload, function updateAsset(err, results) {
                    if (err) {
                        utils.logObject("[DETECT] ERROR coming back from recognizeData??", err);
                        return failTask(err);
                    }

                    createAsset(results, function completeTaskNow(err, data) {
                        if (err) {
                            failTask(util.inspect(err));
                        } else {
                             if (!data.id) console.log('no ID in '+JSON.stringify(data));
                             let assetId = data.id;
                             completeTask("[DETECT]", { series: results, assetId: assetId });
                        }
                    });
                });
            });
    });
}

function createAsset(transformedData, callback) {
    let fileName = "amazon-rekognition-detect-face.json";
    let contentType = 'application/json';
    let source = 'amazon-rekognition-detect';
    let assetType = `v-${source}`;
    let assetContent = JSON.stringify(transformedData, null, 2);
    assetApi.createAsset(payload.recordingId, contentType, assetType, fileName, source, assetContent, callback);
}


// Main
console.log(".. Engine starting...");
utils.versionCheck();

// obscure tokens
let _config = JSON.parse(JSON.stringify(config));
let _payload = JSON.parse(JSON.stringify(payload));
_config['veritone-api'].token = '<redacted>';
_config.aws.accessKeyId = '<redacted>';
_config.aws.secretAccessKey = '<redacted>';
_payload.token = '<redacted>';

console.log(JSON.stringify(_payload));
console.log(JSON.stringify(_config));

detect();

console.log(".. Engine exiting...");
