const { Router } = require('express')
const router = Router()
const { ValidationError } = require('sequelize')
const jwt = require('jsonwebtoken')
const secret = 'SuperSecret'
const bcrypt = require('bcryptjs')

const { User, UserClientFields } = require('../models/user')
const { Course, courseClientFields } = require('../models/course')
const { generateAuthToken, requireAuthentication } = require('../lib/auth')
const { Enrollment } = require('../models/enrollment')

router.post('/', async function (req, res) {
    if (req.body && req.body.firstName && req.body.lastName && req.body.email && req.body.role && req.body.password) {
        if (req.body.role == "admin" || req.body.role == "instructor") {
            const authHeader = req.get('authorization') || ''
            const authHeaderParts = authHeader.split(' ')
            const token = authHeaderParts[0] == 'Bearer' ? authHeaderParts[1] : null
            var payload = null
            try {
                payload = jwt.verify(token, secret)
            } catch (err) {
                res.status(403).send({
                    err: "Invalid Authentication Token"
                })
            }
            if (payload) {
                const user = await User.findByPk(payload.sub)
                if (user.role != "admin") {
                    res.status(403).send({
                        err: "Admin permissions required to create new admin or instructor"
                    })
                }
                else {
                    try {
                        const user = await User.create(userToInsert, UserClientFields)
                        res.status(201).send({ id: user.id })
                    }
                    catch(e) {
                        res.status(400).send({ error: "The request body was either not present or did not contain a valid User object." })
                    }
                }
            }
        }
        else {
            try {
                const userToInsert = req.body
                const user = await User.create(userToInsert, UserClientFields)
                res.status(201).send({
                    id: user.id
                })
            } catch (e) {
                if (e instanceof ValidationError) {
                    res.status(400).send({ error: "The request body was either not present or did not contain a valid User object." })
                } else {
                    throw e
                }
            }
        }
    } else {
        res.status(400).send({ error: "The request body was either not present or did not contain a valid User object." })
    }
})

router.post('/login', async function (req, res) {
    if (req.body && req.body.password && req.body.email) {
        const user = await User.findOne({ where: { email: req.body.email } })
        var authenticated = false
        if (user) {
            authenticated = user && await bcrypt.compare(
                req.body.password,
                user.dataValues.password
            )
        }
        if (authenticated) {
            const token = generateAuthToken(user.dataValues.id)
            res.status(200).send({ token: token })
        } else {
            res.status(401).send({
                error: "Invalid credentials"
            })
        }
    } else {
        res.status(400).send({
            error: "The request body was either not present or did not contain all of the required fields."
        })
    }
})

router.get('/:id', requireAuthentication, async function (req, res) {
    const authenticatedUser = await User.findByPk(req.user)
    var adminCheck = false
    if (authenticatedUser.role == "admin") {
        adminCheck = true
    }
    if (req.user == req.params.id || adminCheck) {
        var user = await User.findByPk(req.params.id, { attributes: { exclude: ["password"] }})
        if (user && user.role == "instructor") {
            const courses = await Course.findAll({ raw: true, where: { instructorId: req.params.id } })
            user.dataValues.courses = courses
        }
        else if (user && user.role == "student") {
            user = await User.findByPk(user.id, {
                include: [
                    {
                        model: Course,
                        through: { attributes: [] },
                    }
                ],
                attributes: { exclude: ["password"] }
            })
        }
        res.status(200).send({ user: user })
    } else {
        res.status(401).send({
            err: "Invalid credentials"
        })
    }
})

module.exports = router