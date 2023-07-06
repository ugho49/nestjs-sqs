#!/usr/bin/env bash

set -euo pipefail

# enable debug
# set -x

LOCALSTACK_HOST=localhost

echo "==================="
echo "Configuring sqs"
echo "==================="

create_queue() {
  local QUEUE_NAME_TO_CREATE=$1
  awslocal --endpoint-url=http://${LOCALSTACK_HOST}:4566 sqs create-queue --queue-name ${QUEUE_NAME_TO_CREATE} --region ${AWS_DEFAULT_REGION}
}

create_queue "test1"
create_queue "test2"
