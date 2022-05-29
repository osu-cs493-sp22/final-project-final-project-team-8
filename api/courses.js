const { countReset } = require('console')
const e = require('express')
const { Router } = require('express')
const router = Router()

const { ValidationError } = require('sequelize')

const { Course, CourseClientFields } = require('../models/course')
const { User } = require('../models/user')

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

router.post('/', async function (req, res) {
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


module.exports = router