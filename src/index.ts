import { Context } from 'koishi-core'
import WebSocket from 'ws'

export interface Config {}

type numeric = string

interface TickersData {
  instType: 'SPOT'
  instId: string
  last: numeric
  lastSz: numeric
  askPx: numeric
  askSz: numeric
  bidPx: numeric
  bidSz: numeric
  open24h: numeric
  high24h: numeric
  low24h: numeric
  sodUtc0: numeric
  sodUtc8: numeric
  vol24h: numeric
  volCcy24h: numeric
  ts: numeric
}

export const name = 'cryptocurrency'

export function apply(ctx: Context, config: Config = {}) {
  const socket = new WebSocket('wss://ws.okex.com:8443/ws/v5/public', {
    agent: ctx.app.options.axiosConfig?.httpsAgent,
    handshakeTimeout: 5000,
  })

  socket.on('error', (err) => {
    console.log(err)
  })

  socket.on('open', () => {
    console.log('socked opened')
    socket.send('ping')
  })

  socket.on('close', () => {
    console.log('socket closed')
  })

  const tickers: Record<string, ((data: TickersData) => void)[]> = {}

  let timer: NodeJS.Timeout
  socket.on('message', (payload) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send('ping')
    }, 25000)
    if (payload !== 'pong') {
      const { arg, data, event, msg } = JSON.parse(payload.toString())
      if (event === 'error') {
        console.log(msg)
      } else if (event === 'subscribe') {
        // placeholder
      } else if (arg.channel === 'tickers') {
        const callbacks = tickers[arg.instId.toUpperCase()]
        if (callbacks) {
          callbacks.forEach(cb => cb(data[0]))
          callbacks.splice(0, Infinity)
        }
      } else {
        console.log(payload)
      }
    }
  })

  ctx.before('disconnect', () => {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.close()
  })

  ctx.command('cc [name]')
    .example('cc xch')
    .action((_, name) => {
      if (!name) return '请输入要查询的币种。'
      name = name.toUpperCase() + '-USDT'
      if (!tickers[name]) {
        tickers[name] = []
        socket.send(JSON.stringify({
          op: 'subscribe',
          args: [{
            channel: 'tickers',
            instId: name,
          }],
        }))
      }
      return new Promise((resolve) => {
        tickers[name].push((data) => {
          resolve([
            name.slice(0, -5),
            `最新价格：${data.last} USDT`,
            `24h 最高：${data.high24h} USDT`,
            `24h 最低：${data.low24h} USDT`,
          ].join('\n'))
        })
      })
    })
}
