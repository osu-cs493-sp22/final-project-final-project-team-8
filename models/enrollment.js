const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Enrollment = sequelize.define('enrollment', {})

exports.Enrollment = Enrollment

exports.EnrollmentClientFields = [
    'userId',
    'courseId'
]