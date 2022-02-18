#!/bin/bash

# Set config file path.
default_conf_file_path='/home/tilmannbartsch/symate/passwords/mqtt-kafka-stream-processing.conf'

# Read first argument as config file location. If empty use default_config_file_path
conf_file_path="${1:-${default_conf_file_path}}"

# check if config file path is set
if [ -z "$conf_file_path" ]
then
      echo "\$conf_file_path is empty."
      exit 1
fi 

# Read credentials
client_id=$(awk '/^mqtt.subscriber.client.id/{print $2}' "${conf_file_path}")
client_secret=$(awk '/^mqtt.subscriber.client.secret/{print $2}' "${conf_file_path}")

mosquitto_sub \
  --host 127.0.0.1 \
  --port 1883 \
  --id clientcredentials_mosquitto_sub \
  -V mqttv5 \
  --topic "test/topic1" \
  --username $client_id \
  -P $client_secret \
  --debug
