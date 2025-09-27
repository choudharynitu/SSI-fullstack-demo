import { Link } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h2>Issuer-Verifier</h2>
      <ul>
        <li><Link to="/">🏠 Home</Link></li>
        <li><Link to="/identifiers">🔗 Identifiers</Link></li>
        <li><Link to="/issue">📝 Issue Credential</Link></li>
        <li><Link to="/verify">✅ Verify Credential</Link></li>
        <li><Link to="/schemas">📄 Manage Schemas</Link></li>
        <li><Link to="/credentials-issued">📜 Credentials Issued</Link></li>
        <li><Link to="/issue">📝 Create Offer (OID4VCI)</Link></li>

      </ul>
    </div>
  );
};

export default Sidebar;
