#!/bin/bash

docker build -t slidewiki/discussionservice ./
docker rmi $(docker images | grep "<none>" | awk "{print \$3}")
docker push slidewiki/discussionservice
