const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const { Assignment } = require('./assignment')
const { User } = require('./user')

const Course = sequelize.define('course', {
    subjectCode: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
})

Course.belongsToMany(User, { through: 'Enrollments' })
User.belongsToMany(Course, { through: 'Enrollments' })

User.hasOne(Course, { foreignKey: 'teacherId', allowNull: false })

Course.hasMany(Assignment, { foreignKey: 'courseId', allowNull: false })
Assignment.belongsTo(Course)

exports.Course = Course