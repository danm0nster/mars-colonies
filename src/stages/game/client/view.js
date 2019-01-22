import {Model} from './model'

let createView = () => {
  let inventoryBonusLimit
  let inventoryCriticalLimit
  let productionCountDown = 0
  let productionCountTotal = 0

  let tradeRoutes

  let tooltip
  let canvas

  let setupEvent = (client, data) => {
    inventoryBonusLimit = data.inventoryBonusLimit
    inventoryCriticalLimit = data.inventoryCriticalLimit

    // chat
    if (Array.isArray(data.chat) && data.chat.length > 0) {
      $('#chat-input-bar').append('<div class="input-group-prepend">' +
        '<span class="input-group-text" id="input-label"></span>' +
        '</div>' +
        '<select class="form-control" id="chat-input"></select>' +
        '<div class="input-group-prepend-append">' +
        '<button class="btn btn-default" id="chat-button">send</button>' +
        '</div>')
      data.chat.forEach(sentence => $('#chat-input').append('<option>' + sentence + '</option>'))
      $('#input-label').append(Model.thisColony().name)
      $('#chat-button').mouseup(e => {
        e.preventDefault()
        client.send('chat', $('#chat-input').val())
        $('#chat-input').val($('#chat-input option:first').val())
      })
    } else if (data.chat === 'free') {
      $('#chat-input-bar').append('<div class="input-group-prepend">' +
        '<span class="input-group-text" id="input-label"></span>' +
        '</div>' +
        '<input type="text" class="form-control" id="chat-input" placeholder="write a message">' +
        '<div class="input-group-prepend-append">' +
        '<button class="btn btn-default" id="chat-button">send</button>' +
        '</div>')
      $('#input-label').append(Model.thisColony().name)
      $('#chat-input').keypress((e) => {
        if (e.which === 13) {
          client.send('chat', $('#chat-input').val())
          $('#chat-input').val('')
        }
      })
      $('#chat-button').mouseup(e => {
        e.preventDefault()
        if ($('#chat-input').val() !== '') {
          client.send('chat', $('#chat-input').val())
          $('#chat-input').val('')
        }
      })
    } else {
      $('#chat-log').append('chat disabled')
    }

    // trade
    Model.otherColonies().forEach(colony => $('#trade-colony').append('<option>' + colony.name + '</option>'))
    Model.materials().forEach(material => $('#trade-material').append('<option>' + material.name + '</option>'))

    // production
    for (let i = 0; i < Model.thisColony().specilisations.length; i++) {
      let specilisation = Model.thisColony().specilisations[i]
      let option = specilisation.input + ' to ' + specilisation.output + ' (' + specilisation.gain * 100 + '%, ' + specilisation.transform_rate + ')'
      $('#production-material').append('<option value="' + i + '">' + option + '</option>')
    }
  }

  let setupClient = (client) => {
    // -------------------- TRADE --------------------
    $('#trade-button').mouseup(e => {
      e.preventDefault()
      let amount = $('#trade-amount').val()
      // ignore anything that isn't a positive number
      if (amount > 0) {
        client.send('trade', {
          colony: $('#trade-colony').val(),
          material: $('#trade-material').val(),
          amount: amount
        })
      }
    })

    // -------------------- PRODUCTION --------------------
    $('#production-button').mouseup(e => {
      e.preventDefault()
      if (productionCountDown === 0 && $('#production-amount').val() > 0) {
        client.send('produce', {
          index: $('#production-material').val(),
          amount: $('#production-amount').val()
        })
        productionCountDown = Model.thisColony().specilisations[$('#production-material').val()].transform_rate
        productionCountTotal = productionCountDown
        $('#production-progress').html('production ' + (productionCountTotal - productionCountDown) / productionCountTotal * 100 + '% done')
        productionCountDown--
        // countdown loop
        let intervalRef = setInterval(() => {
          if (productionCountDown <= 0) {
            $('#production-progress').html('production finished')
            clearInterval(intervalRef)
          } else {
            $('#production-progress').html('production ' + (productionCountTotal - productionCountDown) / productionCountTotal * 100 + '% done')
            productionCountDown--
          }
        }, 1000)
      }
    })
  }

  // setting up the map
  let setupMap = (client) => {
    canvas = new fabric.Canvas('map-canvas', {
      selection: false,
      width: 590,
      height: 320,
      backgroundColor: null
    })
    canvas.clear()

    let centerX = 590 / 2
    let centerY = 320 / 2 - 10

    // the center colony
    let centerNode = new fabric.Rect({
      left: centerX,
      top: centerY,
      fill: 'grey',
      width: 20,
      height: 20,
      angle: 45,
      selectable: false,
      stroke: 'black',
      strokeWidth: 1
    })
    canvas.add(centerNode)

    // the surrounding colonies
    // as the game is not designed for more than 6 to 10 players, this is enough, any more nodes than these will be Grey
    let colors = ['Green', 'Red', 'Blue', 'Pink', 'Yellow', 'Indigo', 'Violet', 'Orange', 'Cyan', 'LightGreen', 'CadetBlue', 'Brown', 'Lime', 'Wheat', 'Grey']
    let angleBetweenColonies = 2 * Math.PI / Model.otherColonies().length
    for (let i = 0; i < Model.otherColonies().length; i++) {
      let angle = angleBetweenColonies * i + Math.PI / 3.5
      let radius = 80
      let x = Math.sin(angle) * radius + centerX
      let y = Math.cos(angle) * radius + centerY
      let colorIndex = i < colors.length ? i : colors.length - 1
      let rect = new fabric.Rect({
        left: x,
        top: y,
        fill: colors[colorIndex],
        width: 20,
        height: 20,
        angle: 45,
        selectable: false,
        stroke: 'black',
        strokeWidth: 1
      })
      canvas.add(rect)
      Model.otherColonies()[i]['node'] = rect
    }

    // on mouse over a colony that is not our own, a tooltip is shown with information
    canvas.on('mouse:over', (e) => {
      if (e.target) {
        let colony = Model.otherColonies().find(colony => colony['node'] === e.target)
        if (colony) {
          tooltip = createTooltip(colony, e.target.left + 20, e.target.top + 20)
          canvas.add(tooltip)
          client.send('mouseover-colony', colony.name)
        }
      }
    })
    // the tooltip is cleared when the mouse is not hovering over the colony anymore
    canvas.on('mouse:out', (e) => {
      if (e.target) {
        let colony = Model.otherColonies().find(colony => colony['node'] === e.target)
        if (colony) {
          canvas.remove(tooltip)
          tooltip = undefined
        }
      }
    })

    // creating trade routes for displaying visual cues when a transfer of material has happened
    tradeRoutes = []
    let doneRoutes = []
    let yOffset = 15
    Model.otherColonies().forEach(startColony => {
      // route to the center
      let start = {x: startColony.node.left, y: startColony.node.top + yOffset}
      let main = {x: centerNode.left, y: centerNode.top + yOffset}
      let line = [main.x, main.y, start.x, start.y]
      let tradeRouteToMain = new fabric.Line(line, { fill: '', stroke: 'black', strokeWidth: 2, selectable: false, objectCaching: false })
      tradeRouteToMain.startColony = Model.thisColony()
      tradeRouteToMain.endColony = startColony
      canvas.add(tradeRouteToMain)
      tradeRoutes.push(tradeRouteToMain)

      // route to other colonies
      Model.otherColonies().forEach(endColony => {
        let end = {x: endColony.node.left, y: endColony.node.top + yOffset}

        let isConnected = false
        tradeRoutes.forEach(route => {
          if (route.startColony.name === endColony.name &&
            route.endColony.name === startColony.name) {
            isConnected = true
          }
        })

        // the connection between other colonies should not be straight, as it
        // would go through this colonies node in the center, so a curved
        // line is used
        if (startColony.name !== endColony.name && !isConnected) {
          let path = 'M ' + start.x + ' ' + start.y + ' Q 0 ' + end.x + ' ' + end.y
          let tradeRoute = new fabric.Path(path, { fill: '', stroke: 'black', strokeWidth: 2, selectable: false, objectCaching: false })

          tradeRoute.startColony = startColony
          tradeRoute.endColony = endColony
          doneRoutes.push({sX: start.x, sY: start.y, eX: end.x, eY: end.y})

          tradeRoute.path[0][1] = start.x
          tradeRoute.path[0][2] = start.y

          let center = { // centerpoint of line
            x: Math.min(start.x, end.x) + Math.abs(start.x - end.x) / 2,
            y: Math.min(start.y, end.y) + Math.abs(start.y - end.y) / 2
          }
          let vector
          // if the center is close to main, rotate the vector
          if (center.x - main.x < 0.01 && center.x - main.x > -0.01 &&
            center.y - main.y < 0.01 && center.y - main.y > -0.01) {
            vector = {
              x: center.x - start.x,
              y: center.y - start.y
            }
            vector = {x: vector.y * -1, y: vector.x}
          // vector from centerpoint of circle to centerpoint of line
          } else {
            vector = {
              x: center.x - main.x,
              y: center.y - main.y
            }
          }
          let len = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2))
          let mult = Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2)) / 4
          tradeRoute.path[1][1] = center.x + vector.x * mult / len // normalize and magnify
          tradeRoute.path[1][2] = center.y + vector.y * mult / len // normalize and magnify

          tradeRoute.path[1][3] = end.x
          tradeRoute.path[1][4] = end.y

          tradeRoute.selectable = false
          canvas.add(tradeRoute)
          tradeRoutes.push(tradeRoute)
        }
      })
    })
    canvas.getObjects().filter(object => object.type === 'rect').forEach(rect => canvas.bringToFront(rect))
  }

  // update this colonies inventory
  let updateInventory = () => {
    $('#inventory').find('tbody').empty()
    Model.thisColony().inventory.forEach(row => {
      let amountColor = row.amount > inventoryBonusLimit ? 'inventory-bonus' : row.amount < inventoryCriticalLimit ? 'inventory-critial' : 'inventory-low'
      $('#inventory').find('tbody').append('<tr><th scope="row">' + row.name + '</th><td class="' + amountColor + '">' + row.amount + '</td></tr>')
    })
  }

  // if there is a tooltip showing, it should be updated, this is done by removing the old and creating a new one
  let updateTooltip = () => {
    if (tooltip) {
      let newtooltip = createTooltip(tooltip.colony, tooltip.left, tooltip.top)
      canvas.remove(tooltip)
      tooltip = newtooltip
      canvas.add(tooltip)
    }
  }

  // create and return a tooltip with the appropiate information
  let createTooltip = (colony, left, top) => {
    let height = 16 + (colony.inventory ? 16 + 16 * colony.inventory.length : 0) + (colony.specilisations ? 16 + 16 * colony.specilisations.length : 0) + 3
    let adjustedTop = top + height + 4 > canvas.height ? canvas.height - height - 4 : top
    let tooltipBackground = new fabric.Rect({
      left: left,
      top: adjustedTop,
      width: 125,
      height: height,
      fill: 'black',
      stroke: 'grey',
      opacity: 0.75,
      strokeWidth: 1
    })
    // only display information if it is pressen on the colony
    let text = colony.name +
      (colony.inventory ? '\nInventory:\n' + colony.inventory.map(row => '- ' + row.name + ': ' + row.amount).join('\n') : '') +
      (colony.specilisations ? '\nSpecilisations:\n' + colony.specilisations.map(row => '- ' + row.input + ' to ' + row.output).join('\n') : '')
    let tooltipText = new fabric.Text(text, {
      left: left + 3,
      top: adjustedTop + 3,
      width: 100,
      height: 100,
      fontSize: 12,
      fill: 'white'
    })
    let newtooltip = new fabric.Group([tooltipBackground, tooltipText])
    newtooltip.colony = colony
    return newtooltip
  }

  let trade = (transfer) => {
    // when a trade has happened, the route between sender and receiver is
    // found and flashed white for a second as a visual cue to the participant
    // that a trade has happened
    let sendingColony = Model.otherColonies().find(colony => colony.name === transfer.sender) || Model.thisColony()
    let receivingColony = Model.otherColonies().find(colony => colony.name === transfer.receiver) || Model.thisColony()
    let route = tradeRoutes.find(route => (route.startColony === sendingColony && route.endColony === receivingColony) ||
      (route.startColony === receivingColony && route.endColony === sendingColony))
    route.stroke = 'white'
    canvas.requestRenderAll()
    setTimeout(() => {
      route.stroke = 'black'
      canvas.requestRenderAll()
    }, 1000)
  }

  let addChatMessage = (message) => {
    let chatLog = $('#chat-log')
    chatLog.append(message + '\n')
    chatLog.scrollTop(chatLog[0].scrollHeight)
  }

  let gameover = (status) => {
    // when the game is over, ei time is up, the client receives a 'gameover'
    // The 'status' contains what points each colony earned
    addChatMessage('game over\n' + status)
    disableEverything()
  }

  let killColony = (colonyName) => {
    // when a colony runs out of a material, it dies
    if (Model.thisColony().name === colonyName) {
      disableEverything()
    }
    addChatMessage(colonyName + ' have died')
  }

  // when this colony is dead or the game is over, disable all buttons and
  // inputfields
  let disableEverything = () => {
    $('#trade-colony').prop('disabled', true)
    $('#trade-material').prop('disabled', true)
    $('#trade-amount').prop('disabled', true)
    $('#trade-button').prop('disabled', true)
    $('#production-material').prop('disabled', true)
    $('#production-amount').prop('disabled', true)
    $('#production-button').prop('disabled', true)
  }

  return {
    setupEvent,
    setupClient,
    setupMap,
    updateInventory,
    updateTooltip,
    createTooltip,
    trade,
    addChatMessage,
    gameover,
    killColony
  }
}

export const View = createView()
