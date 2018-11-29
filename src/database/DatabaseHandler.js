const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

let createDatabaseHandler = () => {
  let filename = './src/database/logs/' + Date.now() + '.json'
  let adapter = new FileSync(filename)
  let db = low(adapter)
  db.defaults({
    chat: [],
    production: [],
    trade: [],
    inventory: [],
    logMouseOverColony: [],
    events: []
  }).write()

  let logChat = (clientId, message) => {
    let event = {
      id: clientId,
      time: Date.now(),
      message: message
    }
    db.get('chat').push(event).write()
  }

  let logProduction = (clientId, material, amount) => {
    let event = {
      id: clientId,
      time: Date.now(),
      material: material,
      amount: Math.floor(amount)
    }
    db.get('production').push(event).write()
  }

  let logTrade = (clientId, receiver, material, amount) => {
    let event = {
      id: clientId,
      time: Date.now(),
      receiver: receiver,
      material: material,
      amount: Math.floor(amount)
    }
    db.get('trade').push(event).write()
  }

  let logInventory = (clientId, inventory) => {
    let event = {
      id: clientId,
      time: Date.now(),
      inventory: inventory
    }
    db.get('inventory').push(event).write()
  }

  let logMouseOverColony = (clientId, colony) => {
    let event = {
      id: clientId,
      time: Date.now(),
      colony: colony
    }
    db.get('logMouseOverColony').push(event).write()
  }

  let logEvent = (data) => {
    let event = {
      time: Date.now(),
      data: data
    }
    db.get('events').push(event).write()
  }

  let exportAsJSON = () => {
    // generate output-json
    let output = {
      chats: db.get('chat').value(),
      productions: db.get('production').value(),
      trades: db.get('trade').value(),
      inventories: db.get('inventory').value(),
      events: db.get('events').value()
    }

    return output
  }

  let exportAsCSV = () => {
    let data = exportAsJSON()
    let files = {}
    Object.keys(data).forEach(logName => {
      let log = data[logName]
      if (log.length > 0) {
        files[logName] = Object.keys(log[0]).join() + '\n' +
          log.map(logEntry => Object.values(logEntry).join()).join('\n')
      }
    })
    return files
  }

  return {
    logChat,
    logProduction,
    logTrade,
    logInventory,
    logMouseOverColony,
    logEvent,
    exportAsJSON,
    exportAsCSV
  }
}

export const DatabaseHandler = createDatabaseHandler()
