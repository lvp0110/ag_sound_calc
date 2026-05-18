import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useOfferEditSession } from "../stores/offerEditSessionStore.js";
import "./AppHeader.css";

const navLinkClass = ({ isActive }) =>
  `app-header__link${isActive ? " app-header__link--active" : ""}`;

export default function AppHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}logo1.png`;
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status, openLoginModal, logout } = useAuth();
  const { isEditingDraft, activeOfferId, isPathAllowedDuringDraft } =
    useOfferEditSession();

  const guardDraftNav = (event, targetPath) => {
    if (!isEditingDraft || !activeOfferId) return;
    if (isPathAllowedDuringDraft(targetPath)) return;
    event.preventDefault();
    navigate(`/kp/${activeOfferId}`, { replace: true });
  };
  const kpNavActive =
    location.pathname === "/kp/list" ||
    (location.pathname.startsWith("/kp/") && location.pathname !== "/kp/list");

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <NavLink
          to="/calc"
          className="app-header__brand"
          end={false}
          title="Калькулятор конструкций"
          aria-label="Калькулятор конструкций"
          onClick={(e) => guardDraftNav(e, "/calc")}
        >
          <img
            src={logoSrc}
            alt=""
            className="app-header__logo"
            width={65}
            height={65}
          />
        </NavLink>
        <nav className="app-header__nav" aria-label="Разделы">
          <NavLink
            to="/calc"
            className={navLinkClass}
            end={false}
            onClick={(e) => guardDraftNav(e, "/calc")}
          >
            Калькулятор
          </NavLink>
          {user && (
            <NavLink
              to={isEditingDraft && activeOfferId ? `/kp/${activeOfferId}` : "/kp/list"}
              className={`app-header__link${kpNavActive ? " app-header__link--active" : ""}`}
              end={isEditingDraft}
              onClick={(e) =>
                guardDraftNav(
                  e,
                  isEditingDraft && activeOfferId
                    ? `/kp/${activeOfferId}`
                    : "/kp/list"
                )
              }
            >
              Мои КП
            </NavLink>
          )}
          <NavLink
            to="/price"
            className={navLinkClass}
            onClick={(e) => guardDraftNav(e, "/price")}
          >
            Прайс
          </NavLink>
        </nav>
        <div className="app-header__auth">
          {status === "loading" ? null : user ? (
            <>
              <span className="app-header__user" title={user.email}>
                {user.full_name || user.email}
              </span>
              <button type="button" className="app-header__auth-btn" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <button type="button" className="app-header__auth-btn" onClick={openLoginModal}>
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
