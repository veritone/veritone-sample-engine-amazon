const Jimp = require('jimp'),
    request = require('request');

/**
 * callback function(err, buffer)
 * returns a buffer to callback
 */
function crop(image, boundingBox, callback) {
    // scaleToFit(512, 512). removed
    image.clone().crop(boundingBox.left, boundingBox.top, boundingBox.width, boundingBox.height).getBuffer(Jimp.MIME_PNG, callback);
}

function loadImage(imageUrl, callback) {
    Jimp.read(imageUrl, function(err, image) {
        image.getBuffer(Jimp.AUTO, function(err, buffer) {
            callback(err, image, buffer);
        });
    });
}

module.exports = {
    crop,
    loadImage
}
