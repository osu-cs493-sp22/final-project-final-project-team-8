const sequelize = require('./lib/sequelize')
const { Assignment, AssignmentClientFields } = require('./models/assignment')
const { User, UserClientFields } = require('./models/user')
const { Submission, SubmissionClientFields } = require('./models/submission')
const { Course, CourseClientFields } = require('./models/course')

const assignmentData = require('./data/assignments.json')
const userData = require('./data/users.json')
const submissionData = require('./data/submissions.json')
const courseData = require('./data/courses.json')

sequelize.sync().then(async function () {
  await Assignment.bulkCreate(assignmentData, { fields: AssignmentClientFields })
  await User.bulkCreate(userData, { fields: UserClientFields })
  await Submission.bulkCreate(submissionData, { fields: SubmissionClientFields })
  await Course.bulkCreate(courseData, { fields: CourseClientFields })
})