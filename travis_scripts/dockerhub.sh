#!/bin/bash

docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker build -t slidewiki/discussionservice:latest-dev ./
docker push slidewiki/discussionservice:latest-dev
