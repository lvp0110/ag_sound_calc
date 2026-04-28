import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <div className="app-layout__main">
        <Outlet />
      </div>
    </div>
  );
}
