#!/usr/bin/env bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 871601235178.dkr.ecr.ap-northeast-2.amazonaws.com
DOCKER_BUILDKIT=1 docker build --ssh default -t kidsloop-alpha-live-graphql-crack-drake .
docker tag kidsloop-alpha-live-graphql-crack-drake:latest 871601235178.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-alpha-live-graphql-crack-drake:latest
docker push 871601235178.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-alpha-live-graphql-crack-drake:latest
aws ecs update-service --service arn:aws:ecs:ap-northeast-2:871601235178:service/kidsloop-alpha/kidsloop-alpha-live-graphql --force-new-deployment --cluster kidsloop-alpha --region ap-northeast-2