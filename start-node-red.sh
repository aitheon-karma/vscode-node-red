#!/bin/bash

PROCESS_PATH=$1
USER_DIR=$2
SETTINGS_PATH=$3
SAFE=$4

npm i --prefix $USER_DIR --silent --no-audit --prefer-offline

echo "Installing dependencies for $USER_DIR"

node $PROCESS_PATH -u $USER_DIR -s $SETTINGS_PATH $SAFE