#!/usr/bin/env bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -t beta-kidsloop-live-graphql .
docker tag beta-kidsloop-live-graphql:latest 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/beta-kidsloop-live-graphql:latest
docker push 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/beta-kidsloop-live-graphql:latest
aws ecs update-service --service arn:aws:ecs:ap-northeast-2:494634321140:service/beta-hub/beta-live-graphql-service --force-new-deployment --cluster beta-hub