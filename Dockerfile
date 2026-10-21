# Stage 1: Build the React App
#
# Node 24 LTS, supported until April 2028. It was node:18, end of life since
# April 2025 and older than the packages allow: react-router needs >=20 and a
# MapLibre dependency >=22. It only built because npm warns about engine
# requirements rather than enforcing them.
FROM node:24-alpine AS build
WORKDIR /app

# 1. Install dependencies
COPY package*.json ./
RUN npm install

# 2. Copy source code (Ensure public folder is included!)
COPY . .

# 3. DEBUG: List files to prove 'public' exists before build
RUN ls -la public

# 4. Google Maps API key
#
# CRA inlines REACT_APP_* at build time, so the key has to be present when
# `npm run build` runs, not when the container starts. It used to arrive in a
# .env file that existed only on the droplet — gitignored, so a CI checkout has
# no key at all, and an empty key gets you Google's "for development purposes
# only" watermark instead of a map.
#
# Written to .env rather than set as ENV, and only when the arg is non-empty:
# dotenv skips keys already present in the environment, and an empty string
# counts as present, so an unconditional ENV would suppress a .env that a local
# `docker build` had copied in.
#
# This is not a secret in any useful sense — CRA compiles it into the bundle,
# so it is public the moment the site is served. It is protected by an HTTP
# referrer restriction in the Google Cloud console, not by being hidden. The
# ARG lives in the build stage only and never reaches the nginx image.
ARG REACT_APP_GOOGLE_MAPS_API_KEY
RUN if [ -n "$REACT_APP_GOOGLE_MAPS_API_KEY" ]; then \
      printf 'REACT_APP_GOOGLE_MAPS_API_KEY=%s\n' "$REACT_APP_GOOGLE_MAPS_API_KEY" > .env; \
    fi

# 5. Build the app
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# 6. DEBUG: List the final build folder to prove index.html exists
RUN ls -la build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the build output
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]