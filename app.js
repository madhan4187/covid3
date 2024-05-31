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

const convertDbObjectIntoResponseObject = eachObj => {
  return {
    stateId: eachObj.state_id,
    stateName: eachObj.state_name,
    population: eachObj.population,
    districtId: eachObj.district_id,
    districtName: eachObj.district_name,
    cases: eachObj.cases,
    cured: eachObj.cured,
    active: eachObj.active,
    deaths: eachObj.deaths,
  }
}

const autherization = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'hjsdfkjhf', async (error, paylode) => {
      if (error) {
        response.status(401)
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
    response.status(400)
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
  response.send(
    stateArr.map(eachObj => convertDbObjectIntoResponseObject(eachObj)),
  )
})

app.get('/states/:stateId/', autherization, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT *
  FROM state
  WHERE state_id=${stateId}`
  const state = await db.get(getStateQuery)
  response.send(convertDbObjectIntoResponseObject(state))
})

app.post('/districts/', autherization, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDistrictQuery = `
  INSERT INTO 
    district (district_name,state_id,cases,cured,active,deaths)
  VALUES 
    (
      '${districtName}',
      '${stateId}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}'
    )
  `
  await db.run(addDistrictQuery)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', autherization, async (request, response) => {
  const {districtId} = request.params
  const getDistrictQuery = `
  SELECT *
  FROM district
  WHERE district_id = ${districtId}`
  const district = await db.get(getDistrictQuery)
  response.send(convertDbObjectIntoResponseObject(district))
})

app.delete(
  '/districts/:districtId/',
  autherization,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM district
  WHERE district_id = ${districtId}`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put('/districts/:districtId/', autherization, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateDistrictQuery = `
  UPDATE district
  SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
  WHERE
    district_id = '${districtId}'`
  await db.run(updateDistrictQuery)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', autherization, async (request, response) => {
  const {stateId} = request.params
  const getStatsQery = `
  SELECT 
    SUM(district.cases) AS totalCases,
    SUM(district.cured) AS totalCured,
    SUM(district.active) AS totalActive,
    SUM(district.deaths) AS totalDeaths
  FROM
    state INNER JOIN district ON state.state_id = district.state_id 
  WHERE
    district.state_id = '${stateId}'
  GROUP BY 
    district.district_id`
  const stats = await db.get(getStatsQery)
  response.send(stats)
})

module.exports = app
