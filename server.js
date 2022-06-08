const express = require('express')
const redis = require('redis')

const api = require('./api')
const sequelize = require('./lib/sequelize')
const { connectToDb } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')

const app = express()
const port = process.env.PORT || 8000
const queue = 'rosters'

app.use(express.json())
app.use(express.static('public'))

const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT || 6379

const redisClient = redis.createClient(redisHost, redisPort)

const rateLimitMaxRequests = 10
const rateLimitWindowMs = 60000

async function rateLimit(req, res, next) {
  const ip = req.ip
  // const tokenBucket = await getUserTokenBucket(ip)

  let tokenBucket
  try {
    tokenBucket = await redisClient.hGetAll('123.45.67.89')
  } catch (e) {
    next()
    return
  }
  console.log("== tokenBucket:", tokenBucket)
  tokenBucket = {
    tokens: parseFloat(tokenBucket.tokens) || rateLimitMaxRequests,
    last: parseInt(tokenBucket.last) || Date.now()
  }
  console.log("== tokenBucket:", tokenBucket)

  const now = Date.now()
  const ellapsedMs = now - tokenBucket.last
  tokenBucket.tokens += ellapsedMs * (rateLimitMaxRequests / rateLimitWindowMs)
  tokenBucket.tokens = Math.min(rateLimitMaxRequests, tokenBucket.tokens)
  tokenBucket.last = now

  if (tokenBucket.tokens >= 1) {
    tokenBucket.tokens -= 1
    await redisClient.hSet(ip, [['tokens', tokenBucket.tokens], ['last', tokenBucket.last]])
    // await redisClient.hSet(ip)
    next()
  } else {
    await redisClient.hSet(ip, [['tokens', tokenBucket.tokens], ['last', tokenBucket.last]])
    // await redisClient.hSet(ip)
    res.status(429).send({
      err: "Too many requests per minute"
    })
  }
}











/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */

app.use(rateLimit)

app.use('/', api)

app.use('*', (err, req, res, next) => {
  console.error(err);
  res.status(500).send({
	  err: "An error occurred.  Try again later."
  });
});

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  })
})

sequelize.sync().then(function() {
  connectToDb(async () => {
    await connectToRabbitMQ(queue)
    app.listen(port, function () {
      console.log("== Server is running on port", port)
    })
  })
})