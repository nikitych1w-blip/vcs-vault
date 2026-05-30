#!/bin/bash

registry=portal.works.prod.sbt:8999
path=sbt_docker/ci90000624_gitru
name=vcs-pw
version='1.57.0-13'

image=$registry/$path/$name:$version

docker buildx build --network=host --secret id=tuz_npm_config,src=./.npmrc -t $image --progress=plain -f .docker/Dockerfile --load .
docker push $image