const jwt = require('jsonwebtoken');

const { Course } = require('../models/course')

const secret = 'SuperSecret';

function generateAuthToken(userid) {
    const payload = { sub: userid }
    return jwt.sign(payload, secret, { expiresIn: '24h' })
}
exports.generateAuthToken = generateAuthToken

function requireAuthentication(req, res, next) {
    const authHeader = req.get('authorization') || ''
    const authHeaderParts = authHeader.split(' ');
    const token = authHeaderParts[0] == 'Bearer' ? authHeaderParts[1] : null

    try {
        const payload = jwt.verify(token, secret)
        req.user = payload.sub
        next()
    } catch (err) {
        res.status(401).send({
            err: "Invalid Authentication Token"
        })
    }
}

exports.requireAuthentication = requireAuthentication

async function requireTeacherOrAdminAuth(req, res, next) {
    const authHeader = req.get('authorization') || ''
    const authHeaderParts = authHeader.split(' ');
    const token = authHeaderParts[0] == 'Bearer' ? authHeaderParts[1] : null

    try {
        const payload = jwt.verify(token, secret)
        const userId = payload.sub
        const user = await User.findByPk(userId)
        if (user.role != "admin") {
            const course = await Course.findByPk(req.body.courseId)
            if (!course) {
                res.status(400).send({error: "The request body was either not present or did not contain a valid Assignment object."})
            }
            else {
                if (course.instructorId != user.id) {
                    res.status(403).send({ error: "Only an authenticated User with 'admin' role or an authenticated 'instructor' User whose ID matches the `instructorId` of the Course corresponding to the Assignment's `courseId` can create an Assignment" })
                }
            }
        }
        next()
    } catch (err) {
        res.status(401).send({
            err: "Invalid Authentication Token"
        })
    }
}

exports.requireTeacherOrAdminAuth = requireTeacherOrAdminAuth