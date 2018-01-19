'use strict';

const fs = require('fs');

var async = require('async'),
    RecordingDecomposer = require('./lib/recording-decomposer.js'),
    imageUtil = require('./lib/imageUtil.js'),
    AmazonRekognitionClient = require('./lib/amazon-rekognition-client');

function RecognitionHelper(config) {
    if (typeof config !== 'object') {
        throw new Error('Missing config!');
    }
    this._recognitionClient = new AmazonRekognitionClient(config);
    this.decomposer = new RecordingDecomposer();
    this.config = config;
    this.maxParallelImages = config.maxParallelImages;
}

function cleanupData(dataPath) {
    if (dataPath.indexOf('http') !== 0) {
        fs.unlink(dataPath, (err) => {
            if (err) {
                console.log(err);
            }
        });
    }
}

RecognitionHelper.prototype.detectFaces = function detectFaces(amazonRekognitionClient, payload, allMatches, frame, image, imageBuffer, nextCallback) {
  var self = this;
  let params = {
      Image: {
          Bytes: imageBuffer
      },
      Attributes: [
       "ALL"
      ]
  };

  var start = Date.now();
  amazonRekognitionClient._client.detectFaces(params, function detectFacesCallback(err, result) {
    if (payload.perfTrace) {
      console.log('PERF detectFaces '+(Date.now() - start));
    }

    if (err) {
        console.log('faceSearchRecognition error ' + JSON.stringify(err));
        nextCallback();
        return;
    }

    if (payload.debug) {
      console.log('detected '+result.FaceDetails.length+' faces on frame '+frame.start+' from '+frame.image);
    }

    // detected.
    for(var detail of result.FaceDetails){
      var dims = (image.imageSize) ? image.imageSize : image.bitmap;
      //var test = detail.
      let boundingBox = {
        left: detail.BoundingBox.Left,
        top: detail.BoundingBox.Top,
        height: detail.BoundingBox.Height,
        width: detail.BoundingBox.Width,
        imageHeight: dims.height,
        imageWidth: dims.width
      };

      delete detail['BoundingBox'];

      var entry = {
        startTimeMs: 1000 * frame.start / self.config.framesPerSecond, // changed to ms
        stopTimeMs: 1000 * frame.end / self.config.framesPerSecond,
        boundingPoly: boundingBox,
        faceLandmarks: detail
      }
      allMatches.push(entry);
    }
    nextCallback(err, allMatches);
  }); ///detectFaces callback
}

RecognitionHelper.prototype.processImages = function processImages(frames, amazonRekognitionClient, payload, callback) {
  var self = this;
  var allMatches = [];

  async.forEachLimit(frames, self.maxParallelImages, function eachImage(frame, nextCallback) {
    if (payload.debug) console.log('starting frame '+frame.start);
    // for each image, first detect faces.
    // first load the image (once)
    // image metadata will be loaded in image, and a buffer loaded in imageBuffer.
    var start = Date.now();
    imageUtil.loadImage(frame.image, function(err, image, imageBuffer) {
      if (payload.perfTrace) {
        console.log('PERF loadImage '+(Date.now() - start));
      }

      if (!payload.debug) cleanupData(frame.image);
      if (payload.debug) console.log('loaded frame '+frame.start+' from '+frame.image);
      if (err) {
        console.log('error loading ' + frame.image + ':  ' + err);
        nextCallback(null, allMatches); // do not stop processing. just log error.
        return;
      }

      // submit to amazon face detection API.
      self.detectFaces(amazonRekognitionClient, payload, allMatches, frame, image, imageBuffer, nextCallback);
    }); //load images
  }, function allDone(err, results) {
    if (err) {
      console.log("error: ", err);
      return callback(err);
    }
    console.log('allDone with ' + allMatches.length);
    callback(null, allMatches);
  });
}

RecognitionHelper.prototype.recognizeData = function recognizeData(recognizeData, payload, callback) {
    var self = this;

    if (payload.debug) console.log(JSON.stringify(recognizeData, null, 2));
    // get the media (video), extract the frames from video to specified path then call object recognition for each images
    this.decomposer.process(recognizeData.temporalDataObject, this.config.framesPerSecond, payload, function decomposeCallback(err, frames) {
        if (err) {
            return callback(err);
        }

        self.processImages(frames, self._recognitionClient, payload, callback);
    }); // decompose callback
}

module.exports = RecognitionHelper;
