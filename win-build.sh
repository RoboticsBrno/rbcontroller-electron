#!/bin/bash
set -eu

mkdir -p dist .cache/electron .cache/electron-builder

docker build --pull -t rbcontrol-win-builder .
docker run -ti \
    -v ${PWD}/dist:/project/dist \
    -v ${PWD}/.cache/electron:/root/.cache/electron \
    -v ${PWD}/.cache/electron-builder:/root/.cache/electron-builder \
    rbcontrol-win-builder
