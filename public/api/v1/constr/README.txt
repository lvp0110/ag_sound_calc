Превью для dev (npm run dev)
=============================

Сюда кладите файлы с теми же именами, что в поле «Img» ответа GET /api/v1/AllIsolationConstr
(например floor_beam_sylomer.jpg). Запрос /api/v1/constr/… тогда отдастся с диска, без прокси.

Если бэкенд сам отдаёт /api/v1/constr/*, эта папка не нужна. Иначе укажите хост с картинками
в .env.local: VITE_CONSTR_IMAGES_ORIGIN=https://ваш-сервер:порт
