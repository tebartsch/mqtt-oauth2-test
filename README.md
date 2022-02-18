# Example setup of Mosquitto authenticated with OAuth2

## Start/Configure Keycloak and Mosquitto

Start a keycloak server.
```
cd keycloak
docker stack up -c docker-compose.yml keycloak
```

Configure Keycloak
```
cd keycloak/configure
npm install
node configure.js create-mqtt-clients \
        --username admin \
        --password admin \
        --keycloak http://127.0.0.1:7070
```

Build docker image containing the [mosquitto-go-auth](https://github.com/iegomez/mosquitto-go-auth) plugin.
```
cd mosquitto
docker build --tag mosquitto-oauth2 .
```

Run Mosquitto
```
docker run --rm -it -p 1883:1883 \
  --user "$(id -u):$(id -g)" \
  --mount type=bind,source="$(pwd)"/mosquitto/mosquitto.conf,target=/mosquitto.conf \
  --add-host=host.docker.internal:host-gateway \
  mosquitto-oauth2
```



## Test the setup

Store a file `mqtt-passwords.conf` containing
```
mqtt.publisher.client.id      <oauth2-publisher-client-id>
mqtt.publisher.client.secret  <oauth2-publisher-client-secret>

mqtt.subscriber.client.id     <oauth2-subscriber-client-id>
mqtt.subscriber.client.secret <oauth2-subscriber-client-secret>
```
Then use the clients
```
console-clients/clientcredentials_mosquitto_sub.sh mqtt-passwords.conf
console-clients/clientcredentials_mosquitto_pub.sh mqtt-passwords.conf

console-clients/oauthbearer_mosquitto_sub.sh mqtt-passwords.conf
console-clients/oauthbearer_mosquitto_pub.sh mqtt-passwords.conf
```
Alternatively change the variable `default_conf_file_path` in every `.sh`-file.
