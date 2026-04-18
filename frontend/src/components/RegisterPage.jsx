import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./RegisterPage.css";

export default function RegisterPage() {
  const { register, isAuthed, status } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    office_address: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Во время первичного bootstrap не мигаем формой регистрации
  if (status === "loading") return null;
  if (isAuthed) return <Navigate to="/calc" replace />;

  const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      setError("Заполните ФИО, email и пароль (минимум 6 символов)");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        office_address: form.office_address.trim() || undefined,
        password: form.password,
      });
      navigate("/calc", { replace: true });
    } catch (err) {
      setError(err?.message || "Не удалось зарегистрироваться");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-page__card">
        <h1 className="register-page__title">Регистрация</h1>
        <form className="register-page__form" onSubmit={onSubmit} noValidate>
          <label className="register-page__field">
            <span>ФИО *</span>
            <input
              type="text"
              autoComplete="name"
              value={form.full_name}
              onChange={onChange("full_name")}
              required
            />
          </label>
          <label className="register-page__field">
            <span>Email *</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={onChange("email")}
              required
            />
          </label>
          <label className="register-page__field">
            <span>Телефон</span>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={onChange("phone")}
            />
          </label>
          <label className="register-page__field">
            <span>Адрес офиса</span>
            <input
              type="text"
              autoComplete="street-address"
              value={form.office_address}
              onChange={onChange("office_address")}
            />
          </label>
          <label className="register-page__field">
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
          {error && <div className="register-page__error" role="alert">{error}</div>}
          <button type="submit" className="register-page__submit" disabled={submitting}>
            {submitting ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>
        <p className="register-page__footer">
          Уже есть аккаунт? <Link to="/calc">Войти</Link>
        </p>
      </div>
    </div>
  );
}
