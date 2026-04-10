import { NavLink } from "react-router-dom";
import "./AppHeader.css";

const navLinkClass = ({ isActive }) =>
  `app-header__link${isActive ? " app-header__link--active" : ""}`;

export default function AppHeader() {
  const logoSrc = `${import.meta.env.BASE_URL}logo1.png`;

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
          <NavLink to="/kp" className={navLinkClass}>
            Коммерческое предложение
          </NavLink>
          <NavLink to="/price" className={navLinkClass}>
            Прайс
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
