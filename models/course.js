const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const { Assignment } = require('./assignment')
const { User } = require('./user')

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

Course.belongsToMany(User, { through: 'enrollments' })
User.belongsToMany(Course, { through: 'enrollments' })

User.hasOne(Course, { foreignKey: 'instructorId', allowNull: false })

Course.hasMany(Assignment, { foreignKey: 'courseId', allowNull: false })
Assignment.belongsTo(Course)

exports.Course = Course

exports.CourseClientFields = [
    'subject',
    'number',
    'term',
    'title',
    'description',
    'instructorId'
  ]