import {Logger} from '../../../database/logger'
import {PaymentHandler} from '../../../database/PaymentHandler'

export default {
  commands: {},
  events: {
    'ready': (server, clientId) => {
      server.log('client reported ready: ' + clientId)
      server.send('setup', PaymentHandler.getPayout(clientId)).toClient(clientId)
    },
    'save': function (server, clientId, data) {
      server.log('client saved information: ' + clientId)
      Logger.logEvent(server, 'client saved information: ' + clientId)
      PaymentHandler.saveParticipantInformation(clientId, data)
    }
  },
  setup: (server) => {
    console.log('PREPARING SERVER FOR STAGE', server.getCurrentStage())
    Logger.logEvent(server, 'starting payment stage (' + server.getCurrentStage().number + ')')
  },
  teardown: (server) => {
    console.log('CLEANUP SERVER AFTER STAGE', server.getCurrentStage())
  },
  options: {}
}
