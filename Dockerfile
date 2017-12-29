
FROM mhart/alpine-node:6.9.4 as alpine-tools

# Need to be able to switch this depending on where we deploy
ENV ENV_APP_HOME=/app
ENV CONFIG_FILE $ENV_APP_HOME/conf/config.json

RUN mkdir -p $ENV_APP_HOME && apk update && apk add -U git curl file && npm install aws-sdk

ADD . $ENV_APP_HOME
RUN  chmod +x $ENV_APP_HOME/*.sh


## DEVEVELOPMENT...
RUN apk update && apk add py-pip
RUN pip install awscli --upgrade --user && mkdir -p /root/.aws && \
 cp $ENV_APP_HOME/conf/aws_credentials /root/.aws/credentials && \
 cp $ENV_APP_HOME/conf/aws_config /root/.aws/config && \
 cp $ENV_APP_HOME/manifest.json /var/manifest.json

ENV NODE_ENV production
ENV LOG_LEVEL info

ENV PATH=/root/.local/bin/:$PATH

RUN cd $ENV_APP_HOME && npm install

ENTRYPOINT ["/app/app.sh"]
WORKDIR $ENV_APP_HOME/
