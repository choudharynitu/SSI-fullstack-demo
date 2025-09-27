
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Student from './student'
import Home from './home'

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/student" element={<Student />} />
    </Routes>
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(<App />)
