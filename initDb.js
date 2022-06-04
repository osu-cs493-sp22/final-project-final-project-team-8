const sequelize = require('./lib/sequelize')
const { Submission, SubmissionClientFields } = require('./models/submission')
const { Assignment, AssignmentClientFields } = require('./models/assignment')
const { User, UserClientFields } = require('./models/user')
const { Course, CourseClientFields } = require('./models/course')
const { Enrollment, EnrollmentClientFields } = require('./models/enrollment')
const { connectToDb, getDbReference, closeDbConnection } = require('./lib/mongo')

const assignmentData = require('./data/assignments.json')
const userData = require('./data/users.json')
const submissionData = require('./data/submissions.json')
const courseData = require('./data/courses.json')
const enrollmentData = require('./data/enrollments.json')

sequelize.sync().then(async function () {
  await User.bulkCreate(userData, { fields: UserClientFields })
  await Course.bulkCreate(courseData, { fields: CourseClientFields })
  await Assignment.bulkCreate(assignmentData, { fields: AssignmentClientFields })
  //await Submission.bulkCreate(submissionData, { fields: SubmissionClientFields })
  await Enrollment.bulkCreate(enrollmentData, { fields: EnrollmentClientFields })
})

const mongoCreateUser = process.env.MONGO_CREATE_USER
const mongoCreatePassword = process.env.MONGO_CREATE_PASSWORD

connectToDb(async function () {
  if (mongoCreateUser && mongoCreatePassword) {
    const db = getDbReference()
    const result = await db.addUser(mongoCreateUser, mongoCreatePassword, {
      roles: "readWrite"
    })
  }
  closeDbConnection(function () {
    console.log("== DB connection closed")
  })
})