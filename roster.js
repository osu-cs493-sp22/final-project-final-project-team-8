const fs = require('fs')
const { stringify } = require('csv')
const crypto = require('crypto')
const { Readable } = require('stream')
const { ObjectId, GridFSBucket } = require('mongodb')
const { Course } = require('./models/course')
const { User } = require('./models/user')
const sequelize = require('./lib/sequelize')

const { connectToDb, getDbReference } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')

const queue = 'rosters'

function uploadRoster(roster, courseId) {
    return new Promise(async function (resolve, reject) {
        const filename = crypto.pseudoRandomBytes(16).toString('hex')
        const ext = 'csv'
        const db = getDbReference()
        const bucket = new GridFSBucket(db, { bucketName: 'rosters' })
        const metadata = {
            courseId: courseId
        }
        const uploadStream = bucket.openUploadStream(`${filename}.${ext}`, {
            metadata: metadata
        })
        const buffer = Buffer.from(roster)
        const readable = new Readable()
        readable._read = () => {}
        readable.push(buffer)
        readable.push(null)
        readable.pipe(uploadStream)
            .on('error', function(err) {
                reject(err)
            })
            .on('finish', function(result) {
                console.log("== stream result:", result)
                resolve(result._id)
            })
    })
}

connectToDb(async function () {
    await connectToRabbitMQ(queue)
    const channel = getChannel()

    channel.consume(queue, async function (msg) {
        if (msg) {
            const courseId = parseInt(msg.content.toString())
            console.log("courseId: ", courseId)
            const course = await Course.findByPk(courseId, {
                include: [
                    {
                        model: User,
                        through: {attributes: []},
                        where: {
                            role: "student"
                        },
                        attributes: {
                            exclude: ["password"]
                        }
                    }
                ]
            })
            const students = course.users
            let studentData = []
            students.forEach(e => {
                const row = {
                    id: e.dataValues.id,
                    name: e.dataValues.firstName + " " + e.dataValues.lastName,
                    email: e.dataValues.email
                }
                studentData.push(row)
            });
            console.log("studentData: ", studentData)
            stringify(studentData, {
                header: true
            }, async function (err, output) {
                const rosterId = await uploadRoster(output, courseId)
            })
        }
        channel.ack(msg)
    })
})