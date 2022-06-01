const { countReset } = require('console')
const express = require('express')
const { Router } = require('express')
const router = Router()

const { ValidationError } = require('sequelize')

const { Course, CourseClientFields } = require('../models/course')
const { Enrollment, EnrollmentClientFields } = require('../models/enrollment')
const { User } = require('../models/user')
const { Assignment } = require('../models/assignment')

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
router.post('/', async function (req, res, next) {
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
    
})

router.get('/:id', async function (req, res, next) {
    try {
        const course = await Course.findOne({ where: { id: req.params.id } })
        if (course) {
            res.status(200).send(course)
        }
        else {
            next()
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
router.patch('/:id', async function (req, res) {
    const id = req.params.id
    const course = Course.findOne({ where: { id: id } })
    if (!course)
        res.status(404).send({error: "Specified Course `id` not found"})
    else {
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
})

//requires admin auth
router.delete('/:id', async function (req, res, next) {
    const id = req.params.id
    const course = Course.findOne({ where: { id: id } })
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
})

//requires course instructor or any admin auth
router.get('/:id/students', async function (req, res) {
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
        res.status(200).send({students: students})
    }
})

//requires course instructor or any admin auth
router.post('/:id/students', async function (req, res) {
    if (req.body.students) {
        const id = req.params.id
        const course = await Course.findByPk(id)
        if (!course)
            res.status(404).send({error: "Specified Course `id` not found"})
        else {
            await Enrollment.destroy({ where: { courseId: id } })
            try {
                req.body.students.forEach(async (student) => {
                    const enroll = {
                        userId: student,
                        courseId: id
                    }
                    await Enrollment.create(enroll, EnrollmentClientFields)
                })
                res.status(200).send()
            }
            catch(e) {
                res.status(400).send({error: e})
            }
        }
    }
    else {
        res.status(400).send("The request body was either not present or did not contain the fields described above.")
    }
})

//requires course instructor or any admin auth
router.get('/:id/roster', async function (req, res) {
    const id = req.params.id
    const course = await Course.findByPk(id)
    if (!course)
        res.status(404).send({error: "Specified Course `id` not found"})
    else {
        res.status(200).send("This endpoint has not been finished yet")
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