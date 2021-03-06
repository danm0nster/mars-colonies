import {Logger} from '../../../database/logger'
import {PaymentHandler} from '../../../database/PaymentHandler'
import {Events} from 'monsterr'

let completedSurveys = []

export default {
  commands: {
    'endGame': (server) => {
      console.log('Admin forced end stage')
      finishStage(server)
    }
  },
  events: {
    'ready': (server, clientId) => {
      server.log('client reported ready: ' + clientId)
      let results = PaymentHandler.getResults()
      server.send('setup', results).toClient(clientId)
    },
    'save': function (server, clientId, data) {
      server.log('client saved information: ' + clientId)
      PaymentHandler.saveParticipantInformation(clientId, data)

      completedSurveys.push(clientId)
      let str = completedSurveys.length + '/' + server.getPlayers().length + ' has finished paymentsurvey, just now: ' + clientId
      Logger.logEvent(server, -1, str)
      server.send('logged', str).toAdmin()

      if (completedSurveys.length >= server.getPlayers().length) {
        // server.send('downloadReady', 'payment').toAdmin()
        finishStage(server)
      }
    },
    [Events.CLIENT_RECONNECTED]: (server, clientId) => {
      server.log('client reconnect: ' + clientId)
      // when a client reconnects, wait for about 1 second to let it rebuild
      // the page and then send it the correct stage and data

      setTimeout(() => {
        let stageNo = server.getCurrentStage().number
        server.send(Events.START_STAGE, stageNo).toClient(clientId)
      }, 1000)
    }
  },
  setup: (server) => {
    console.log('PREPARING SERVER FOR STAGE', server.getCurrentStage())
    Logger.logEvent(server, -1, 'starting payment stage (' + server.getCurrentStage().number + ')')
    PaymentHandler.randomizePayout()
  },
  teardown: (server) => {
    console.log('CLEANUP SERVER AFTER STAGE', server.getCurrentStage())
  },
  options: {}
}

let finishStage = (server) => {
  // delayed as to wait for file writing to be finished
  setTimeout(() => {
    Logger.savePaymentCSV(server.getCurrentStage().number)
  }, 500)
  setTimeout(() => {
    Logger.exportSavedAsZip(server) // pack all data and send it to the admin
  }, 1000)
}
