#!/usr/bin/env bash
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com
docker build -t prod-kidsloop-live-graphql .
docker tag prod-kidsloop-live-graphql:latest 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-live:latest
docker push 494634321140.dkr.ecr.ap-northeast-2.amazonaws.com/kidsloop-live:latest
aws ecs update-service --service arn:aws:ecs:ap-northeast-2:494634321140:service/h5p-prod/kidsloop-live-graphql --force-new-deployment --cluster h5p-prod