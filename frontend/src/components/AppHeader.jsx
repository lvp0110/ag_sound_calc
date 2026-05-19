import { useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useOfferEditSession } from "../stores/offerEditSessionStore.js";
import "./AppHeader.css";

const navLinkClass = ({ isActive }) =>
  `app-header__link${isActive ? " app-header__link--active" : ""}`;

const iconProps = {
  className: "app-header__icon-svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function HeaderIcon({ children }) {
  return <span className="app-header__icon">{children}</span>;
}

function IconCalc() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="12" y1="10" x2="14" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="12" y1="14" x2="14" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  );
}

function IconOffers() {
  return (
    <svg {...iconProps}>
      <path d="M8 4h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8l4-4z" />
      <path d="M8 4v4H4" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="14" y2="16" />
    </svg>
  );
}

function IconPrice() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-4z" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <path d="M9.5 11.5h3a1.5 1.5 0 1 1 0 3h-1.5a1.5 1.5 0 1 0 0 3h3" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </svg>
  );
}

function IconLogin() {
  return <IconUser />;
}

function IconLogout() {
  return (
    <svg {...iconProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function AppHeader() {
  const innerRef = useRef(null);
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

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const syncHeaderHeight = () => {
      document.documentElement.style.setProperty(
        "--app-header-inner-height",
        `${el.getBoundingClientRect().height}px`
      );
    };

    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [user, status]);

  return (
    <header className="app-header">
      <div ref={innerRef} className="app-header__inner">
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
            title="Калькулятор"
            aria-label="Калькулятор"
            onClick={(e) => guardDraftNav(e, "/calc")}
          >
            <HeaderIcon>
              <IconCalc />
            </HeaderIcon>
            <span className="app-header__label">Калькулятор</span>
          </NavLink>
          {user && (
            <NavLink
              to={isEditingDraft && activeOfferId ? `/kp/${activeOfferId}` : "/kp/list"}
              className={`app-header__link${kpNavActive ? " app-header__link--active" : ""}${
                isEditingDraft ? " app-header__link--unsaved" : ""
              }`}
              end={isEditingDraft}
              title={
                isEditingDraft
                  ? "Мои КП — есть несохранённые изменения"
                  : "Мои КП"
              }
              aria-label={
                isEditingDraft
                  ? "Мои КП, несохранённые изменения"
                  : "Мои КП"
              }
              onClick={(e) =>
                guardDraftNav(
                  e,
                  isEditingDraft && activeOfferId
                    ? `/kp/${activeOfferId}`
                    : "/kp/list"
                )
              }
            >
              <HeaderIcon>
                <IconOffers />
              </HeaderIcon>
              <span className="app-header__label">Мои КП</span>
              {isEditingDraft ? (
                <span className="app-header__unsaved-badge" aria-hidden="true">
                  !
                </span>
              ) : null}
            </NavLink>
          )}
          <NavLink
            to="/price"
            className={navLinkClass}
            title="Прайс"
            aria-label="Прайс"
            onClick={(e) => guardDraftNav(e, "/price")}
          >
            <HeaderIcon>
              <IconPrice />
            </HeaderIcon>
            <span className="app-header__label">Прайс</span>
          </NavLink>
        </nav>
        <div className="app-header__auth">
          {status === "loading" ? null : user ? (
            <>
              <span
                className="app-header__user"
                title={user.full_name || user.email}
              >
                <HeaderIcon>
                  <IconUser />
                </HeaderIcon>
                <span className="app-header__label">
                  {user.full_name || user.email}
                </span>
              </span>
              <button
                type="button"
                className="app-header__auth-btn"
                title="Выйти"
                aria-label="Выйти"
                onClick={logout}
              >
                <HeaderIcon>
                  <IconLogout />
                </HeaderIcon>
                <span className="app-header__label">Выйти</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="app-header__auth-btn"
              title="Войти"
              aria-label="Войти"
              onClick={openLoginModal}
            >
              <HeaderIcon>
                <IconLogin />
              </HeaderIcon>
              <span className="app-header__label">Войти</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
