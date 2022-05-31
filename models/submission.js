const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')
const { Assignment } = require('./assignment')
const { User } = require('./user')

const Submission = sequelize.define('submission', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    file: { type: DataTypes.STRING, allowNull: false},
    comment: { type: DataTypes.STRING },
    text: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    grade: { type: DataTypes.DOUBLE },
    assignmentId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false }
})

exports.Submission = Submission

exports.SubmissionClientFields = [
    'file',
    'comment',
    'text',
    'timestamp',
    'grade',
    'assignmentId',
    'userId'
  ]