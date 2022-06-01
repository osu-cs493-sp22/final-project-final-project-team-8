const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Assignment = sequelize.define('assignment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: false },
})

exports.Assignment = Assignment

exports.AssignmentClientFields = [
    'title',
    'dueDate',
    'courseId'
  ]