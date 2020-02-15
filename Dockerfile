FROM electronuserland/builder:wine

ENV ELECTRON_CACHE="/root/.cache/electron" \
    ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder"

ADD package.json package-lock.json ./

RUN npm install

ADD . ./
VOLUME /project/dist /root/.cache/electron /root/.cache/electron-builder

CMD npm run dist-win
