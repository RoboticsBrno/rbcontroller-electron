#!/bin/bash
docker pull electronuserland/builder:wine
sudo docker run -ti  --env ELECTRON_CACHE="/root/.cache/electron" \
    --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
    -v ${PWD}:/project  -v ${PWD##*/}-node-modules:/project/node_modules  \
    -v ~/.cache/electron:/root/.cache/electron  \
    -v ~/.cache/electron-builder:/root/.cache/electron-builder  \
    electronuserland/builder:wine \
    sh -c 'export PATH="$PATH:$(pwd)/node_modules/.bin/" && npm install && npm run dist-win'
