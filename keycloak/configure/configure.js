#!/usr/bin/node

const commander = require('commander')
const readlineSync = require('readline-sync')
const KcAdminClient =  require('@keycloak/keycloak-admin-client')
const fse = require('fs-extra');
const process = require('process')
const {
    mqtt_pub_id,
    mqtt_pub_allowed_publish_topics,
    mqtt_pub_allowed_subscribe_topics,

    mqtt_sub_id,
    mqtt_sub_allowed_publish_topics,
    mqtt_sub_allowed_subscribe_topics
} = require('./defaults');

const program = new commander.Command()

program.version('0.0.1');

// Create everything if not already defined
program
    .command('create-mqtt-clients')
    .description('Create new realm with all necessary clients. ' +
        'If the realm name or any client/client scopes name is already defined than it not overwritten.')
    .requiredOption('-u, --username <username>', 'keycloak username with admin privileges')
    .option('-p, --password <password>', 'password of keycloak user')
    .requiredOption('-k, --keycloak <uri>', 'location of keycloak server, i.e. http://127.0.0.1:8080')
    .action(async (options) => {
        const kcAdminClient = await get_kc_admin_client(options)

        // ### GET PROCOTOL MAPPER REPRESENTATION ###
        const protocol_mapper_pub = create_mqtt_hard_coded_claim_mapper("Add MQTT Permissions", mqtt_pub_allowed_subscribe_topics, mqtt_pub_allowed_publish_topics)
        const protocol_mapper_sub = create_mqtt_hard_coded_claim_mapper("Add MQTT Permissions", mqtt_sub_allowed_subscribe_topics, mqtt_sub_allowed_publish_topics)

        // ### CREATE CLIENTS ###
        await create_confidential_client(kcAdminClient, mqtt_pub_id, [protocol_mapper_pub])
        await create_confidential_client(kcAdminClient, mqtt_sub_id, [protocol_mapper_sub])
    })


program.parse(process.argv);


// ### GENERAL FUNCTIONS ###

/**
 * Return short error message if it is REST response
 * @param err
 * @returns {string}
 */
function print_err(err) {
    if (err.response)
        return `Server Response: ${err.response.status} ${err.response.statusText}, Body: "${err.response.data.error}"`
    else
        return `${err}`
}

/**
 * Read password from command line if it is not set in options.
 * @param options
 * @returns {boolean|*}
 */
function get_password(options) {
    if (!options.password)
        return readlineSync.question('admin password?', {
            hideEchoBack: true // The typed text on screen is hidden by `*` (default).
        })
    else
        return options.password
}

/**
 * Write content to a file.
 * @param file
 * @param content
 */
function write_to_file(file, content) {
    try {
        fse.outputFile(file, content)
    } catch (err) {
        console.error(`failed to write to "${file}"`)
    }
}

/**
 * Create and authenticate KeycloakAdminClient
 * @param options
 * @returns {Promise<KeycloakAdminClient>}
 */
async function get_kc_admin_client(options) {
    const username = options.username
    const password = get_password(options)
    const keycloak_base_uri = options.keycloak

    let kcAdminClient = new KcAdminClient.default({
        baseUrl: `${keycloak_base_uri}/auth`,
        realmName: "master"
    })

    await kcAdminClient.auth({
        realmName: "master",
        username: username,
        password: password,
        grantType: 'password',
        clientId: 'admin-cli',
    }).catch(err => {
        console.error(`ERROR: Token couldn't be retrieved. ${err}`)
        process.exit(1)
    })

    console.error(`Admin Token retrieved successfully.`)

    return kcAdminClient
}


// ### MQTT FUNCTONS ###

/**
 * Create a keycloak protocol mapper json for mqtt oauth authentication.
 * @param name
 * @param read_topics
 * @param write_topics
 * @returns {{protocol: string, protocolMapper: string, name: string, config: {"userinfo.token.claim": string, script: string}}}
 */
function create_mqtt_hard_coded_claim_mapper(name, read_topics, write_topics){
    let topics = {}

    if (read_topics.length !== 0) {
        topics.read = read_topics
        topics.subscribe = read_topics
    }
    if (write_topics.length !== 0) {
        topics.write = write_topics
    }

    return {
        "name": "Add MQTT Permissions",
        "protocol": "openid-connect",
        "protocolMapper": "oidc-hardcoded-claim-mapper",
        "config": {
            "claim.name": "mqtt.topics",
            "claim.value": JSON.stringify(topics),
            "userinfo.token.claim": "true",
            "jsonType.label": "JSON"
        }
    }
}


/**
 * Create a confidential_client.
 * @param kcAdminClient
 * @param client_name
 * @param scopes
 * @returns {Promise<ClientRepresentation|*>}
 */
async function create_confidential_client(kcAdminClient, client_name, protocolMappers=[], scopes=[]) {
    let client
    const clients = await kcAdminClient.clients.find();

    console.info(`Create client ${client_name}`)
    if (!clients) {
        log.error("Client list couldn't be retrieved.")
        process.exit(1)
    }
    else
        client = clients.find(client => client.clientId === client_name)
    if(!client){
        const createdClientId = await kcAdminClient.clients.create({
            enabled: true,
            clientId: client_name,
            clientAuthenticatorType: "client-secret",
            standardFlowEnabled: true,
            directAccessGrantsEnabled: true,
            serviceAccountsEnabled: true,
            authorizationServicesEnabled: true,
            redirectUris: ["*"],
            webOrigins: ["*"],
            alwaysDisplayInConsole: true,
            protocolMappers: protocolMappers,
            defaultClientScopes: scopes
        }).catch(err => {
            console.log(`Creating client ${client_name} failed: ${print_err(err)}`)
            process.exit(1)
        })

        // Generate new client secret
        console.log(`Generating new client secret for client with uuid=${createdClientId.id}`)
        const credentialsRepr = await kcAdminClient.clients.generateNewClientSecret({
            id: createdClientId.id
        })
        const secret = credentialsRepr.value
        console.log(`${client_name} secret: ${secret}`)
        write_to_file(`outputs/${client_name}.secret`, secret)
        // Return client
        return await kcAdminClient.clients.findOne(createdClientId)
    }else{
        // Obtain secret of already defined client
        console.log(`Client ${client_name} already defined (uuid: ${client.id})`)
        const credentialsRepr = await kcAdminClient.clients.getClientSecret({
            id: client.id
        })
        const secret = credentialsRepr.value
        console.log(`${clientNameGui2} secret: ${secret}`)
        write_to_file(`outputs/${clientNameGui2}.secret`, secret)
        // Return client
        return client
    }
}
