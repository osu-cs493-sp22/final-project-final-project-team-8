const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const { Submission } = require('./submission')

const Assignment = sequelize.define('assignment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false }
})

// Assignment.hasMany(Submission, { foreignKey: { allowNull: false }});
// Submission.belongsTo(Assignment);

exports.Assignment = Assignment

exports.AssignmentClientFields = [
    'title',
    'dueDate',
    'courseId'
  ]