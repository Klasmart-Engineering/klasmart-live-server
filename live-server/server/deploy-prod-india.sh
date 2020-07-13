#!/usr/bin/env bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 494634321140.dkr.ecr.ap-south-1.amazonaws.com
docker build -t prod-kidsloop-live .
docker tag prod-kidsloop-live:latest 494634321140.dkr.ecr.ap-south-1.amazonaws.com/prod-kidsloop-live:latest
docker push 494634321140.dkr.ecr.ap-south-1.amazonaws.com/prod-kidsloop-live:latest