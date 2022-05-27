const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Submission = require('./submission')

const Assignment = sequelize.define('assignment', {
    title: { type: DataTypes.STRING, allowNull: false },
    dueDate: { type: DataTypes.DATE, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false }
})

Assignment.hasMany(Submission, { foreignKey: 'assignmentId', onDelete: 'CASCADE' });
Submission.belongsTo(Assignment);

exports.Assignment = Assignment