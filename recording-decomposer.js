const fs = require('fs');
 exec = require('child_process').exec,
 path = require('path'),
 ffmpeg = require('ffmpeg'),
 download = require('download-file'),
 mimetypes = require('mime-types'),
 moment = require('moment'),
 ffmpegCmd = path.join(__dirname, 'node_modules', 'ffmpeg', 'ffmpeg.' + process.platform),
 ffprobeCmd = path.join(__dirname, 'node_modules', 'ffmpeg', 'ffprobe.' + process.platform),
 VOLUME_ADJUSTMENT_TOLERANCE = 0.75,
 EXEC_BUFFER_SIZE = 20 * 1024 * 1024;

function RecordingDecomposer() {}

function cleanupData(dataPath) {
    if (dataPath.indexOf('http') !== 0) {
        fs.unlink(dataPath, (err) => {
            if (err) {
                // just log error since files that are not local cannot be deleted
                console.log(err);
            }
        });
    }
}

RecordingDecomposer.prototype.processAVideo = function processAVideo(videoPath, framesPerSecond, payload, callback) {
        var self = this;
        var options = {
            inputFile: videoPath,
            outputFilename: 'frame',
            frameRate: framesPerSecond,
            outputFolder: './images'
        };
        if (payload.hasOwnProperty('jpegQuality')) {
          options.jpegQuality = payload.jpegQuality;
        }
        // TODO fix payload variable reference.
        // currently it's used only for debug setting so no big deal.
        //var payload = {};
        var start = Date.now();
        this.extractFramesToJPG(options, function done(err, files) {
          if (payload.perfTrace) {
            console.log('PERF extractFramesToJPG '+(Date.now() - start));
          }
            if (err) {
                return callback(err);
            }
            if (!payload.keep) {
                cleanupData(options.inputFile);
            }
            // catch possible error and pass the error as callback
            try {
                var result = self.buildResult(files, framesPerSecond);
                callback(null, result);
            } catch (e) {
                callback(e);
            }
        });
    }
    /**
     * Process Veritone media
     *
     * Download video from CMS recordingId then extract frames from video to image files
     *
     * @param recordingId
     * 		Veritone CMS recording ID
     *
     * @param framesPerSecond
     *		FPS rate to be used to extract frames using ffmpeg
     *
     * @param callback
     *		Callback with errors and array of exctracted images with timing info (start, end)
     */
RecordingDecomposer.prototype.process = function process(tdoData, framesPerSecond, payload, callback) {
    var self = this;
    if (this.hasImageAsset(tdoData)) {
      // if there is an image asset, process it
      this.downloadImage(tdoData, payload, function downloadDone(err, filePath) {
        if (err) {
          return callback(err);
        }
        var result = [{
          start: tdoData.startDateTime,
          end: tdoData.stopDateTime,
          image: filePath
        }];
        callback(null, result);
      });
    } else {
      // otherwise we look for a media/video asset
      this.downloadRecording(tdoData, payload, function downloadDone(err, videoPath) {
        if (err) {
            return callback(err);
        }
        self.processAVideo(videoPath, framesPerSecond, payload, callback);
    });
  }
};

/**
 * Download recording/media file
 *
 * Download the real media file base on Veritone recording Id
 *
 * @param recordingID
 *		Veritone CMS Recording ID
 *
 * @param callback
 *		Callback with the error and path to downloaded media
 */
RecordingDecomposer.prototype.downloadRecording = function downloadRecording(tdoData, payload, callback) {
    console.log('Fetching recording info: ' + tdoData.id);
    var compatibleAssets = [];
    if (tdoData.mediaAssets && tdoData.mediaAssets.records) {
        compatibleAssets = tdoData.mediaAssets.records;
    }

    // Sort assets by createdDateTime
    compatibleAssets.sort(function sortAscByCreatedDateTime(a, b) {
        return a.createdDateTime - b.createdDateTime;
    });
    if (!compatibleAssets.length) {
        return callback(new Error('no compatible media asset found!'));
    }

    console.log('Downloading Recording[' + tdoData.id + ']: ' + compatibleAssets[0].signedUri);
    downloadFile(compatibleAssets[0].signedUri, payload, callback);
};

RecordingDecomposer.prototype.hasImageAsset = function hasImageAsset(tdoData) {
  return tdoData.imageAssets && tdoData.imageAssets.records.length;
}

RecordingDecomposer.prototype.downloadImage = function downloadImage(tdoData, payload, callback) {
  console.log('Fetching recording info: ' + tdoData.id);
  var compatibleAssets = [];
  if (tdoData.imageAssets && tdoData.imageAssets.records) {
      compatibleAssets = tdoData.imageAssets.records;
  }

  // Sort assets by createdDateTime
  compatibleAssets.sort(function sortAscByCreatedDateTime(a, b) {
      return a.createdDateTime - b.createdDateTime;
  });
  if (!compatibleAssets.length) {
      return callback(new Error('no compatible image asset found!'));
  }

  console.log('Downloading image[' + tdoData.id + ']: ' + compatibleAssets[0].signedUri);
  downloadFile(compatibleAssets[0].signedUri, payload, callback);
}

/**
 * Download file function with callback
 *
 * @param fileUrl
 *		File/media URL that will be be downloaded
 *
 * @param callback
 *		Callback with error and path to downloaded file
 */
function downloadFile(fileUrl, payload, callback) {
    var fileName = fileUrl.split('?')[0];
    fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
    var options = {
        filename: fileName
    };
    var start = Date.now();
    download(fileUrl, options, function downloadCompleted(err, savedPath) {
      if (payload.perfTrace) {
        console.log('PERF download '+(Date.now() - start));
      }

        if (err) {
            return callback(err);
        }
        callback(null, savedPath);
    });
}

/**
 * Transform extracted frames to array of images with additional timing info
 *
 * @param images
 *		Array of extracted image filenames
 *
 * @param framesPerSecond
 * 		FPS rate to be used for image start and end calculation
 *
 * @return result
 *		Array of images with start and end time info
 */
RecordingDecomposer.prototype.buildResult = function buildResult(images, framesPerSecond) {
    var result = [];
    var start = 0;
    images.sort(function comparator(a, b) {
        var index1 = _getIndexFromName(a);
        var index2 = _getIndexFromName(b);
        return index1 - index2;
    });
    images.forEach(function item(image) {
        result.push({
            start: start,
            end: start + framesPerSecond,
            image: image
        });
        start = start + framesPerSecond;
    });
    return result;
}

/**
 * Gets the image index from the file path.
 *
 * @param filePath File path, expected format is './images/frame_74.jpg'
 * @returns {integer} The image index, the number appended at the end of the file name (74 for the example file path).
 */
function _getIndexFromName(filePath) {
    var index = filePath.split('/').pop().split('.')[0].split('_').pop();
    return index;
}

RecordingDecomposer.prototype.extractFramesToJPG = function extractFramesToJPG(options, callback) {
	if (typeof options !== 'object') {
		throw new Error('Missing options!');
	}
	if (typeof options.inputFile !== 'string' || options.inputFile === '') {
		throw new Error('Missing options.inputFile!');
	}
	if (
		typeof options.outputFilename !== 'string' ||
		options.outputFilename === ''
	) {
		throw new Error('Missing options.outputFilename!');
	}
	if (typeof options.outputFolder !== 'string' || options.outputFolder === '') {
		throw new Error('Missing options.outputFolder!');
	}
	if (typeof options.frameRate !== 'number' || options.frameRate === '') {
		throw new Error('Missing options.frameRate!');
	}
  if (options.jpegQuality && (!typeof options.jpegQuality !== 'number')) {
    throw new Error('options.jpegQuality must be a number from 1-10');
  }
  var jpegQuality = options.jpegQuality || 1;
	ffmpeg.getMediaDetails(options.inputFile, function done(error, details) {
		if (error) {
			return callback(error);
		}
		if (options.outputFolder !== '.') {
			fs.exists(options.outputFolder, function fileNameExists(exists) {
				if (!exists) {
					fs.mkdirSync(options.outputFolder);
				}
			});
		}
		var aspectRatio = details.video.aspectRatio;
		var w = aspectRatio.split(':')[0];
		var h = aspectRatio.split(':')[1];
		var outputFilename = options.outputFilename + '_%d.jpg';
		var outputFolder = options.outputFolder;
		var portions = [
			ffmpegCmd,
			'-i ' + options.inputFile,
			'-r ' + options.frameRate,
			'-s ' + details.video.width + 'x' + details.video.height,
			'-aspect ' + aspectRatio,
			'-filter_complex "scale=iw*sar:ih, pad=max(iw\\,ih*(' +
				w +
				'/' +
				h +
				')):ow/(' +
				w +
				'/' +
				h +
				'):(ow-iw)/2:(oh-ih)/2:black"',
			'-q:v '+jpegQuality,
			[outputFolder, outputFilename].join('/')
		];
		var cmd = portions.join(' ');
		console.log('cmd', cmd);
		exec(cmd, function execCallback(err, stdout, stderr) {
			var output = stdout + stderr;

			if (err) {
				return callback(err, null, { output: output });
			}
			var files = [];
			if (outputFolder.charAt(outputFolder.length - 1) === '/') {
				outputFolder = outputFolder.substr(0, outputFolder.length - 1);
			}
			// Read file list inside the folder
			var result = fs.readdirSync(outputFolder);
			// Scan all file and prepend the folder path
			for (var i in result) {
				var file = result[i];
				if (file.indexOf('.DS_Store') < 0) {
					files.push([outputFolder, file].join('/'));
				}
			}
			callback(undefined, files, { output: output });
		});
	});
};

module.exports = RecordingDecomposer;
