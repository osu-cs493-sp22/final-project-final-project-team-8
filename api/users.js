const { Router } = require('express')
const router = Router()
const { ValidationError } = require('sequelize')
const jwt = require('jsonwebtoken')
const secret = 'SuperSecret'
const bcrypt = require('bcryptjs')

const { User, UserClientFields } = require('../models/user')
const { Course, courseClientFields } = require('../models/course')
const { generateAuthToken, requireAuthentication } = require('../lib/auth')

router.post('/', async function (req, res) {
    if (req.body && req.body.firstName && req.body.lastName && req.body.email && req.body.role && req.body.password) {
        if (req.body.role == "admin" || req.body.role == "instructor") {
            const authHeader = req.get('authorization') || ''
            const authHeaderParts = authHeader.split(' ')
            const token = authHeaderParts[0] == 'Bearer' ? authHeaderParts[1] : null
            var payload
            try {
                payload = jwt.verify(token, secret)
            } catch (err) {
                res.status(401).send({
                    err: "Invalid Authentication Token"
                })
            }
            const user = await User.findAll({ where: { id: payload.sub } })
            if (user[0].role != "admin") {
                res.status(401).send({
                    err: "Admin permissions required to create new admin or instructor"
                })
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
                    res.status(400).send({ error: e.message })
                } else {
                    throw e
                }
            }
        }
    } else {
        res.status(400).send({ err: "Request body not filled" })
    }
})

router.post('/login', async function (req, res) {
    if (req.body && req.body.password && req.body.email) {
        const user = await User.findAll({ where: { email: req.body.email } })
        var authenticated = false
        if (user[0]) {
            authenticated = user && await bcrypt.compare(
                req.body.password,
                user[0].dataValues.password
            )
        }
        if (authenticated) {
            const token = generateAuthToken(user[0].dataValues.id)
            res.status(200).send({ token: token })
        } else {
            res.status(401).send({
                error: "Invalid credentials"
            })
        }
    } else {
        res.status(400).send({
            error: "Request body requires an email and password"
        })
    }
})

router.get('/:id', requireAuthentication, async function (req, res) {
    const authenticatedUser = await User.findAll({ where: { id: req.user } })
    var adminCheck = false
    if (authenticatedUser[0]) {
        adminCheck = true
    }
    if (req.user == req.params.id || adminCheck) {
        var user = await User.findAll({ where: { id: req.params.id } })
        if (user[0] && user[0].role == "instructor") {
            const courses = Course.findAll({ attributes: ['id'], where: { instructorId: req.params.id } })
            user[0] = {
                id: user[0].id,
                firstName: user[0].firstName,
                lastName: user[0].lastName,
                email: user[0].email,
                role: user[0].role,
                courses: courses
            }
        }
        else if (user[0] && user[0].role == "student") {
            const courses = []
            user[0] = {
                id: user[0].id,
                firstName: user[0].firstName,
                lastName: user[0].lastName,
                email: user[0].email,
                role: user[0].role,
                courses: courses
            }
        }
        else {
            user[0] = {
                id: user[0].id,
                firstName: user[0].firstName,
                lastName: user[0].lastName,
                email: user[0].email,
                role: user[0].role
            }
        }
        res.status(200).json({
            user: user[0]
        })
    } else {
        res.status(401).send({
            err: "Invalid credentials"
        })
    }
})

module.exports = router