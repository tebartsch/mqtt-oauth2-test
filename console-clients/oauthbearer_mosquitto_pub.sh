#!/bin/bash

# Set config file path.
default_conf_file_path=''
default_oauth2_token_endpoint='http://127.0.0.1:7070/auth/realms/master/protocol/openid-connect/token'

# Read first argument as oauth2 server location. If empty try to use
# default_oauth2_server
oauth2_token_endpoint="${2:-${default_oauth2_token_endpoint}}"
# check if config file path is set
if [ -z "$oauth2_token_endpoint" ]
then
      echo "\$oauth2_token_endpoint is empty."
      exit 1
fi 

# Read second argument as config file location. If empty use default_config_file_path
conf_file_path="${1:-${default_conf_file_path}}"
# check if config file path is set
if [ -z "$conf_file_path" ]
then
      echo "\$conf_file_path is empty."
      exit 1
fi 

# Read credentials
client_id=$(awk '/^mqtt.publisher.client.id/{print $2}' "${conf_file_path}")
client_secret=$(awk '/^mqtt.publisher.client.secret/{print $2}' "${conf_file_path}")

# Encode client credentials
basic_auth=$(printf "${client_id}:${client_secret}" | base64)

TOKEN=$(curl --location \
    --request POST "${2:-${oauth2_token_endpoint}}" \
    --header "Authorization: Basic ${basic_auth}" \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=client_credentials' \
  | jq -r ".access_token")

mosquitto_pub \
  --host 127.0.0.1 \
  --port 1883 \
  --id oauthbearer_mosquitto_pub \
  -V mqttv5 \
  --username "${TOKEN}" \
  -P "oauthbearer_empty_password" \
  --topic "test/topic1" \
  --message "oauthbearer_mosquitto_pub test message" \
  --repeat 8640 \
  --repeat-delay 3 \
  --debug
