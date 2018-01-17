'use strict';

var request = require('request'),
    RetryHelper = require('./RetryHelper');


function ApiClient(options) {
    if (typeof options === 'string') {
        options = {
            token: options
        };
    }
    if (!options.token) {
        throw new Error('Missing token!');
    }
    this._token = options.token;
    this._baseUri = options.baseUri || 'https://api.veritone.com';
    this._version = options.version || 1;
    this._maxRetry = options.maxRetry;
    this._retryIntervalMs = options.retryIntervalMs;
    if (typeof this._version === 'number') {
        this._baseUri = this._baseUri + '/v' + this._version;
    } else if (this._version !== 'disable') {
        this._baseUri = this._baseUri + '/' + this._version;
    }
    this._retryHelper = new RetryHelper({maxRetry: this._maxRetry, retryIntervalMs: this._retryIntervalMs});
}

ApiClient.prototype.updateTask = function updateTask(jobId, taskId, result, callback) {
    if (typeof jobId !== 'string' || jobId === '') {
        throw new Error('Missing jobId!');
    }
    if (typeof taskId !== 'string' || taskId === '') {
        throw new Error('Missing taskId!');
    }
    if (typeof result !== 'object') {
        throw new Error('Missing result!');
    }
    if (typeof result.taskStatus !== 'string' || result.taskStatus === '') {
        throw new Error('Missing result.taskStatus!');
    }
    if (result.taskStatus !== 'running' && result.taskStatus !== 'complete' && result.taskStatus !== 'failed') {
        throw new Error('Invalid task status: ' + result.taskStatus);
    }
    if (typeof callback !== 'function') {
        throw new Error('Missing callback!');
    }

    var self = this;
    function task(callback) {
        request({
            method: 'PUT',
            url: self._baseUri + /job/ + jobId + '/task/' + taskId,
            headers: generateHeaders(self._token),
            json: result
        }, function requestCallback(err, response, body) {
            if (err) {
                return callback(err, body);
            }
            if (response.statusCode !== 204) {
                return callback('Received status: ' + response.statusCode, body);
            }
            callback(null);
        });
    }

    self._retryHelper.retry(task, function retryCallback(err, body) {
        if (err) {
            return callback(err, body);
        }
        callback(null, body);
    });
};

function generateHeaders(token) {
    var headers = {};
    headers.Authorization = 'Bearer ' + token;
    return headers;
}

module.exports = ApiClient;
