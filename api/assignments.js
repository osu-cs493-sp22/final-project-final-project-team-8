const { Router } = require('express')
const router = Router()
const multer = require('multer')
const crypto = require('crypto')
const fs = require('fs')
const fspromise = require('fs/promises')
const { ObjectId, GridFSBucket } = require('mongodb')
const amqp = require('amqplib')
const { connectToDB, getDbReference } = require('../lib/mongo')

const { Assignment, AssignmentClientFields } = require('../models/assignment')
const { Submission, SubmissionClientFields } = require('../models/submission')
const { requireAuthentication, requireTeacherOrAdminAuth } = require('../lib/auth')
const { Course } = require('../models/course')
const { Enrollment } = require('../models/enrollment')
const { User } = require('../models/user')

const upload = multer({
    storage: multer.diskStorage({
      destination: `${__dirname}/uploads`,
      filename: function (req, file, callback) {
        const ext = file.mimetype.substring(file.mimetype.indexOf('/') + 1)
        const filename = crypto.pseudoRandomBytes(16).toString('hex')
        callback(null, `${filename}.${ext}`)
      }
    })
})

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

function saveFile(file) {
    return new Promise(function (resolve, reject) {
        const db = getDbReference()
        const bucket = new GridFSBucket(db, { bucketName: 'files' })
        const metadata = {
          assignmentId: file.assignmentId,
          userId: file.userId,
          mimetype: file.mimetype
        }
        const uploadStream = bucket.openUploadStream(file.filename, {
          metadata: metadata
        })
        fs.createReadStream(file.path).pipe(uploadStream)
          .on('error', function(err) {
            reject(err)
          })
          .on('finish', function (result) {
            console.log("== stream result:", result)
            resolve(result._id)
          })
      })
}

//must be authenticated as user
router.post('/:id/submissions', upload.single('file'), requireAuthentication, async function (req, res) {
    console.log("== req.file:", req.file)
    console.log("== req.body:", req.body)
    const id = req.params.id
    const userId = req.user
    const user = await User.findByPk(userId)
    const assignment = await Assignment.findOne({ where: { id: id } })
    const enrollment = await Enrollment.findOne({ where: { userId: userId, courseId: assignment.courseId } })
    if (!assignment) {
        res.status(404).send({ error: "Specified Assignment `id` not found" })
    }
    if (!enrollment || user.role != "student") {
        res.status(403).send({ error: "The request was not made by an authenticated User satisfying the authorization criteria described above." })
    }
    else {
        if (req.file && req.body && req.body.comment && req.body.text && req.body.grade) {
            const file = {
                assignmentId: id,
                userId: userId,
                path: req.file.path,
                filename: req.file.filename,
                mimetype: req.file.mimetype
            }
            const submissionId = await saveFile(file)
            await fspromise.unlink(req.file.path)
            req.body.assignmentId = id
            req.body.userId = userId
            req.body.file = `/assignments/${id}/submissions/${submissionId}`
            req.body.grade = parseFloat(req.body.grade)
            const submission = await Submission.create(req.body, SubmissionClientFields)
            res.status(201).send({ id: submission.id })
        }
        else {
            res.status(400).send({
                error: "The request body was either not present or did not contain a valid Submission object."
            })
        }
    }
})

async function getFileInfoById(id) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, { bucketName: 'files' })
    if (!ObjectId.isValid(id)) {
        return null
    } else {
        const results = await bucket.find({ _id: new ObjectId(id) }).toArray()
        return results[0]
    }
}

function getFileDownloadStream(id) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, { bucketName: 'files' })
    if (!ObjectId.isValid(id)) {
        return null
    } else {
        return bucket.openDownloadStream(new ObjectId(id))
    }
}

router.get('/:id/submissions/:submissionId', async function (req, res) {
    const file = await getFileInfoById(req.params.submissionId)
    if (file) {
        getFileDownloadStream(file._id)
        .on('file', function (file) {
            res.status(200).type(file.metadata.mimetype.substring(file.metadata.mimetype.indexOf('/') + 1))
        })
        .on('error', function (err) {
            if (err.code == 'ENOENT') {
                next()
            } else {
                next(err)
            }
        })
        .pipe(res)
    } else {
        res.status(400).send({
            err: "No submission exists with the given id"
        })
    }
})

module.exports = router