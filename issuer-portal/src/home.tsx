
import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={{fontFamily:'system-ui', maxWidth: 720, margin:'40px auto'}}>
      <h1>Issuer Portal (Student view)</h1>
      <p>Use this simplified portal to simulate a student seeing a credential to claim.</p>
      <Link to="/student">Go to Student Page →</Link>
    </div>
  )
}
