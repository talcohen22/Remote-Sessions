import express from 'express'
import cookieParser from 'cookie-parser'
import { MongoClient } from 'mongodb'
import mongodb from 'mongodb'
import cors from 'cors'
import { Server } from 'socket.io'
import http from 'http'
import path from 'path'
// import { mongoDBKey } from './keys.js'
const { ObjectId } = mongodb

const mongoDBKey = { mongoURI: process.env.mongoURI, secretOrKey: "secret" }

const app = express()
app.use(cookieParser())
app.use(express.json())
app.use(cors())

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('public')))
} else {
    const corsOptions = {
        origin: [
            'http://127.0.0.1:3030',
            'http://localhost:3030',
            'http://127.0.0.1:5173',
            'http://localhost:5173'
        ],
        credentials: true
    }
    app.use(cors(corsOptions))
}


//connection to mongoDB
// const uri = "mongodb://0.0.0.0:27017/" //for local usage
// const client = new MongoClient(uri)
const client = new MongoClient(mongoDBKey.mongoURI) //for global usage
const db = client.db('codeDB')
const coll = db.collection('code')

async function run() {
    try {
        await client.connect()
        console.log('Successfully connected to the database')
    } catch (error) {
        console.error('Error connecting to the database:', error)
        process.exit(1)
    }
}
run()


app.use(express.static(path.resolve('public')));

// Get codes (READ)
app.get('/api/code', async (req, res) => {
    try {
        const cursor = await coll.find()
        const codes = await cursor.toArray()
        res.json(codes)
    } catch (error) {
        console.error('Failed to get codes', error)
        res.status(500).send({ error: 'Failed to get codes' })
    }
})

//getCode by ID
app.get('/api/code/:id', async (req, res) => {
    try {
        const codeId = req.params.id
        const code = await coll.findOne({ _id: new ObjectId(codeId) })
        res.json(code)
    } catch (error) {
        console.error('Failed to get codes', error)
        res.status(500).send({ error: 'Failed to get codes' })
    }
})

//update code
app.put('/api/code/:id', async (req, res) => {
    try {
        const code = req.body
        const saveCodeId = code._id
        delete code._id
        await coll.updateOne({ _id: new ObjectId(saveCodeId) }, { $set: code })
        code._id = saveCodeId
        res.json(code)
    } catch (error) {
        console.error('Failed to update code', error)
        res.status(500).send({ error: 'Failed to update code' })
    }
})


const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*' // the server is configured to accept requests from any origin
    }
})


const rooms = []

io.on('connection', (socket) => {

    socket.on('client connected', (codeId) => {
        socket.join(codeId); //associating the client with the relevant code block
        var room = rooms.find(room => room.codeId === codeId) //once a client connected to specific code block, we will save his socketId if he is the first one to enter this page
        if (room) {
            if (!room.firstClientConnected) room.firstClientConnected = socket.id
        }
        else room = rooms.push({ codeId, firstClientConnected: socket.id }) //keeping of all occupied code blocks and the first client to enter each
        io.to(codeId).emit('set first client', room.firstClientConnected) //emit to the frontend (all clients in the same code block) who is the first client in the specific code block
        console.log('rooms:', rooms)
    })

    socket.on('code changed', code => { //listening to a 'code changed' event
        io.to(code._id).emit('code updated', code) //emit to the frontend (all other clients in the same code block) that the event 'code updated' happened
    })

    socket.on('client leave room', (codeId) => { //When a client leaves the code block - we will check if he is the first client to connect (the teacher), and if so we will update that there is no first client connected
        const room = rooms.find(room => room.codeId === codeId)
        if (room && room.firstClientConnected === socket.id) {
            room.firstClientConnected = ''
        }
    })
})


const port = process.env.PORT || 3030
server.listen(port, () =>
    console.log(`Server listening on port ${port}`)
)