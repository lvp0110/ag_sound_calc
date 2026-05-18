import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import OfferDraftGuard from "./OfferDraftGuard";
import "./AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <div className="app-layout__main">
        <OfferDraftGuard />
        <Outlet />
      </div>
    </div>
  );
}
