const jwt = require('jsonwebtoken');

const { User } = require('../models/user')

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

async function requireTeacherOrAdminAuth(userId, course) {
    const user = await User.findByPk(userId)
    if (user.role != "admin" && !(course.instructorId == userId)) {
        return 403
    }
    return 0
}

exports.requireTeacherOrAdminAuth = requireTeacherOrAdminAuth