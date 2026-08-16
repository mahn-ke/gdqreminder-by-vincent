# Backend for [GDQReminder App](https://github.com/ViMaSter/gdqreminder-mobile/) [![codecov](https://codecov.io/gh/ViMaSter/gdqreminder-backend/branch/main/graph/badge.svg?token=0CRSIRXAS1)](https://codecov.io/gh/ViMaSter/gdqreminder-backend)

# Quickstart using Docker
1. Create a new folder (this README will refer to this folder as `$ROOT`)
2. Visit `Settings` -> [`Service Accounts`](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) of your firebase project
3. `Generate New Private key`, download and store this file at `$ROOT/firebase.json`
4. Create a `$ROOT/.env` file with the following content
   ```
     TWITCH_CLIENT_ID=[YOUR_GRAPHQL_TWITCH_CLIENT_ID]
   ```
5. Replace `[YOUR_GRAPHQL_TWITCH_CLIENT_ID]` with a client ID that has access to Twitch's GraphQL API
6. Run 
   ```ps
     docker run --name gdqreminder-backend -d --restart unless-stopped -v $(pwd):/firebase --env-file ./.env ghcr.io/vimaster/gdqreminder-backend:main --refreshIntervalInMS=60000
   ```
8. Optionally, the app supports logging to a [Seq](https://datalust.co/seq) instance. To enable it, add the following parameters to the end of the command outlined in the step above
   1. `--seqHost=` and append the full path to your HTTP ingest host (for example: `https://example.org:5341`)
   2. `--seqAPIKey=` and append [an API key](https://docs.datalust.co/docs/api-keys#creating-an-api-key)

## Setup
1. Run `nvm install && nvm use && npm i`
2. Visit `Settings` -> [`Service Accounts`](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) of your firebase project
3. `Generate New Private` key and store this place anywhere on your machine
4. Create a `.env`-file with the following content
   ```
     GOOGLE_APPLICATION_CREDENTIALS=[ABSOLUTE PATH TO JSON]
   ```
5. Replace `[ABSOLUTE PATH TO JSON]` with the absolute path to the `.json` file you just downloaded
6. Run `npm run server`
