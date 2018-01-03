# Sample Veritone engine using Amazon Rekognition

**Table of Contents**

- [Summary](#summary)
- [Getting Started](#getting-started)
- [Building engine](#building-engine)
- [Engine samples](#engine-samples)

## Summary
This engine to demostrate the creation of a Veritone engine using the Amazon Rekognition API. 

It is an example of how to creat an external processing engine and deploy via Veritone Developer.

The full sample code can be found on [Github](https://github.com/veritone/veritone-sample-engine-amazon)

The steps below outline how the engine was created and deployed:
1.  Create a "face detection" engine via the VDA Developer App.  Make sure to specify the External Processing deployment model for the engine.
        
2.  Gather the engine image name, engine id, docker registry as provided in the VDA engine details page 

4.  Set the proper environment variables, e.g., REK_WORKER_AWS_ACCESS_KEY_ID and REK_WORKER_AWS_SECRET_ACCESS_KEY

5.  Run the engine locally with:
	```
	  npm install
	  node app.js -config conf/config.json -payload payload.json
	```

6.  Build the Docker image with:
	'''
	  docker build -t az-rekognition-face-detection .
	'''
	
7.  Log in to the Veritone docker registry using your Veritone credentials:
	'''
	  docker login docker.veritone.com
	'''
	
8.  Tag the engine with a custom tag and upload the build to the docker registry:
	'''
	  docker tag az-rekognition-face-detection docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}    
	  docker push docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}
	'''

9.  The new build should be appear in the builds table in Veritone Developer.

For more information on how to create an engine via Veritone Developer, visit [here](https://veritone-developer.atlassian.net/wiki/spaces/DOC/pages/17924125/Engine+Development+Quick+Start).



## Getting Started
The main function of this engine is to dectect faces on decomposed images from mpeg videos.

Detection is triggered when the engine and the corresponding video are selected by the user in CMS

A typical running payload:
    ```json
    {
      "jobId": "4079a128-5d4f-4ad8-a689-c7874763c004",
      "token": "xxx.xxxx.xxx",
      "taskId": "4079a128-5d4f-4ad8-a689-c7874763c004-d7343b72-a995-4376-9916-4879609e5d24",
      "recordingId": "xxxxx"
      "applicationId": "99f2e687-d22a-4bed-946e-75c683471359"
    }
    ```

Typical development tasks for working with the engine:
 1.  Create a payload.json for running -- This is can be done via Veritone Developer under the TASKS tab after the engine has been uploaded and deployed
 2.  Set up the PAYLOAD_FILE environment to point to this payload.json
 3.  Run the engine locally as normal process or as Docker container



## Building engine
### Build and run engine locally

This engine uses node 6.12.2, requires AWS CLI toolkit.
1.  Get access to an AWS IAM user that has Rekognition access and S3 access to the right bucket for library engine models
2.  Set up aws-cli SDK
3.  Create a config.json by replacing xxx_PLACEHOLDER variables with corresponding values in the config.json.template.
4.  Get a payload.json
5.  Build and run the engine:


	```
 	  npm install
	  node app.js -config conf/config.json -payload payload.json
	```

### Building the engine Docker images locally

1.  Define the following environment variables:

	```
	  export REK_WORKER_AWS_ACCESS_KEY=xxxx
	  export REK_WORKER_AWS_SECRET_ACCESS_KEY=xxxx
	```

2.  Log into the Veritone Developer Docker registry.
	'''
  	  docker login docker.veritone.com
	'''

3.  Build the Docker image 

	```
	  docker build -t az-rekognition-face-detection .
	```


### Running engine as a docker container

You can use the `docker run` command to start the Docker container for testing purpose.
This command will start the Docker container with a bash shell.
You can then :
1.  create a payload.json file
2.  export PAYLOAD_FILE=payload.json file
3.  Run `/app/app.sh`

### Deploying engine via Veritone Developer

Once built and tested locally (either as a Docker container or running `node app.js` as shown above)
Tag the engine with a custom tag and upload the build to the Veritone docker registry:
	'''
	  docker tag az-rekognition-face-detection docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}    
	  docker push docker.veritone.com/{your-account}/az-rekognition-face-detection:{custom-tag}
	'''

Once the engine is uploaded it should appear in the the builds table. Press deploy to deploy the engine. Now the engine should be ready and click on the Tasks tab to create a task payload.
The engine should also be accessible in CMS. Create a task by uploading a video and selecting az-rekognition-face-detection engine.




