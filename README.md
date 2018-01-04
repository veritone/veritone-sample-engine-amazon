# Sample Veritone engine using Amazon Rekognition

**Table of Contents**

- [Summary](#summary)
- [Getting Started](#getting-started)
- [Building Engine](#building-engine)

## Summary
This is a demostration Veritone engine using the Amazon Rekognition API. 

It is meant to be an example of how to creat an external processing engine deployed via Veritone Developer.

The full sample code can be found on [Github](https://github.com/veritone/veritone-sample-engine-amazon).

The steps below outline how the engine was created and deployed:
1.  Create a "az-rekognition-face-detection" engine via [Veritone Developer](https://developer.veritone.com/).
        
2.  Gather the engine image name, engine id, Docker registry as provided on the engine details page. 

4.  Set the proper environment variables, e.g., REK_WORKER_AWS_ACCESS_KEY_ID and REK_WORKER_AWS_SECRET_ACCESS_KEY

5.  Run the engine locally with:
```
$ npm install
$ node app.js -config conf/config.json -payload payload.json
```

6.  Build the Docker image with:
```
$ docker build -t az-rekognition-face-detection .
```

7.  Log in to the Veritone Docker registry using your Veritone credentials:
```
$ docker login docker.veritone.com
```
	
8.  Tag the engine with a custom tag and upload the build to the Docker registry:
```
$ docker tag az-rekognition-face-detection docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}    
$ docker push docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}
```

9.  The new build should appear in the builds table in Veritone Developer. Deploy the engine and it is now ready for use.

For more information on how to create an engine via Veritone Developer, visit [here](https://veritone-developer.atlassian.net/wiki/spaces/DOC/pages/17924125/Engine+Development+Quick+Start).



## Getting Started
The main function of this engine is to dectect faces on images decomposed from mpeg videos. The output of this engine is a series of detected faces and the attributes associated with it, such as age, gender, facial landmarks and sentiment. 

Detection is triggered when the engine and the corresponding video are selected by the user in CMS. This action creates a job and a task.
A typical task payload:
```json
{
  "applicationId": "fb901454-1ef2-4130-a65d-0a831443f675",
  "jobId": "5fa1b7d7-db54-4c8e-8f1f-6cb8029e2e49",
  "taskId": "5fa1b7d7-db54-4c8e-8f1f-6cb8029e2e49-8d70f376-377c-499e-adf4-e85ab70b4180",
  "recordingId": "38828568",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
}
```

Every image uploaded to Veritone Docker registry for an engine should include a manifest.json file, which states important information about the engine and build. 
The manifest.json could be automatically generated when going through the engine creation process via Veritone Developer. 
This file needs to be copied to /var/manifest.json when building the Docker image. For more information about the fields in the manifest.json, visit [here](https://veritone-developer.atlassian.net/wiki/spaces/DOC/pages/18874416/Engine+Manifests).

Typical development tasks for working with the engine:
 1.  Create a payload.json for running -- This is can be done via Veritone Developer under the TASKS tab after the engine has been uploaded
 2.  Set up the PAYLOAD_FILE environment to point to this payload.json
 3.  Run the engine locally as normal process or as a Docker container



## Building Engine
### Build and run engine locally

This engine uses node 6.12.2, requires AWS CLI toolkit.
1.  Get access to an AWS IAM user that has Rekognition access 
2.  Set up aws-cli SDK
3.  Create a config.json by replacing xxx_PLACEHOLDER variables with corresponding values in the config.json.template.
4.  Get a payload.json
5.  Build and run the engine:
```
$ npm install
$ node app.js -config conf/config.json -payload payload.json
```

### Building the engine Docker images locally

1.  Define the following aws environment variables:
```
$ export REK_WORKER_AWS_ACCESS_KEY=xxxx
$ export REK_WORKER_AWS_SECRET_ACCESS_KEY=xxxx
```

2.  Log into the Veritone Developer Docker registry.
```
$ docker login docker.veritone.com
```

3.  Build the Docker image 
```
$ docker build -t az-rekognition-face-detection .
```


### Running engine as a Docker container

You can use the `docker run` command to start the Docker container for testing purpose.
This command will start the Docker container with a bash shell.
You can then :
1.  create a payload.json file
2.  export PAYLOAD_FILE=payload.json file
3.  Run `/app/app.sh`

The engine follows the engine construction guidelines outlined [here](https://veritone-developer.atlassian.net/wiki/spaces/DOC/pages/17989697/Engine+Construction+Guidelines). This is a good place for information on how to properly implement the Veritone engine workflow.  

It is important to understand how and when to call Update Task via the Veritone API.

There are two types of outputs from the engine. It is currently recommended engines output both.
1. Engine output is uploaded to Veritone as an asset by calling the Create Asset mutation. 
2. Task output is created by calling Update Task with the result. 
Below is an example of how to update both:
```javascript
createAsset(results, function completeTaskNow(err, data) {
    if (err) {
        failTask(util.inspect(err));
    } else {
         if (!data.id) console.log('no ID in '+JSON.stringify(data));
         let assetId = data.id;
         completeTask("[DETECT]", { series: results, assetId: assetId });
    }
});
```
### Deploying engine via Veritone Developer

Once built and tested locally (either as a Docker container or running `node app.js` as shown above)
Tag the engine with a custom tag and upload the build to the Veritone Docker registry:
```
$ docker tag az-rekognition-face-detection docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}    
$ docker push docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}
```

Once the engine is uploaded it should appear in the the builds table. Press deploy to deploy the engine. Now the engine should be deployed and ready. 

Click on the Tasks tab and create a test task. Run this locally to see if everything is running correctly. The task log should also popluate once the task is finished. Verify this log to make sure the engine is outputing correctly.

The engine should also be accessible in CMS. Create a task by uploading a video and selecting az-rekognition-face-detection engine.
