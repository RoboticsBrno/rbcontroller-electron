#FROM electronuserland/builder:wine
# They don't tag versions :(
FROM electronuserland/builder@sha256:8dd62ce3f32421abbb275d6b721f7ce4377c8442d703c0309cf423a4123997e0 


ENV ELECTRON_CACHE="/root/.cache/electron" \
    ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder"

ADD package.json package-lock.json ./

RUN npm install

ADD . ./
VOLUME /project/dist /root/.cache/electron /root/.cache/electron-builder

CMD npm run dist-win
