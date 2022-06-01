const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Submission = sequelize.define('submission', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    file: { type: DataTypes.STRING, allowNull: false},
    comment: { type: DataTypes.STRING },
    text: { type: DataTypes.STRING },
    grade: { type: DataTypes.DOUBLE }
})

exports.Submission = Submission

exports.SubmissionClientFields = [
    'file',
    'comment',
    'text',
    'grade',
    'assignmentId',
    'userId'
  ]