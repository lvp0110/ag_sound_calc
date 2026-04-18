import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./AppHeader.css";

const navLinkClass = ({ isActive }) =>
  `app-header__link${isActive ? " app-header__link--active" : ""}`;

export default function AppHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}logo1.png`;
  const { user, status, openLoginModal, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <NavLink
          to="/calc"
          className="app-header__brand"
          end={false}
          title="Калькулятор конструкций"
          aria-label="Калькулятор конструкций"
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
          <NavLink to="/calc" className={navLinkClass} end={false}>
            Калькулятор
          </NavLink>
          {user && (
            <NavLink to="/kp/list" className={navLinkClass}>
              Мои КП
            </NavLink>
          )}
          <NavLink to="/price" className={navLinkClass}>
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
