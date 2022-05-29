const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Submission = sequelize.define('submission', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    file: { type: DataTypes.STRING, allowNull: false},
    comment: { type: DataTypes.STRING },
    text: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    grade: { type: DataTypes.DOUBLE }
})

exports.Submission = Submission