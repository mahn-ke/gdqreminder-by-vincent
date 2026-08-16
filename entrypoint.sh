#!/bin/sh
set -e
mkdir -p /firebase
printf '%s' "$FIREBASE_JSON" > /firebase/firebase.json
exec npm run start -- "$@"
