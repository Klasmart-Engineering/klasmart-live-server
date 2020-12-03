#!/usr/bin/env bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -t kidsloop-prod-live-graphql .
docker tag kidsloop-prod-live-graphql:latest 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-prod-live-graphql:latest
docker push 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-prod-live-graphql:latest
aws ecs update-service --service arn:aws:ecs:ap-northeast-2:494634321140:service/prod-hub/prod-live-graphql-service --force-new-deployment --cluster prod-hub --region ap-northeast-2