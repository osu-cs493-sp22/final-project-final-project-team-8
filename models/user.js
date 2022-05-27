const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Submission = require('./submission')

const User = sequelize.define('user', {
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    role: { 
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "student",
        validate: {
            isIn: [['student', 'instructor', 'admin']]
        }
    }
})

User.hasMany(Submission, { foreignKey: "userId" })
Submission.belongsTo(User)

exports.User = User