const { Router } = require('express')
const router = Router()

const { ValidationError } = require('sequelize')

const { User, UserClientFields } = require('../models/user')

router.post('/', async function (req, res) {
    try {
        const user = await User.create(req.body, UserClientFields)
        res.status(201).send({ id: user.id })
    }
    catch (e) {
        if (e instanceof ValidationError) {
            res.status(400).send({ error: e.message })
        }
        else {
            throw e
        }
    }
})

module.exports = router