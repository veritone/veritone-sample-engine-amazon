'use strict';

module.exports = function ffmpegModule(config) {
    config = config || {};
    if (config.execBufferSizeBytes && typeof config.execBufferSizeBytes !== 'number') {
        throw new Error('execBufferSizeBytes must be a number');
    }

    var fs = require('fs'),
        async = require('async'),
        exec = require('child_process').exec,
        path = require('path'),
        os = require('os'),
        ffmpeg = path.join(__dirname, 'ffmpeg.' + process.platform),
        ffprobe = path.join(__dirname, 'ffprobe.' + process.platform),
        freeMemory = os.freemem();

    var dynamicMemoryBuffer = Math.min(freeMemory / 3, 30 * 1024 * 1024);

    if (dynamicMemoryBuffer < freeMemory) {
        dynamicMemoryBuffer = freeMemory / 2;
    }

    var EXEC_BUFFER_SIZE = Math.floor(config.execBufferSizeBytes || dynamicMemoryBuffer),
        REGEX_START_DATE = /date\s+:\s+([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z)/gm,
        REGEX_CREATION_TIME = /creation_time\s+:\s+([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z)/gm;

    function testForFileAndExecutables(fileName, callback) {
        if (!fileName) {
            throw new Error('"fileName" is required.');
        }
        if (!callback) {
            throw new Error('"callback" is required.');
        }

        var operations = [];

        operations.push(function testForFile(cb) {
            fs.exists(fileName, function fileNameExists(exists) {
                if (!exists) {
                    return cb('File "' + fileName + '" does not exist.');
                } else {
                    return cb();
                }
            });
        });

        operations.push(function testForFfprobe(cb) {
            fs.exists(ffprobe, function ffprobeExists(exists) {
                if (!exists) {
                    return cb('Unable to find ffprobe executable!');
                }

                cb();
            });
        });

        operations.push(function testForFfmpeg(cb) {
            fs.exists(ffmpeg, function ffmpegExists(exists) {
                if (!exists) {
                    return cb('Unable to find ffmpeg executable!');
                }

                cb();
            });
        });

        async.parallel(operations, callback);
    }

    function parseSection(lines) {
        var obj = {},
            a;
        lines.forEach(function forEachLine(line) {
            a = line.split('=');
            obj[a[0]] = a[1];
        });
        return obj;
    }


    function gcd(a, b) {
        if (b === 0) return a;
        return gcd(b, a % b);
    }

    function processSection(obj, sectionHeader, section) {

        if (sectionHeader === '[FORMAT]') {
            obj.formatId = section.format_name;
            obj.formatName = section.format_long_name;
            obj.duration = parseFloat(section.duration);
            obj.bitRate = parseInt(section.bit_rate);
            if (section['TAG:encoder']) {
                obj.encoder = section['TAG:encoder'];
            }
        }
        if (sectionHeader === '[STREAM]') {
            if (section.codec_type === 'audio' && !obj.audio) {
                obj.audio = {
                    codecId: section.codec_name,
                    codecName: section.codec_long_name,
                    sampleRate: parseInt(section.sample_rate),
                    channels: parseInt(section.channels)
                };
                if (section.channel_layout) {
                    obj.audio.channelLayout = section.channel_layout;
                }
                if (section['TAG:encoder']) {
                    obj.audio.encoder = section['TAG:encoder'];
                }
                if (section.bits_per_sample !== '0') {
                    obj.audio.bitsPerSample = parseInt(section.bits_per_sample);
                }
            }
            if (section.codec_type === 'video' && !obj.video) {
                var height = parseInt(section.height);
                var width = parseInt(section.width);
                var aspectRatio = section.display_aspect_ratio;
                if ((!aspectRatio || aspectRatio === '0:1') && width) {
                    var gcdValue = gcd(width, height);
                    var x = width / gcdValue;
                    var y = height / gcdValue;
                    aspectRatio = x + ':' + y;
                }
                obj.video = {
                    codecId: section.codec_name,
                    codecName: section.codec_long_name,
                    height: height,
                    width: width,
                    profile: section.profile,
                    aspectRatio: aspectRatio
                };
                if (section.avg_frame_rate && section.avg_frame_rate.indexOf('/') > -1) {
                    var fpsParts = section.avg_frame_rate.split('/');
                    var numerator = parseInt(fpsParts[0]);
                    var denominator = parseInt(fpsParts[1]);

                    if (!isNaN(numerator) && !isNaN(denominator)) {
                        obj.video.avgFrameRate = parseFloat((numerator / denominator).toFixed(4));
                    }
                }
                if (section['TAG:encoder']) {
                    obj.video.encoder = section['TAG:encoder'];
                }
            }
        }
    }

    function getMediaDetails(fileName, callback) {
        if (!fileName) {
            throw new Error('"fileName" is required.');
        }
        if (!callback) {
            throw new Error('"callback" is required.');
        }

        testForFileAndExecutables(fileName, function getMediaDetails2(err) {
            if (err) {
                return callback(err);
            }

            var operations = [];

            operations.push(function runFfprobe(cb) {
                var cmd = ffprobe + ' -i "' + fileName +
                    '" -show_format -v error -show_streams';
                console.log('cmd:getMediaDetails', cmd);
                exec(cmd, {
                    maxBuffer: EXEC_BUFFER_SIZE
                }, function execCallback(err, stdout, stderr) {
                    console.log('cmd:getMediaDetails', 'error', err);
                    //console.log(err);
                    //console.log('stdout', stdout);
                    //console.log('stderr', stderr);
                    if (err) {
                        return cb(err, {
                            stdout: stdout,
                            stderr: stderr
                        });
                    }

                    var lines = stdout.split('\n'),
                        sectionLines = [],
                        sectionHeader,
                        obj = {};
                    lines.forEach(function forEachLine(line) {
                        if (line[0] === '[') {
                            if (sectionHeader) {
                                processSection(obj, sectionHeader, parseSection(sectionLines));
                                sectionLines = [];
                                sectionHeader = undefined;
                            } else {
                                sectionHeader = line;
                            }
                        } else {
                            sectionLines.push(line);
                        }
                    });
                    cb(undefined, obj);
                });
            });

            operations.push(function getMediaStartDateOperation(cb) {
                getMediaStartDate(fileName, function getMediaStartDateCallback(err,
                                                                               startDate) {
                    if (err) {
                        return cb(err);
                    }

                    cb(undefined, startDate);
                });
            });

            async.parallel(operations, function parallelCallback(err, results) {
                if (err) {
                    return callback(err);
                }

                var obj = results[0],
                    startDate = results[1];

                if (startDate) {
                    obj.startDate = startDate;
                }

                callback(undefined, obj);
            });
        });
    }

    function getStartDateFromFfmpegOutput(stdout) {
        var dateString = getMatch(REGEX_START_DATE, stdout);

        if (!dateString) {
            dateString = getMatch(REGEX_CREATION_TIME, stdout);
        }

        if (dateString) {
            var d = new Date(dateString);
            return moment(d).unix();
        }

        return undefined;
    }

    function getMediaStartDate(fileName, callback) {
        if (!fileName) {
            throw new Error('"fileName" is required.');
        }
        if (!callback) {
            throw new Error('"callback" is required.');
        }

        var cmd = ffmpeg + ' -i "' + fileName + '" -f null /dev/null';
        console.log('getMediaStartDate:cmd', cmd);
        exec(cmd, {
            maxBuffer: EXEC_BUFFER_SIZE
        }, function execCallback(err, stdout, stderr) {
            if (err) {
                console.log('getMediaStartDate:cmd', 'error', err);
                return callback(err, {
                    stdout: stdout,
                    stderr: stderr
                });
            }

            var output = stdout + stderr;
            callback(undefined, getStartDateFromFfmpegOutput(output));
        });
    }

    function getMatch(pattern, output) {
        var m = pattern.exec(output);

        if (m != null) {
            return m[1];
        }

        return null;
    }

    return {
        ffmpegExecutable: ffmpeg,
        ffprobeExecutable: ffprobe,
        getMediaDetails: getMediaDetails,
    };
};