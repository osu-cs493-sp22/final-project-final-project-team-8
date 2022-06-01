const { Router } = require('express')
const router = Router()

const { Assignment, AssignmentClientFields } = require('../models/assignment')
const { Submission, SubmissionClientFields } = require('../models/submission')



module.exports = router