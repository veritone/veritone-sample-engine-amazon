const util = require('util');
const validurl = require('valid-url');
const path = require('path');
const utils = require('./utils');
global.fetch = require('node-fetch');;

module.exports = function createFunction(config) {
    const uri = config['graphql'].baseUri;
    const request = require('superagent');

    function query(query, variables, callback) {
        const headers = {
            Authorization: 'Bearer ' + config['veritone-api'].token,
            Accept: '*/*'
        };

        if (callback) {
            return request.post(uri).set(headers).send({ query: query, variables: variables }).end(callback);
        } else {
            return request.post(uri).set(headers).send({ query: query, variables: variables });
        }
    }

    /**
     * Recognition data:
     {
      libraryId: ...
      libraryEngineModelId: ...,
      recordingId: ...,
      jobId: ...,
      taskId: ...,
     }
     */
    function getData(params, callback) {
        const q = `query {
    temporalDataObject(id: "${params.tdoId}") {
      id
      startDateTime
      stopDateTime
      mediaAssets: assets(assetType: ["media"]) {
        records {
          ...assetFields
        }
      }
      imageAssets: assets(assetType: ["image"]) {
        records {
          ...assetFields
        }
      }
    }
      task(id: "${params.taskId}") {
          id
          status
          buildId
          engineId
    }
  }

  fragment assetFields on Asset {
    id
    name
    contentType
    jsondata
    assetType
    uri
    signedUri
    createdDateTime
  }`;
        console.log(q);
        query(q, {}, function(err, data) {
            if (err) {
                callback(err, null);
                console.log('error:  ' + err);
                return;
            }

            let json = JSON.parse(data.text);
            callback(null, json.data);
        });
    }

    function getCollectionId(libraryId, libraryEngineModelId, callback) {
        const q = `query {
    library(id: "${libraryId}") {
      id
         version
         engineModels(id: "${libraryEngineModelId}") {
           count
           records {
             id
             name
             jsondata
             dataUrl
             trainJobId
             trainStatus
             containerId
           }
         }
       }
     }`;


        query(q, {}, function(err, data) {
            if (err) callback(err, null);
            let json = JSON.parse(data.text);
            if (json && json.data && json.data.library) {
                if (json.data.library.engineModels.count) {
                    let jsondata = json.data.library.engineModels.records[0].jsondata;
                    console.log(JSON.stringify(jsondata));
                    // TODO get the collection ID
                } else {
                    throw Error('library engine model ' + libraryEngineModelId + ' not found');
                }
            } else {
                throw Error('library ' + libraryId + ' not found');
            }
            callback(err, data.text);
        });
    }

    function createAsset(tdoId, contentType, assetType, fileName, source, data, callback) {
        let size = data.length;
        let query = `mutation {
  createAsset(input: {
    containerId: "${tdoId}"
    contentType: "${contentType}"
    jsondata: {
      size: "${size}"
      source: "${source}"
      fileName: "${fileName}"
    }
    assetType: "${assetType}"
  }) {
    id
    uri
  }
}
  `;

        var headers = {
            Authorization: 'Bearer ' + config['veritone-api'].token,
            Accept: '*/*'
        };
        var result = request
            .post(uri)
            .set(headers)
            .field('query', query)
            .field('filename', fileName)
            .attach('file', Buffer.from(data, 'utf8'), fileName);

        if (callback) {
            return result.end(function(err, resultData) {
              if (err) {
                console.log(JSON.stringify(err))
                callback(err, null);
                return;
              }
                var json = JSON.parse(resultData.text);
                utils.logObject("asset.js - createAsset response...", json);
                callback(err, json.data.createAsset);
            });
        } else {
            return result.then(function(err, data) {
                var json = JSON.parse(data.text);
                return json.data.createAsset;
            });
        }
    }

    function updateTask(taskUpdate) {

    }

    return {
        createAsset,
        query,
        getCollectionId,
        getData
    }
}
