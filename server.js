const express = require('express')
const redis = require('redis')

const api = require('./api')
const sequelize = require('./lib/sequelize')
const jwt = require('jsonwebtoken');
const secret = 'SuperSecret';
const { connectToDb } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')

//const { requireAuthentication, requireTeacherOrAdminAuth } = require('../lib/auth')

const app = express()
const port = process.env.PORT || 8000
const queue = 'rosters'

app.use(express.json())
app.use(express.static('public'))

const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT || 6379

const redisClient = redis.createClient(redisHost, redisPort)

const rateLimitMaxRequests = 10
const rateLimitMaxAuthRequests = 30
const rateLimitWindowMs = 60000


async function rateLimit(req, res, next) {
  const ip = req.ip
  const authHeader = req.get('authorization') || ''
  const authHeaderParts = authHeader.split(' ');
  const token = authHeaderParts[0] == 'Bearer' ? authHeaderParts[1] : null
  try {
    const payload = jwt.verify(token, secret)
    req.user = payload.sub
    let tokenBucket
    try {
      tokenBucket = await redisClient.hGetAll(ip)
      console.log("tokenBucket: ", tokenBucket)
    } catch (e) {
      console.log(e)
      next()
      return
    }
    console.log("== tokenBucket:", tokenBucket)
    tokenBucket = {
      tokens: parseFloat(tokenBucket.tokens) || rateLimitMaxAuthRequests,
      last: parseInt(tokenBucket.last) || Date.now()
    }
    console.log("== tokenBucket:", tokenBucket)

    const now = Date.now()
    const ellapsedMs = now - tokenBucket.last
    tokenBucket.tokens += ellapsedMs * (rateLimitMaxAuthRequests / rateLimitWindowMs)
    tokenBucket.tokens = Math.min(rateLimitMaxAuthRequests, tokenBucket.tokens)
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
  } catch (err) {
    let tokenBucket
    try {
      tokenBucket = await redisClient.hGetAll(ip)
      console.log("tokenBucket: ", tokenBucket)
    } catch (e) {
      console.log(e)
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