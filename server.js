import createServer, { Network, Events } from 'monsterr'
import presurvey from './src/stages/presurvey/server/server'
import game from './src/stages/game/server/server'
import {Logger} from './src/database/logger'
import config from './src/stages/game/config/config.json'
import {LatencyModule} from './src/modules/LatencyModule'
import {NetworkModule} from './src/modules/NetworkModule'
import {spawn} from 'child_process'

const stages = [
  presurvey,
  game
]

let connectedPlayers = 0
console.log('waiting for ' + config.participants + ' players')

let events = {
  // when all client have connected, push the server into the first stage
  [Events.CLIENT_CONNECTED] (server, clientId) {
    connectedPlayers++
    if (connectedPlayers >= config.participants) {
      console.log('everyone connected, starting first stage')
      Logger.logEvent(server, 'everyone connected, starting first stage')
      server.start()
    }
  }
}
// handle commands from the admin client
let commands = {
  'reqJSON': (server, clientId) => {
    let json = Logger.exportAsJSON()
    server.send('resJSON', json).toAdmin()
  },
  'reqCSV': (server, clientId) => {
    let csv = Logger.exportAsCSV()
    console.log(csv)
    server.send('resCSV', csv).toAdmin()
  }
}

LatencyModule.addServerCommands(commands)

let network = Network.clique(config.participants)
NetworkModule.addServerCommands(commands, network)

const monsterr = createServer({
  network: network,
  events,
  commands,
  stages,
  options: {
    clientPassword: undefined, // can specify client password
    adminPassword: 'sEcr3t' // and admin password
  }
})

monsterr.run()

// spawn bot-threads, use "config.participants - 1" for debuging with only 1 client
let numberOfBots = 0 // config.participants - 1
for (let i = 0; i < numberOfBots; i++) {
  console.log('spawning bot #' + i)
  spawn('node', ['./src/bot.js'])
}
