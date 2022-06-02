const { Router } = require('express')
const router = Router()

const { Assignment, AssignmentClientFields } = require('../models/assignment')
const { Submission, SubmissionClientFields } = require('../models/submission')
const { requireAuthentication, requireTeacherOrAdminAuth } = require('../lib/auth')
const { Course } = require('../models/course')

//must be authenticated as the course's teacher or an admin
router.post('/', requireAuthentication, async function (req, res) {
    const course = await Course.findByPk(req.body.courseId)
    if (course)
        try {
            const auth = await requireTeacherOrAdminAuth(req.user, course)
            switch (auth) {
                case 403:
                    res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                    break
                default:
                    const assignment = await Assignment.create(req.body)
                    res.status(201).send({ id: assignment.id })
            }
        }
        catch (e) {
            res.status(400).send({ error: "The request body was either not present or did not contain a valid Assignment object." })
        }
    else {
        res.status(400).send({ error: "The request body was either not present or did not contain a valid Assignment object." })
    }
})

//any user
router.get('/:id', async function (req, res) {
    const assignment = await Assignment.findByPk(req.params.id)
    if (assignment)
        res.status(200).send(assignment)
    else {
        res.status(404).send("Specified Assignment `id` not found")
    }
})

//must be authenticated as the course's teacher or an admin
router.patch('/:id', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const assignment = await Assignment.findByPk(id)
    const course = await Course.findByPk(assignment.courseId)
    if (assignment) {
        if (course) {
            const auth = await requireTeacherOrAdminAuth(req.user, course)
            switch (auth) {
                case 403:
                    res.status(403).send({ error: "The request was not made by the teacher of the course or an admin"})
                    break
                default:
                    try {
                        const updated = await Assignment.update(req.body, {
                            where: { id: id },
                            fields: AssignmentClientFields
                        })
                        res.status(200).send()
                    }
                    catch {
                        res.status(400).send({ error: "The request body was either not present or did not contain any fields related to Assignment objects." })
                    }
            }
        }
        else {
            res.status(400).send({ error: "The request body was either not present or did not contain any fields related to Assignment objects." })
        }
    }
    else {
        res.status(404).send("Specified Assignment `id` not found")
    }
})

//must be authenticated as the course's teacher or an admin
router.delete('/:id', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const assignment = await Assignment.findOne({ where: { id: id } })
    if (!assignment)
        res.status(404).send({ error: "Specified Assignment `id` not found" })
    else {
        const course = await Course.findByPk(assignment.courseId)
        const auth = await requireTeacherOrAdminAuth(req.user, course)
        switch (auth) {
            case 403:
                res.status(403).send({ error: "The request was not made by the teacher of the course or an admin" })
                break
            default:
                try {
                    await Assignment.destroy({ where: { id: id } })
                    res.status(204).send()
                }
                catch (e) {
                    next(e)
                }
        }
        
    }
})

//must be authenticated as the course's teacher or an admin
router.get('/:id/submissions', requireAuthentication, async function (req, res) {
    const id = req.params.id
    const assignment = await Assignment.findOne({ where: { id: id } })
    if (!assignment)
        res.status(404).send({ error: "Specified Assignment `id` not found" })
    else {
        const course = await Course.findByPk(assignment.courseId)
        const auth = await requireTeacherOrAdminAuth(req.user, course)
        switch (auth) {
            case 403:
                res.status(403).send({ error: "The request was not made by the teacher of the course or an admin" })
                break
            default:
            let page = parseInt(req.query.page) || 1
            page = page < 1 ? 1 : page
            const numPerPage = 10
            const offset = (page - 1) * numPerPage

            var where = { assignmentId: id }
            const studentId = req.query.studentId ? req.query.studentId : null
            if (studentId)
                where.userId = studentId

            const result = await Submission.findAndCountAll({
                where: where,
                limit: numPerPage,
                offset: offset
            })

            const lastPage = Math.ceil(result.count / numPerPage)

            res.status(200).json({
                submissions: result.rows,
                pageNumber: page,
                totalPages: lastPage,
                pageSize: numPerPage,
                totalCount: result.count,
            })
        }
    }
})

//must be authenticated as user
router.post('/:id/submissions', requireAuthentication, async function (req, res) {
    const userId = 1 //filler that needs to be replaced with real user (student) id
    const id = req.params.id
    const assignment = await Assignment.findOne({ where: { id: id } })
    if (!assignment)
        res.status(404).send({ error: "Specified Assignment `id` not found" })
    else {
        const body = req.body
        body.assignmentId = id
        body.userId = userId
        try {
            const submission = await Submission.create(body, SubmissionClientFields)
            res.status(201).send({ id: submission.id })
        }
        catch (e) {
            res.status(400).send({ error: "The request body was either not present or did not contain a valid Submission object." })
        }
    }
})

module.exports = router