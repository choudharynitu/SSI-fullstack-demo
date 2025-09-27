/*import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'*/

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import IssueCredential from "./pages/IssueCredential";
import VerifyCredential from "./pages/VerifyCredential";
import DIDManager from "./components/DIDManager";
import SchemaCreator from "./components/SchemaCreator";
import CredentialsIssued from "./pages/CredentialsIssued";
import "./styles.css";

const App = () => {
  return (
    <Router>
      <div className="container">
        <Sidebar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/identifiers" element={<DIDManager />} />
            <Route path="/schemas" element={<SchemaCreator />} />
            <Route path="/issue" element={<IssueCredential />} />
            <Route path="/verify" element={<VerifyCredential />} />
            <Route path="/credentials-issued" element={<CredentialsIssued />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
