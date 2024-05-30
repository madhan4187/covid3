const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null
const initilizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('"Server Running at http://localhost:3000/"')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
  }
}
initilizeDbAndServer()

const autherization = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  } else if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'hjsdfkjhf', async (error, paylode) => {
      if (error) {
        response.status(400)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(getUserQuery)
  if (dbUser === undefined) {
    response.status(200)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === false) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'hjsdfkjhf')
      response.send({jwtToken})
    }
  }
})

app.get('/states/', autherization, async (request, response) => {
  const getStatesQuery = `
  SELECT *
  FROM state`
  const stateArr = await db.all(getStatesQuery)
  response.send(stateArr)
})
module.exports = app

app.get('/states/:stateId/', autherization, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT *
  FROM state
  WHERE state_id=${stateId}`
  const state = await db.get(getStateQuery)
  response.send(state)
})
