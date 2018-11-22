import {DatabaseHandler} from '../../../database/DatabaseHandler'
import configfile from './../config/config.json'

// let roundfile = require('./../config/round1.json')
let rounds = configfile.rounds.map(file => require('./../src/stages/game/config/' + file + '.json'))
console.log('rounds: ' + JSON.stringify(rounds))
/* {
  console.log(configfile.rounds[i])
  let filepath = './../config/' + 'round1' + '.json'
  fs.readFile(filepath, (err, data) => {
    if (err) console.log(err)
    rounds.push(JSON.parse(data))
  })
} */
let config = rounds[0]
let colonies = []

export default {
  commands: {},
  events: {
    'mouseover-colony': (server, clientId, target) => {
      let targetId = colonies.find(colony => colony.name === target).id
      DatabaseHandler.logMouseOverColony(clientId, targetId)
    },
    'trade': (server, clientId, transfer) => {
      // remove amount from senders inventory
      let sendingColony = colonies.find(colony => colony.id === clientId)
      let senderInventory = sendingColony
        .inventory
        .find(material => material.name === transfer.material)
      // if the colony tries to transfer more than is in their inventory, just send what is in the inventory
      let transferedAmount = senderInventory.amount - transfer.amount < 0 ? senderInventory.amount : transfer.amount
      if (senderInventory.amount - transfer.amount < 0) {
        killColony(server, sendingColony, transfer.material)
      } else {
        senderInventory.amount -= transferedAmount
      }

      let receiverId = colonies.find(colony => colony.name === transfer.colony).id
      DatabaseHandler.logTrade(clientId, receiverId, transfer.material, transferedAmount)

      // add amount to receivers inventory when the trade is complete
      setTimeout(() => {
        let amount = colonies
          .find(colony => colony.name === transfer.colony)
          .inventory
          .find(material => material.name === transfer.material)
          .amount
        colonies
          .find(colony => colony.name === transfer.colony)
          .inventory
          .find(material => material.name === transfer.material)
          .amount = Math.floor(amount) + Math.floor(transferedAmount) // it congatinate + as strings

        server.send('trade', {
          sender: colonies.find(colony => colony.id === clientId).name,
          receiver: transfer.colony,
          amount: transfer.amount
        }).toClients(colonies.filter(colony => colony.game === sendingColony.game).map(colony => colony.id))
        sendColoniesInventories(server)
      }, config.trade_delay)
    },
    'chat': (server, clientId, message) => {
      let colony = colonies.find(colony => colony.id === clientId)
      server.send('chat', colony.name + '>' + message).toClients(colonies.filter(col => col.game === colony.game).map(colony => colony.id))
      DatabaseHandler.logChat(clientId, message)
    },
    'produce': (server, clientId, production) => {
      let colony = colonies.find(colony => colony.id === clientId)
      let inputName = production.material
      let outputName = colony.specilisations.find(specilisation => specilisation.input === inputName).output
      let gain = colony.specilisations.find(specilisation => specilisation.input === inputName).gain
      let delay = colony.specilisations.find(specilisation => specilisation.input === inputName).transform_rate

      // substract input materials and inform the colony
      colony.inventory.find(material => material.name === inputName).amount -= production.amount
      sendColoniesInventories(server)

      DatabaseHandler.logProduction(clientId, inputName, production.amount)

      // create a timeout that adds the output to the colony and informs the colony
      setTimeout(() => {
        let currentAmount = colony.inventory.find(material => material.name === outputName).amount
        colony.inventory
          .find(material => material.name === outputName)
          .amount = Math.floor(currentAmount) + Math.floor(production.amount * gain) // it congatinate + as strings
        sendColoniesInventories(server)
      }, delay * 1000)
    },
    'ready': (server, clientId) => {
      let reportingColony = colonies.find(colony => colony.id === clientId)
      reportingColony.ready = true

      let allReady = true
      colonies.filter(col => col.game === reportingColony.game).forEach(colony => {
        if (!colony.ready) {
          allReady = false
        }
      })
      if (allReady) {
        console.log('All clients have reported ready, starting game: ' + reportingColony.game)
        // only send what is needed
        let simplifiedColonies = []
        colonies.filter(colony => colony.game === reportingColony.game).forEach(colony => {
          let simplifiedColony = {
            name: colony.name
          }
          if (config.tooltip.includes('inventories')) {
            simplifiedColony.inventory = colony.inventory
          }
          if (config.tooltip.includes('specilisations')) {
            simplifiedColony.specilisations = colony.specilisations
          }
          simplifiedColonies.push(simplifiedColony)
        })
        colonies.filter(colony => colony.game === reportingColony.game).forEach(colony => {
          let data = {
            materials: config.materials,
            chat: config.chat,
            inventoryBonusLimit: config.inventoryBonusLimit,
            inventoryCriticalLimit: config.inventoryCriticalLimit,
            yourName: colony.name,
            yourSpecilisations: colony.specilisations,
            yourStartingInventory: colony.inventory,
            colonies: simplifiedColonies
          }
          server.send('setup', data).toClient(colony.id)
        })

        // sendColoniesInventories(server)
        setInterval(() => gameloop(server), 1000)
        DatabaseHandler.logEvent('game ' + reportingColony.game + ' started with [' + colonies.filter(colony => colony.game === reportingColony.game).map(colony => colony.id).join(',') + ']')
      }
    }
  },
  setup: (server) => {
    console.log('PREPARING SERVER FOR STAGE', server.getCurrentStage())

    let networkPlayers = server.getPlayers()
      .map((a) => ({sort: Math.random(), value: a}))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.value)

    for (let i = 0; i < networkPlayers.length; i++) {
      let colony = JSON.parse(JSON.stringify(config.players[i % config.players.length]))
      colony.id = networkPlayers[i]
      colony.ready = false
      colony.game = Math.floor(i / config.players.length)
      colonies.push(colony)
    }
  },
  teardown: (server) => {
    console.log('CLEANUP SERVER AFTER STAGE', server.getCurrentStage())
  },
  options: {}
}

let tickcount = 0
let gameloop = (server) => {
  colonies.forEach(colony => {
    config.materials.forEach(material => {
      if (!colony.dead) { // if a colony have 0 materials left, it is dead and should not be updated
        if (colony.inventory.find(colmat => material.name === colmat.name).amount - material.depletion_rate <= 0) {
          killColony(server, colony, material.name)
        } else {
          colony.inventory.find(colmat => material.name === colmat.name).amount -= material.depletion_rate
        }
      }
    })
  })

  tickcount++
  if (tickcount % 100 === 0) { // every 100th second, set the clients inventory, it might have drifted
    sendColoniesInventories(server)
    colonies.forEach(colony => {
      let inventory = []
      colony.inventory.map(row => inventory.push(
        {
          name: row.name,
          amount: row.amount
        }
      ))
      DatabaseHandler.logInventory(colony.id, inventory)
    })
  }
}

let killColony = (server, colony, materialName) => {
  colony.dead = true
  colony.inventory.find(row => materialName === row.name).amount = 0
  server.send('colonyDied', colony.name).toClients(colonies.filter(col => col.game === colony.game).map(colony => colony.id))
  DatabaseHandler.logEvent(colony.id + ' has died')
}

let sendColoniesInventories = (server) => {
  if (config.tooltip.includes('inventories')) {
    for (let i = 0; i < config.numberOfGames; i++) {
      let inventories = []
      colonies.filter(colony => colony.game === i).forEach(colony =>
        inventories.push({
          name: colony.name,
          inventory: colony.inventory
        })
      )
      server.send('inventories', inventories).toClients(colonies.filter(colony => colony.game === i).map(colony => colony.id))
    }
  } else {
    colonies.forEach(colony => {
      let inventories = [{
        name: colony.name,
        inventory: colony.inventory
      }]
      server.send('inventories', inventories).toClient(colony.id)
    })
  }
}
