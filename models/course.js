const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const { Assignment } = require('./assignment')
const { User } = require('./user')
const { Submission } = require('./submission')
const { Enrollment } = require('./enrollment')

const Course = sequelize.define('course', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    subject: { type: DataTypes.STRING, allowNull: false },
    number: { type: DataTypes.STRING, allowNull: false },
    term: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: {
                args: [['FA', 'WI', 'SP', 'SU']],
                msg: "Invalid term. Must be FA, WI, SP, or SU"
            }
        }
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
})

Course.belongsToMany(User, { through: Enrollment })
User.belongsToMany(Course, { through: Enrollment })

User.hasOne(Course, { foreignKey: 'instructorId', allowNull: false })

Course.hasMany(Assignment, { foreignKey: 'courseId', allowNull: false })
Assignment.belongsTo(Course)

Assignment.hasMany(Submission, { foreignKey: "assignmentId", allowNull: false } );
Submission.belongsTo(Assignment);

User.hasMany(Submission, { foreignKey: "userId", onDelete: "CASCADE" })
Submission.belongsTo(User)

exports.Course = Course

exports.CourseClientFields = [
    'subject',
    'number',
    'term',
    'title',
    'description',
    'instructorId'
  ]