import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  changeUserPassword,
  createUser,
  listCompanies,
  listUsers,
  updateUser,
} from "../services/adminApi.js";
import "./Admin.css";

function UserModal({ user, companies, onClose, onSaved }) {
  const isEdit = Boolean(user?.id);
  const [form, setForm] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    password: "",
    phone: user?.phone ?? "",
    office_address: user?.office_address ?? "",
    role: user?.role ?? "USER",
    company_id: user?.company_id ?? user?.company?.id ?? "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError("ФИО и email обязательны");
      return;
    }
    if (!isEdit && form.password.length < 6) {
      setError("Пароль обязателен (минимум 6 символов)");
      return;
    }
    if (!form.company_id) {
      setError("Выберите компанию");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const base = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        office_address: form.office_address.trim() || null,
        role: form.role,
        company_id: form.company_id,
      };
      const saved = isEdit
        ? await updateUser(user.id, base)
        : await createUser({ ...base, password: form.password });
      onSaved(saved, isEdit);
    } catch (err) {
      setError(err?.message || "Не удалось сохранить пользователя");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal__backdrop" onClick={() => !saving && onClose()}>
      <form
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 className="admin-modal__title">
          {isEdit ? "Редактировать пользователя" : "Новый пользователь"}
        </h2>
        {error && <div className="admin-modal__error">{error}</div>}
        <label className="admin-modal__field">
          <span>ФИО *</span>
          <input value={form.full_name} onChange={onChange("full_name")} required />
        </label>
        <label className="admin-modal__field">
          <span>Email *</span>
          <input type="email" value={form.email} onChange={onChange("email")} required />
        </label>
        {!isEdit && (
          <label className="admin-modal__field">
            <span>Пароль * (минимум 6 символов)</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={onChange("password")}
              required
              minLength={6}
            />
          </label>
        )}
        <label className="admin-modal__field">
          <span>Телефон</span>
          <input value={form.phone} onChange={onChange("phone")} />
        </label>
        <label className="admin-modal__field">
          <span>Адрес офиса</span>
          <input value={form.office_address} onChange={onChange("office_address")} />
        </label>
        <label className="admin-modal__field">
          <span>Роль</span>
          <select value={form.role} onChange={onChange("role")}>
            <option value="USER">Пользователь</option>
            <option value="ADMIN">Администратор</option>
          </select>
        </label>
        <label className="admin-modal__field">
          <span>Компания *</span>
          <select value={form.company_id} onChange={onChange("company_id")} required>
            <option value="" disabled>
              — выберите компанию —
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-modal__actions">
          <button
            type="button"
            className="admin-modal__btn admin-modal__btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="admin-modal__btn admin-modal__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changeUserPassword(user.id, password);
      onSaved();
    } catch (err) {
      setError(err?.message || "Не удалось сменить пароль");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal__backdrop" onClick={() => !saving && onClose()}>
      <form
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 className="admin-modal__title">Сменить пароль</h2>
        <p className="admin-modal__subtitle">{user.full_name} ({user.email})</p>
        {error && <div className="admin-modal__error">{error}</div>}
        <label className="admin-modal__field">
          <span>Новый пароль * (минимум 6 символов)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <label className="admin-modal__field">
          <span>Повтор пароля *</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
        </label>
        <div className="admin-modal__actions">
          <button
            type="button"
            className="admin-modal__btn admin-modal__btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="admin-modal__btn admin-modal__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { user } (user=null → создание)
  const [pwModal, setPwModal] = useState(null); // null | { user }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usersData, companiesData] = await Promise.all([
          listUsers(),
          listCompanies(),
        ]);
        if (cancelled) return;
        setUsers(Array.isArray(usersData) ? usersData : []);
        setCompanies(Array.isArray(companiesData) ? companiesData : []);
        setLoadStatus("loaded");
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Не удалось загрузить пользователей");
        setLoadStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = (saved, wasEdit) => {
    setModal(null);
    setUsers((prev) =>
      wasEdit ? prev.map((u) => (u.id === saved.id ? saved : u)) : [...prev, saved]
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-page__title">Админка</h1>
        <button
          type="button"
          className="admin-page__primary-btn"
          onClick={() => setModal({ user: null })}
        >
          Новый пользователь
        </button>
      </div>

      <nav className="admin-page__tabs">
        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            `admin-page__tab${isActive ? " admin-page__tab--active" : ""}`
          }
        >
          Пользователи
        </NavLink>
        <NavLink
          to="/admin/companies"
          className={({ isActive }) =>
            `admin-page__tab${isActive ? " admin-page__tab--active" : ""}`
          }
        >
          Компании
        </NavLink>
      </nav>

      {error && <div className="admin-page__error" role="alert">{error}</div>}

      {loadStatus === "loading" ? (
        <p className="admin-page__empty">Загрузка...</p>
      ) : users.length === 0 ? (
        <p className="admin-page__empty">Пользователей нет.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Компания</th>
              <th>Роль</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  {u.company ? (
                    <Link
                      className="admin-link"
                      to={`/admin/companies?focus=${u.company.id}`}
                    >
                      {u.company.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span
                    className={`admin-badge ${
                      u.role === "ADMIN" ? "admin-badge--admin" : "admin-badge--user"
                    }`}
                  >
                    {u.role === "ADMIN" ? "Админ" : "Пользователь"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-table__action-btn"
                    onClick={() => setModal({ user: u })}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="admin-table__action-btn"
                    onClick={() => setPwModal({ user: u })}
                  >
                    Пароль
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <UserModal
          user={modal.user}
          companies={companies}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {pwModal && (
        <PasswordModal
          user={pwModal.user}
          onClose={() => setPwModal(null)}
          onSaved={() => setPwModal(null)}
        />
      )}
    </div>
  );
}
