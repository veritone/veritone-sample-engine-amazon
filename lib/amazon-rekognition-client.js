const logger = require('./logger');
const utils = require('./utils');

var fs = require('fs'),
    aws = require('aws-sdk'),
    path = require('path'),
    download = require('download-file');
var request = require('request').defaults({ encoding: null });

function AmazonRekognitionClient(config) {
    this._client = new aws.Rekognition(config.aws);
    this._minConfidence = config.minConfidence;
    console.log('new client with ' + this._minConfidence);
}

AmazonRekognitionClient.prototype.createCollection = function createCollection(collectionId, callback) {
    var self = this;
    this._client.createCollection({ CollectionId: collectionId }, function createCollectionCallback(err, data) {
        if (err) {
            return callback(err);
        }
        utils.logObject("[createCollection] - response = ", data);
        return callback(null, data);
    })
}

AmazonRekognitionClient.prototype.deleteCollection = function deleteCollection(collectionId, callback) {
    var self = this;
    this._client.deleteCollection({ CollectionId: collectionId }, function createCollectionCallback(err, data) {
        if (err) {
            return callback(err);
        }
        return callback(null, data);
    })
}

/**
 * callback should be given the fileContent and the local filename
 * @param {*} fileUrl
 * @param {*} callback
 */
function getImage(fileUrl, callback) {
    logger.verbose("... getImage " + fileUrl);

    if (fileUrl.indexOf("http") === -1) {
        return fs.readFile(fileUrl, function readFile(err, data) {
            return callback(err, data);
        });
    }
    var fileName = fileUrl.split('?')[0];
    fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
    var options = {
        filename: fileName
    };
    download(fileUrl, options, function downloadCompleted(err, savedPath) {
        if (err) {
            return callback(err);
        }
        var fullPath = path.resolve(savedPath);

        return fs.readFile(fullPath, function readFile2(err, data) {
            // need to remove the local file
            utils.cleanupData(fullPath);
            return callback(err, data);
        });
    });
}

/*
 this returns an array of strings which are ExternalImageIds in the collection

AmazonRekognitionClient.prototype.listFaces = function listFaces(collectionId) {

}
/**
 * options:
{
    CollectionId: xxx
    ExternalImageId: xxx
    Image: url
}
 */

/**
 * this assumes that the collection is created already!
 */
AmazonRekognitionClient.prototype.indexFaces = function indexFaces(options, callback) {
    var self = this;
    // make sure that collectionId is in AWS if not, need to create it */
    //    utils.logObject("[INDEX-FACES] - options=", options)

    //
    getImage(options.Image, function imageBytesReady(err, imageBytes) {
        // see this for limit http://docs.aws.amazon.com/rekognition/latest/dg/limits.html
        // 
        if (imageBytes && imageBytes.length > 5242880) {
            var s = `[INDEX-FACES], skipping indexing [${options.ExternalImageId}] because of size limit, the images length=[${imageBytes.length}]`;
            logger.warn(s);
            return callback(null, s);
        }

        var params = {
            CollectionId: options.CollectionId,
            ExternalImageId: options.ExternalImageId,
            Image: {
                Bytes: imageBytes
            }
        }
        self._client.indexFaces(params, function indexFacesCallback(err, indexFacesResponse) {
            if (err) {
                // for now just log it and move on.
                var s = `[INDEX-FACES], skipping indexing [${JSON.stringify(options)}], err=[${JSON.stringify(err)}]`;
                logger.warn(s);
                return callback(null, s);
            }
            logger.info(`[INDEX-FACES] added [${options.ExternalImageId}]`);
            return callback(null, indexFacesResponse);
        })
    });
}

/**
 * callback function(err, face)
 */
AmazonRekognitionClient.prototype.searchFaces = function searchFaces(collectionId, imageBuffer, callback) {
    var self = this;

    var params = {
        CollectionId: collectionId,
        Image: {
            Bytes: imageBuffer
        },
        FaceMatchThreshold: self._minConfidence,
        MaxFaces: 10
    };

    self._client.searchFacesByImage(params, function handleFaceResult(err, data) {
        if (err) {
            return callback(err);
        }
        callback(null, data);
    });
};

AmazonRekognitionClient.prototype.searchFramesForFaces = function searchFrames(collectionId, frames, callback) {
    /*
    each frame is {
      image: 'file path',
      start: (seconds),
      end: (seconds)
    }

     */
    // for each frame, we need to extract faces and search each one
    // against the specified collection
    async.forEachSeries(frames, function eachFile(frame, nextCallback) {

        const fpath = frame.image;
        var params = {
            CollectionId: collectionId,
            ExternalImageId: file,
            Image: {
                Bytes: fs.readFileSync(fpath)
            }
        }
        console.log('indexing ' + fname);
        amazonRekognitionClient._client.indexFaces(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else console.log(data); // successful response
            nextCallback();
        });
    }, function allDone() {
        console.log('done populating collection');
        callback();
    });

    callback();
}

AmazonRekognitionClient.prototype.detectFaces = function detectFaces(imageUrl, callback) {
    var self = this;
    var data = {};
    // Handles imageUrl is actual url or file on disk
    if (imageUrl.indexOf('http') === 0) {
        request.get(imageUrl, function requestResponse(error, response, body) {
            if (error) {
                return callback(error);
            }
            if (response.statusCode !== 200) {
                return callback(null, 'Received status: ' + response.statusCode);
            }
            var params = {
                Image: {
                    Bytes: Buffer.from(body, 'binary')
                },
                Attributes: [
                    ALL
                ]
                //MinConfidence: self._minConfidenc
            };

            self._client.detectFaces(params, function detectLabels(err, data) {
                if (err) {
                    return callback(err);
                }
                callback(null, data);
            });
        });
    } else {
        fs.readFile(imageUrl, function readFile(err, imageData) {
            if (err) {
                return callback(err);
            }
            var params = {
                Image: {
                    Bytes: Buffer.from(imageData, 'binary')
                },
                Attributes: [
                    ALL
                ]
                //MinConfidence: self._minConfidence
            };
            self._client.detectFaces(params, function detectLabels(err, data) {
                if (err) {
                    return callback(err);
                }
                callback(null, data);
            });

        });
    }
};

module.exports = AmazonRekognitionClient;