##Veritone sample engine using Amazon Rekognition

This project demonstrates the process of creating a Veritone face detection engine using the Amazon Rekognition API. For more information about the Amazon Rekognition, visit [here](https://docs.aws.amazon.com/rekognition/latest/dg/what-is.html). 

### Building and running the engine locally 

This engine uses node 6.12.2 and requires AWS CLI toolkit.
1.  Get access to an AWS IAM user with Rekognition access 
2.  Set up aws-cli SDK
3.  Create a config.json by replacing XXX_PLACEHOLDER variables with corresponding values in the config.json.template.
4.  Generate a payload.json via VDA
5.  Build and run the engine:
```
$ npm install
$ node app.js -config conf/config.json -payload payload.json
```

### Building the engine Docker image

1.  Log into the Veritone Developer Docker registry.
```
$ docker login docker.veritone.com
```

2.  Build the Docker image 
```
$ docker build -t az-rekognition-face-detection .
```

### Deploying engine via Veritone Developer

Once built and tested locally (either as a Docker container or running `node app.js` as shown above),
tag the engine and upload the build to the Veritone Docker registry:
```
$ docker tag az-rekognition-face-detection docker.veritone.com/${YOUR-ACCOUNT}/az-rekognition-face-detection:${CUSTOM-TAG}    
$ docker push docker.veritone.com/${YOUR-ACCOUNT}/az-rekognition-face-detection:${CUSTOM-TAG}
```

After the engine is uploaded it will appear in the the builds table. Press deploy to deploy the engine. Now the engine is now deployed and ready for use. 

