import express from 'express'
import cookieParser from 'cookie-parser'
import { MongoClient } from 'mongodb'
import mongodb from 'mongodb'
import cors from 'cors'
import { Server } from 'socket.io'
import http from 'http'
import path from 'path'
// import { mongoDBKey } from './keys.js'

const mongoDBKey = { mongoURI: process.env.mongoURI, secretOrKey: "secret" }

const { ObjectId } = mongodb

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
const client = new MongoClient(mongoDBKey)
// const client = new MongoClient(mongoDBKey.mongoURI)
// const client = new MongoClient(uri)

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






// Express Config:
// app.use(express.static('public'))

// app.get('/', (req, res) => {
//     res.send('<h1>Hello and welcome to my server!</h1>')
// })

app.use(express.static(path.resolve('public')));

// app.get('/**', (req, res) => {
//     console.log("im here");
//     res.sendFile(path.resolve('public/index.html'))
// })


// Get codes (READ)
app.get('/api/code', async (req, res) => {
    console.log("aaaaaaaaaaaaaaaaaaaaaaa");
    // console.log('mongoDBKey', mongoDBKey);
    try {
        console.log("AAAAAAAAAAAAAAA");
        console.log('(mongoDBKey.mongoURI', mongoDBKey.mongoURI);
        // console.log('client', client);
        const db = client.db('codeDB')
        console.log("bbbbbbbbbbbbbbbbbb");
        const coll = db.collection('code')
        const cursor = await coll.find()
        console.log("ccccccccccccccccccc");
        const codes = await cursor.toArray()
        console.log("ddddddddddddddd");
        console.log('codes:', codes)
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
        const db = client.db('codeDB')
        const coll = db.collection('code')
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
        const db = client.db('codeDB')
        const coll = db.collection('code')
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
// server.keepAliveTimeout = 120000
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
})


let firstClientConnected = ''

io.on('connection', (socket) => {
    console.log(`'user connected' ${socket.id}`);

    if (!firstClientConnected) {
        firstClientConnected = socket.id
    }
    socket.on('client connected', () => {
        io.emit('set first client', firstClientConnected)
    })

    socket.on('code changed', code => { //listening to a 'code changed' event
        io.emit('code updated', code) //emit to the frontend (all other clients) that the event 'code updated' happened
    })

    socket.on('disconnect', () => {
        if (socket.id === firstClientConnected) firstClientConnected = ''
    })

    console.log(`first client connected ${firstClientConnected}`);
})


const port = process.env.PORT || 3030
server.listen(port, () =>
    console.log(`Server listening on port ${port}`)
)

