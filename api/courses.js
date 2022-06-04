const { Router } = require('express')
const router = Router()
const { generateAuthToken, requireAuthentication, requireTeacherOrAdminAuth } = require('../lib/auth')
const { ObjectId, GridFSBucket } = require('mongodb')
const { connectToRabbitMQ, getChannel } = require('../lib/rabbitmq')
const amqp = require('amqplib')
const queue = 'rosters'

const { ValidationError } = require('sequelize')

const { Course, CourseClientFields } = require('../models/course')
const { Enrollment, EnrollmentClientFields } = require('../models/enrollment')
const { User } = require('../models/user')
const { Assignment } = require('../models/assignment')
const { getDbReference } = require('../lib/mongo')

router.get('/', async function (req, res) {
    let page = parseInt(req.query.page) || 1
    page = page < 1 ? 1 : page
    const numPerPage = 10
    const offset = (page - 1) * numPerPage
    
    var where = {}
    const subject = req.query.subject ? req.query.subject : null
    const number = req.query.number ? req.query.number : null
    const term = req.query.term ? req.query.term : null
    if (subject)
        where.subject = subject
    if (number)
        where.number = number
    if (term)
        where.term = term

    const result = await Course.findAndCountAll({
        where: where,
        limit: numPerPage,
        offset: offset
    })

    const lastPage = Math.ceil(result.count / numPerPage)
    const links = {}
    if (page < lastPage) {
        links.nextPage = `/courses?page=${page + 1}`
        links.lastPage = `/courses?page=${lastPage}`
    }
    if (page > 1) {
        links.prevPage = `/courses?page=${page - 1}`
        links.firstPage = '/courses?page=1'
    }

    res.status(200).json({
        courses: result.rows,
        pageNumber: page,
        totalPages: lastPage,
        pageSize: numPerPage,
        totalCount: result.count,
        links: links
      })
})

//only an admin can create a course
router.post('/', requireAuthentication, async function (req, res, next) {
    const user = await User.findByPk(req.user)
    if (user.role == "admin") {
        if (req.body.instructorId) {
            try {
                const user = await User.findOne({ where: { id: req.body.instructorId }})
                if (user && user.role == "instructor") {
                    const course = await Course.create(req.body, CourseClientFields)
                    res.status(201).send({ id: course.id })
                }
                else {
                    throw new ValidationError(`Instructor with id ${req.body.instructorId} does not exist`)
                }
            }
            catch (e) {
                if (e instanceof ValidationError) {
                    res.status(400).send({ error: e.message })
                }
                else {
                    console.log(e)
                    next(e)
                }
            }
        }
        else {
            res.status(400).send({ error: "Must include instructorId" })
        }
    }
    else {
        res.send(403).send({ error: "Only an authenticated User with 'admin' role can create a new Course" })
    }
})

router.get('/:id', async function (req, res, next) {
    try {
        const course = await Course.findOne({ where: { id: req.params.id } })
        if (course) {
            res.status(200).send(course)
        }
        else {
            res.status(404).send({ error: "Specified course id not found" })
        }
    }
    catch(e) {
        console.log(e)
        res.status(500).send({
            error: `Unable to fetch course with id: ${req.params.id}`
        })
    }
    
})

//requires course instructor or any admin auth
router.patch('/:id', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const course = await Course.findOne({ where: { id: id } })
    if (!course) {
        res.status(404).send({error: "Specified Course `id` not found"})
    } else {
        const auth = await requireTeacherOrAdminAuth(req.user, course)
        switch (auth) {
            case 403:
                res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                break
            default:
                const result = await Course.update(req.body, {
                    where: { id: id },
                    fields: CourseClientFields
                })
                if (result[0] > 0)
                    res.status(204).send()
                else {
                    res.status(400).send({ error: "The request body was either not present or did not contain any fields related to Course objects."})
                }
        }
    }
})

//requires admin auth
router.delete('/:id', requireAuthentication, async function (req, res, next) {
    const user = await User.findByPk(req.user)
    if (user.role == "admin") {
        const id = req.params.id
        const course = await Course.findOne({ where: { id: id } })
        if (!course)
            res.status(404).send({error: "Specified Course `id` not found"})
        else {
            try {
                await Course.destroy({ where: { id: id } })
                res.status(204).send()
            }
            catch(e) {
                next(e)
            }
        }
    }
    else {
        res.status(403).send({ error: "Only an authenticated User with 'admin' role can delete a Course" })
    }
})

//requires course instructor or any admin auth
router.get('/:id/students', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const course = await Course.findByPk(id, {
        include: [
            {
                model: User,
                through: {attributes: []},
                where: {
                    role: "student"
                },
                attributes: {
                    exclude: ["password"]
                }
            }
        ]
    })
    const students = course.users
    if (!course)
        res.status(404).send({error: "Specified Course `id` not found"})
    else {
        const auth = await requireTeacherOrAdminAuth(req.user, course)
        switch (auth) {
            case 403:
                res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                break
            default:
                res.status(200).send({students: students})
        }
    }
})

//requires course instructor or any admin auth
router.post('/:id/students', requireAuthentication, async function (req, res) {
    if (req.body.enroll || req.body.unenroll) {
        const id = req.params.id
        const course = await Course.findByPk(id)
        if (!course)
            res.status(404).send({error: "Specified Course `id` not found"})
        else {
            const auth = await requireTeacherOrAdminAuth(req.user, course)
            switch (auth) {
                case 403:
                    res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                    break
                default:
                    req.body.unenroll.forEach(async (student) => {
                        await Enrollment.destroy({ where: { courseId: id, userId: student } })
                    })
                    try {
                        req.body.enroll.forEach(async (student) => {
                            const enroll = {
                                userId: student,
                                courseId: id
                            }
                            await Enrollment.create(enroll, EnrollmentClientFields)
                        })
                        const channel = getChannel()
                        channel.sendToQueue(queue, Buffer.from(id.toString()))
                        res.status(200).send()
                    }
                    catch(e) {
                        res.status(400).send({error: e})
                    }
            }
        }
    }
    else {
        res.status(400).send("The request body was either not present or did not contain the fields described above.")
    }
})

async function getRosterInfoByCourseId(id) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, { bucketName: 'rosters' })
    const result = await bucket.find({}).toArray()
    var rosterId
    result.forEach(roster => {
        if (roster.metadata.courseId == id) {
            rosterId = roster._id.toString()
        }
    });
    return rosterId
}

function getRosterDownloadStream(id) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, { bucketName: 'rosters' })
    if (!ObjectId.isValid(id)) {
        return null
    } else {
        return bucket.openDownloadStream(new ObjectId(id))
    }
}

//requires course instructor or any admin auth
router.get('/:id/roster', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const course = await Course.findByPk(id)
    if (!course)
        res.status(404).send({error: "Specified Course `id` not found"})
    else {
        const auth = await requireTeacherOrAdminAuth(req.user, course)
        switch (auth) {
            case 403:
                res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                break
            default:
                const rosterId = await getRosterInfoByCourseId(id)
                if (rosterId) {
                    getRosterDownloadStream(rosterId)
                    .on('file', function (file) {
                        res.status(200).type('csv')
                    })
                    .on('error', function(err) {
                        if (err.code == 'ENOENT') {
                            next()
                        } else {
                            next(err)
                        }
                    })
                    .pipe(res)
                } else {
                    res.status(400).send({
                        error: "No roster exists with the given id"
                    })
                }
        }
    }
})

//no auth required
router.get('/:id/assignments', async function (req, res) {
    const id = req.params.id
    const course = await Course.findByPk(id)
    if (!course)
        res.status(404).send({error: "Specified Course `id` not found"})
    else {
        const assignments = await Assignment.findAll({ where: { courseId: id }, attributes: { exclude: ["courseId"] } })
        res.status(200).send({assignments: assignments})
    }
})


module.exports = router